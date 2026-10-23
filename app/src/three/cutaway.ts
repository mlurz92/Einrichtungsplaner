import * as THREE from "three";
import { apartment } from "../data";
import { pointInPolygon } from "../model/geometry";

// Automatischer Wandschnitt („Wände ausblenden“ wie bei Die Sims): Eine Wandstelle wird bis auf
// einen niedrigen Sockel gekappt, sobald sie aus Sicht der Kamera einen Teil der Wohnung verdeckt.
// Kriterium je Wandsäule (x, z): Die Projektion der Wandkrone auf den Boden reicht hinter der Wand
// bis L·H/(hKamera−H). Liegt auf dieser Strecke (in Blickrichtung) eine Raumfläche, wird geschnitten.
// Die Entscheidung hängt nur von der Grundrisslage ab → keine schwebenden Wandreste.

export const CUT_LOW = 0.15;
const RES = 0.02; // Maskenraster 2 cm
const ERODE = 0.05; // Raumflächen um 5 cm verkleinert → eigene Wandoberfläche zählt nicht
const [BX0, BY0, BX1, BY1] = apartment.bounds;
const MW = Math.ceil((BX1 - BX0) / RES);
const MH = Math.ceil((BY1 - BY0) / RES);

function segDist(px: number, py: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

/** Raster der Raumflächen (um ERODE verkleinert), unabhängig vom DOM. */
function buildMask(): Uint8Array {
  const data = new Uint8Array(MW * MH);
  for (const r of apartment.rooms) {
    const poly = r.polygon as [number, number][];
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - BX0) / RES)), i1 = Math.min(MW - 1, Math.ceil((Math.max(...xs) - BX0) / RES));
    const j0 = Math.max(0, Math.floor((Math.min(...ys) - BY0) / RES)), j1 = Math.min(MH - 1, Math.ceil((Math.max(...ys) - BY0) / RES));
    for (let j = j0; j <= j1; j++) {
      const y = BY0 + (j + 0.5) * RES;
      for (let i = i0; i <= i1; i++) {
        const x = BX0 + (i + 0.5) * RES;
        if (!pointInPolygon(x, y, poly)) continue;
        let near = false;
        for (let k = 0; k < poly.length && !near; k++) near = segDist(x, y, poly[k], poly[(k + 1) % poly.length]) < ERODE;
        if (!near) data[j * MW + i] = 255;
      }
    }
  }
  return data;
}

const maskData = buildMask();
const maskTex = new THREE.DataTexture(maskData, MW, MH, THREE.RedFormat, THREE.UnsignedByteType);
maskTex.magFilter = maskTex.minFilter = THREE.NearestFilter;
maskTex.generateMipmaps = false;
maskTex.flipY = false;
maskTex.needsUpdate = true;

export const cutUniforms = {
  uCutOn: { value: 0 },
  uCutCam: { value: new THREE.Vector3(0, 20, 0) },
  uCutLow: { value: CUT_LOW },
  uCutH: { value: apartment.ceilingHeight },
  uCutMask: { value: maskTex },
  uCutBounds: { value: new THREE.Vector4(BX0, BY0, 1 / (MW * RES), 1 / (MH * RES)) },
};

const SAMPLES = 12;
const MAX_REACH = 8;

const GLSL = /* glsl */ `
uniform float uCutOn;
uniform vec3 uCutCam;
uniform float uCutLow;
uniform float uCutH;
uniform sampler2D uCutMask;
uniform vec4 uCutBounds;
varying vec3 vCutW;
float cutMaskAt(vec2 p) {
  vec2 uv = (p - uCutBounds.xy) * uCutBounds.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture2D(uCutMask, uv).r;
}
bool cutAway(vec3 w) {
  vec2 d = w.xz - uCutCam.xz;
  float L = length(d);
  if (L < 1e-3) return false;
  d /= L;
  float dh = uCutCam.y - uCutH;
  float reach = dh > 0.05 ? min(L * uCutH / dh, ${MAX_REACH.toFixed(1)}) : ${MAX_REACH.toFixed(1)};
  for (int i = 0; i < ${SAMPLES}; i++) {
    float s = 0.03 + reach * float(i) / ${(SAMPLES - 1).toFixed(1)};
    if (cutMaskAt(w.xz + d * s) > 0.5) return true;
  }
  return false;
}
`;

/** Gleiche Prüfung auf der CPU (Klicks auf ausgeblendete Wandteile ignorieren). */
export function isCutAway(x: number, y: number, z: number): boolean {
  if (cutUniforms.uCutOn.value < 0.5 || y <= CUT_LOW) return false;
  const c = cutUniforms.uCutCam.value;
  let dx = x - c.x;
  let dz = z - c.z;
  const L = Math.hypot(dx, dz);
  if (L < 1e-3) return false;
  dx /= L;
  dz /= L;
  const H = apartment.ceilingHeight;
  const dh = c.y - H;
  const reach = dh > 0.05 ? Math.min((L * H) / dh, MAX_REACH) : MAX_REACH;
  for (let i = 0; i < SAMPLES; i++) {
    const s = 0.03 + (reach * i) / (SAMPLES - 1);
    const px = Math.floor((x + dx * s - BX0) / RES);
    const pz = Math.floor((z + dz * s - BY0) / RES);
    if (px >= 0 && pz >= 0 && px < MW && pz < MH && maskData[pz * MW + px]) return true;
  }
  return false;
}

/** Material um den Wandschnitt erweitern (einmalig, gemeinsame Uniforms). */
export function patchCutaway(m: THREE.Material) {
  if (m.userData.cutaway) return;
  m.userData.cutaway = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    Object.assign(shader.uniforms, cutUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCutW;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
  vec4 cutW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    cutW = instanceMatrix * cutW;
  #endif
  vCutW = (modelMatrix * cutW).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLSL}`)
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (uCutOn > 0.5 && vCutW.y > uCutLow && cutAway(vCutW)) discard;");
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `cutaway|${key ? key() : ""}`;
  m.needsUpdate = true;
}

/** Raycast so einschränken, dass ausgeblendete Wandteile (Schnitt/Automatik) nicht getroffen werden. */
export function cutAwareRaycast(mesh: THREE.Mesh, clipY: () => number) {
  const base = mesh.raycast.bind(mesh);
  mesh.raycast = (rc, out) => {
    const n0 = out.length;
    base(rc, out);
    for (let i = out.length - 1; i >= n0; i--) {
      const p = out[i].point;
      if (p.y > clipY() || isCutAway(p.x, p.y, p.z)) out.splice(i, 1);
    }
  };
}
