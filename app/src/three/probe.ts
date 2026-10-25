import * as THREE from "three";
import { wallClipPlanes } from "./surfaces";
import { cutUniforms } from "./cutaway";
import { Effect } from "postprocessing";

// Umgebungssonde: Statt einer Studio-Umgebung (helle Leuchtflächen, die sich in jeder glatten
// Oberfläche spiegeln) wird die Wohnung selbst aus Sicht eines Raumpunkts in eine Würfelkarte
// gerendert, mit dem aktuellen Licht (Sonne, Himmel durch die Fenster, Leuchten am Abend).
// Glänzende Flächen spiegeln so nur, was im Raum tatsächlich zu sehen ist, und das indirekte
// Licht stammt aus den beleuchteten Raumflächen (zwei Lichtsprünge).

/** Himmelsleuchtdichte am Zenit in Szeneneinheiten (Sonne 3,4 entspricht ~100 klx). */
const SKY_ZENITH = new THREE.Color("#c4cfdb");
const SKY_HORIZON = new THREE.Color("#eceef0");
const GROUND = new THREE.Color("#8a8780");
/** Mittlere Himmelsfarbe (Farbart des Himmelslichts durch die Fenster). */
export const SKY_WHITE = SKY_HORIZON.clone().lerp(SKY_ZENITH, 0.5);

/** Himmel als kleines HDR-Panorama: Zenit blau, Horizont hell, Boden gedämpft. */
export function skyTexture(): THREE.DataTexture {
  const W = 8, H = 32;
  const data = new Float32Array(W * H * 4);
  const c = new THREE.Color();
  for (let j = 0; j < H; j++) {
    // j = 0 → unten (−90°), j = H−1 → oben (+90°)
    const el = ((j + 0.5) / H - 0.5) * Math.PI;
    if (el >= 0) c.copy(SKY_HORIZON).lerp(SKY_ZENITH, Math.pow(Math.sin(el), 0.6));
    // Sonnenbeschienener Boden draußen wirft etwa so viel Licht zurück, wie der Himmel abgibt
    // (Albedo ~0,2 × Sonne); durch die Fenster erhellt es vor allem die Decke
    else c.copy(GROUND).multiplyScalar(2.1).lerp(GROUND.clone().multiplyScalar(1.6), Math.min(1, -el * 2));
    for (let i = 0; i < W; i++) {
      const k = (j * W + i) * 4;
      data[k] = c.r;
      data[k + 1] = c.g;
      data[k + 2] = c.b;
      data[k + 3] = 1;
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// Belichtungsmessung: mittlere logarithmische Leuchtdichte der Würfelkarte (wie eine
// mittenbetonte Integralmessung), in ein RGBA8-Pixel kodiert → überall auslesbar.
const LOG_MIN = -14, LOG_MAX = 6;
const meterMat = new THREE.ShaderMaterial({
  uniforms: { env: { value: null } },
  vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: /* glsl */ `
    uniform samplerCube env;
    void main() {
      float s = 0.0, w = 0.0, m = 0.0;
      vec3 mc = vec3(0.0);
      for (int i = 0; i < 24; i++) {
        float z = 1.0 - (float(i) + 0.5) / 12.0;
        float r = sqrt(max(0.0, 1.0 - z * z));
        for (int j = 0; j < 24; j++) {
          float a = (float(j) + 0.5 + float(i) * 0.37) * 6.2831853 / 24.0;
          vec3 d = vec3(r * cos(a), z, r * sin(a));
          // Waagerechte Blickrichtungen zählen stärker als Boden und Decke
          float k = 0.35 + 0.65 * (1.0 - abs(z));
          vec3 c = textureCube(env, d).rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          s += k * log2(max(1e-5, l));
          m += k * min(l, 4.0);
          mc += k * c * (min(l, 4.0) / max(l, 1e-5));
          w += k;
        }
      }
      float v = clamp((s / w - ${LOG_MIN.toFixed(1)}) / ${(LOG_MAX - LOG_MIN).toFixed(1)}, 0.0, 1.0);
      // 16 Bit auf zwei Kanäle verteilt
      float u = clamp((log2(max(1e-5, m / w)) - ${LOG_MIN.toFixed(1)}) / ${(LOG_MAX - LOG_MIN).toFixed(1)}, 0.0, 1.0);
      // Pixel 2: Farbstich (Rot- und Blauanteil relativ zur Leuchtdichte, 0–4: warmes Abendlicht liegt bei Rot ≈ 2) für den Weißabgleich
      vec3 cm = mc / max(1e-5, m);
      vec2 q = clamp(vec2(cm.r, cm.b) / max(1e-5, dot(cm, vec3(0.2126, 0.7152, 0.0722))) * 0.25, 0.0, 1.0);
      gl_FragColor = gl_FragCoord.x < 1.0
        ? vec4(floor(v * 255.0) / 255.0, fract(v * 255.0), floor(u * 255.0) / 255.0, fract(u * 255.0))
        : vec4(floor(q.x * 255.0) / 255.0, fract(q.x * 255.0), floor(q.y * 255.0) / 255.0, fract(q.y * 255.0));
    }`,
  depthTest: false,
  depthWrite: false,
});
const meterScene = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), meterMat);
meterScene.frustumCulled = false;
const meterCam = new THREE.OrthographicCamera();

export class EnvironmentProbe {
  private rt: THREE.WebGLCubeRenderTarget;
  private cam: THREE.CubeCamera;
  private pm: THREE.PMREMGenerator;
  private env: THREE.WebGLRenderTarget | null = null;
  private sky = skyTexture();
  private meterRT = new THREE.WebGLRenderTarget(2, 1);
  private px = new Uint8Array(8);
  /** Mittlere Farbe des Raumlichts (Grauwelt, linear, Leuchtdichte 1) für den Weißabgleich. */
  cast = new THREE.Color(1, 1, 1);
  /** Mittlere Leuchtdichte (geometrisches Mittel) der letzten Aufnahme. */
  luminance = 0.18;
  geoMean = 0.18;
  private captures = 0;
  mean = 0.18;

  constructor(private gl: THREE.WebGLRenderer, size = 256) {
    this.rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.cam = new THREE.CubeCamera(0.05, 80, this.rt);
    this.pm = new THREE.PMREMGenerator(gl);
  }

  /**
   * Rendert die Szene von `pos` aus und liefert die vorgefilterte Umgebung.
   * skyLevel: Himmelshelligkeit (0 nachts … 1 heller Tag).
   * refine: Bei unveränderter Beleichtung startet der erste Durchgang mit der vorigen
   * Umgebung → jede Wiederholung fügt weitere Lichtsprünge hinzu (konvergiert, da Albedo < 1).
   */
  capture(scene: THREE.Scene, pos: THREE.Vector3, skyLevel: number, refine = false): THREE.Texture {
    const gl = this.gl;
    const keep = {
      env: scene.environment,
      envI: scene.environmentIntensity,
      bg: scene.background,
      bgI: scene.backgroundIntensity,
      clip: wallClipPlanes[0].constant,
      cut: cutUniforms.uCutOn.value,
      shadowAuto: gl.shadowMap.autoUpdate,
      autoClear: gl.autoClear,
    };
    // Sonde sieht die vollständige Wohnung: volle Wandhöhe, Decke, ohne Glas und Hilfsflächen
    const hidden: THREE.Object3D[] = [];
    const shown: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.ceiling && !o.visible) {
        o.visible = true;
        shown.push(o);
        return;
      }
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!o.visible || !(o as THREE.Mesh).isMesh || !m || Array.isArray(m)) return;
      const p = m as THREE.MeshPhysicalMaterial;
      if ((p.transmission ?? 0) > 0 || (m.transparent && !m.depthWrite) || o.userData.noProbe) {
        o.visible = false;
        hidden.push(o);
      }
    });
    wallClipPlanes[0].constant = 100;
    cutUniforms.uCutOn.value = 0;
    // Schattenkarten stammen aus dem letzten Bild; nicht je Würfelseite neu rendern
    gl.shadowMap.autoUpdate = false;
    // Die Nachbearbeitung schaltet autoClear ab; ohne Löschen blieben Tiefe und Farbe der
    // vorigen Aufnahme stehen und neue Flächen würden verworfen
    gl.autoClear = true;
    scene.background = this.sky;
    scene.backgroundIntensity = Math.max(0.004, skyLevel);
    this.cam.position.copy(pos);
    try {
      // 1. Durchgang: direktes Licht (ggf. plus bisherige Umgebung), 2. Durchgang mit diesem Ergebnis
      scene.environment = refine && this.env ? this.env.texture : null;
      scene.environmentIntensity = 1;
      this.cam.update(gl, scene);
      const first = this.pm.fromCubemap(this.rt.texture);
      scene.environment = first.texture;
      scene.environmentIntensity = 1;
      this.cam.update(gl, scene);
      first.dispose();
      const next = this.pm.fromCubemap(this.rt.texture);
      this.meter();
      this.env?.dispose();
      this.env = next;
    } finally {
      for (const o of hidden) o.visible = true;
      for (const o of shown) o.visible = false;
      wallClipPlanes[0].constant = keep.clip;
      cutUniforms.uCutOn.value = keep.cut;
      gl.shadowMap.autoUpdate = keep.shadowAuto;
      gl.autoClear = keep.autoClear;
      scene.background = keep.bg;
      scene.backgroundIntensity = keep.bgI;
      scene.environment = keep.env;
      scene.environmentIntensity = keep.envI;
    }
    return this.env!.texture;
  }

  private meter() {
    const gl = this.gl;
    const prev = gl.getRenderTarget();
    meterMat.uniforms.env.value = this.rt.texture;
    gl.setRenderTarget(this.meterRT);
    gl.render(meterScene, meterCam);
    gl.readRenderTargetPixels(this.meterRT, 0, 0, 2, 1, this.px);
    gl.setRenderTarget(prev);
    const dec = (hi: number, lo: number) => Math.pow(2, LOG_MIN + ((hi + lo / 255) / 255) * (LOG_MAX - LOG_MIN));
    this.geoMean = dec(this.px[0], this.px[1]);
    this.mean = dec(this.px[2], this.px[3]);
    // Mittelweg aus geometrischem Mittel (unempfindlich gegen helle Leuchten) und arithmetischem
    // Mittel (unempfindlich gegen dunkle Fensterflächen bei Nacht)
    this.luminance = Math.sqrt(this.geoMean * this.mean);
    // Farbstich des Raumlichts (z. B. warmes Licht vom dunklen Eichenboden); der Weißabgleich
    // selbst entsteht in Scene3D aus Lichtfarbe und diesem Wert (colorScience.ts)
    const r = ((this.px[4] + this.px[5] / 255) / 255) * 4, b = ((this.px[6] + this.px[7] / 255) / 255) * 4;
    const g = (1 - 0.2126 * r - 0.0722 * b) / 0.7152;
    this.cast.setRGB(Math.max(r, 0.05), Math.max(g, 0.05), Math.max(b, 0.05));
    (globalThis as Record<string, unknown>).__we13probe = { n: ++this.captures, pos: this.cam.position.toArray().map((v) => +v.toFixed(2)), geo: this.geoMean, mean: this.mean, cast: this.cast.toArray().map((v) => +v.toFixed(3)) };
  }

  dispose() {
    this.meterRT.dispose();
    this.env?.dispose();
    this.rt.dispose();
    this.pm.dispose();
    this.sky.dispose();
  }
}

/**
 * Weißabgleich in der Nachbearbeitung (vor dem Tone Mapping), Verstärkung je Kanal aus Scene3D. Wirkt auf das
 * ganze Bild; der Hintergrundverlauf ist dort bereits mit dem Kehrwert vorgefärbt.
 */
export class WhiteBalanceEffect extends Effect {
  constructor() {
    super(
      "WhiteBalance",
      /* glsl */ `uniform vec3 gain;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(inputColor.rgb * gain, inputColor.a);
      }`,
      { uniforms: new Map([["gain", new THREE.Uniform(new THREE.Color(1, 1, 1))]]) },
    );
  }
  set gain(c: THREE.Color) {
    (this.uniforms.get("gain")!.value as THREE.Color).copy(c);
  }
}

export const whiteBalance = new WhiteBalanceEffect();
