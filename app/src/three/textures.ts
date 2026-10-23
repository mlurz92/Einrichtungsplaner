import * as THREE from "three";

// Texturen liegen unter public/assets/textures (CC0, ambientCG). Albedo-Texturen werden beim Laden
// "neutralisiert" (Luminanz, Mittelwert → 1), damit sie mit beliebigen Produktfarben eingefärbt werden können.

const BASE = import.meta.env.BASE_URL;

export type TexKey =
  | "oak"
  | "walnut"
  | "darkwood"
  | "burl"
  | "boucle"
  | "linen"
  | "velvet"
  | "fabric"
  | "weave"
  | "wool"
  | "leather"
  | "marble"
  | "marblewhite"
  | "marblegreen"
  | "travertine"
  | "plaster"
  | "limewash"
  | "concrete"
  | "rattan"
  | "brushed"
  | "oakfine";

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

export function texUrl(key: TexKey, kind: "color" | "normal" | "rough"): string {
  return `${BASE}assets/textures/${key}_${kind}.webp`;
}

const neutralCache = new Map<string, Promise<HTMLCanvasElement>>();

/** Mittelwert der neutralisierten Albedos (sRGB 0–255); Materialfarben werden mit ALBEDO_GAIN ausgeglichen. */
export const NEUTRAL_MEAN = 220;
export const ALBEDO_GAIN = 1 / Math.pow(NEUTRAL_MEAN / 255, 2.2);

/** Luminanz-normalisiertes Albedo (Mittelwert = NEUTRAL_MEAN, Struktur ± contrast). */
export function neutralAlbedo(key: TexKey, contrast = 1, mean = NEUTRAL_MEAN): Promise<HTMLCanvasElement> {
  const ck = `${key}|${contrast}|${mean}`;
  let p = neutralCache.get(ck);
  if (!p) {
    p = loadImage(texUrl(key, "color")).then((img) => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      const a = d.data;
      let sum = 0;
      const n = a.length / 4;
      for (let i = 0; i < a.length; i += 4) sum += 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
      const mean = sum / n || 1;
      for (let i = 0; i < a.length; i += 4) {
        const l = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
        let v = 1 + (l / mean - 1) * contrast;
        v = Math.max(0, v) * mean;
        a[i] = a[i + 1] = a[i + 2] = Math.min(255, v);
        a[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      return c;
    });
    neutralCache.set(ck, p);
  }
  return p;
}

const texLoader = new THREE.TextureLoader();
const dataTexCache = new Map<string, THREE.Texture>();

/** Normal- oder Rauheitstextur (linear), gekachelt. */
// Offene Texturladevorgänge (für Vorschaubilder: erst rendern, wenn alles geladen ist)
let pendingLoads = 0;
const idleWaiters: (() => void)[] = [];
function trackStart() {
  pendingLoads++;
}
function trackEnd() {
  pendingLoads = Math.max(0, pendingLoads - 1);
  if (pendingLoads === 0) while (idleWaiters.length) idleWaiters.shift()!();
}
/** Löst auf, sobald keine Textur mehr lädt. */
export function texturesIdle(): Promise<void> {
  return pendingLoads === 0 ? Promise.resolve() : new Promise((r) => idleWaiters.push(r));
}

export function dataTexture(key: TexKey, kind: "normal" | "rough"): THREE.Texture {
  const k = `${key}|${kind}`;
  let t = dataTexCache.get(k);
  if (!t) {
    trackStart();
    t = texLoader.load(texUrl(key, kind), trackEnd, undefined, trackEnd);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 8;
    dataTexCache.set(k, t);
  }
  return t;
}

const albedoTexCache = new Map<string, THREE.Texture>();

export function albedoTexture(key: TexKey, contrast = 1): THREE.Texture {
  const k = `${key}|${contrast}`;
  let t = albedoTexCache.get(k);
  if (!t) {
    const tex = new THREE.Texture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    trackStart();
    neutralAlbedo(key, contrast)
      .then((c) => {
        tex.image = c;
        tex.needsUpdate = true;
      })
      .finally(trackEnd);
    albedoTexCache.set(k, tex);
    t = tex;
  }
  return t;
}

// ---------------------------------------------------------------- prozedurale Muster
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = (x: number) => Math.max(0, Math.min(255, Math.round(x * f)));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}

/** Normalmap aus Höhenfeld (Canvas, Graustufen). */
export function heightToNormal(src: HTMLCanvasElement, strength = 2): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const g = src.getContext("2d", { willReadFrequently: true })!;
  const d = g.getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const og = out.getContext("2d")!;
  const od = og.createImageData(w, h);
  const H = (x: number, y: number) => d[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * w + x) * 4;
      od.data[i] = (-dx * nz * 0.5 + 0.5) * 255;
      od.data[i + 1] = (dy * nz * 0.5 + 0.5) * 255;
      od.data[i + 2] = nz * 255;
      od.data[i + 3] = 255;
    }
  }
  og.putImageData(od, 0, 0);
  return out;
}

const procCache = new Map<string, { map: THREE.Texture; normal?: THREE.Texture; size: [number, number] }>();

function canvasTex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Dielenboden (Natureiche L 1,90 m), Fischgrät, Chevron, Deck: Komposition aus Holzmaserung.
 * Liefert Textur + Kachelgröße in Metern.
 */
export function floorTexture(kind: string, color: string, plankL = 1.9, plankW = 0.19, color2?: string, tile = 0.6) {
  const key = `${kind}|${color}|${plankL}|${plankW}|${color2}|${tile}`;
  const hit = procCache.get(key);
  if (hit) return hit;
  const PX = 512; // Pixel je Meter
  let sizeX = 2 * plankL;
  let sizeY = Math.round(2.0 / plankW) * plankW;
  if (kind === "herringbone" || kind === "chevron") {
    sizeX = 1.2;
    sizeY = 1.2;
  }
  if (kind === "tiles" || kind === "stone") {
    sizeX = sizeY = tile * 2;
  }
  if (kind === "deck") {
    sizeX = 2.4;
    sizeY = plankW * 12;
  }
  if (kind === "terrazzo") {
    sizeX = sizeY = 1.2;
  }
  if (kind === "slats") {
    sizeX = plankL;
    sizeY = Math.round(1.2 / (plankW + 0.015)) * (plankW + 0.015);
  }
  const c = document.createElement("canvas");
  c.width = Math.round(sizeX * PX);
  c.height = Math.round(sizeY * PX);
  const g = c.getContext("2d")!;
  const hc = document.createElement("canvas");
  hc.width = c.width;
  hc.height = c.height;
  const hg = hc.getContext("2d")!;
  hg.fillStyle = "#808080";
  hg.fillRect(0, 0, hc.width, hc.height);
  const tex = canvasTex(c);
  const ntex = canvasTex(hc, false);
  const res = { map: tex, normal: ntex, size: [sizeX, sizeY] as [number, number] };
  procCache.set(key, res);

  const draw = (grain: HTMLCanvasElement | null) => {
    const R = rng(1234);
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    const plank = (x: number, y: number, w: number, h: number, rotate: number) => {
      const tint = 0.94 + R() * 0.12;
      g.save();
      g.translate(x, y);
      g.rotate(rotate);
      g.beginPath();
      g.rect(0, 0, w, h);
      g.clip();
      g.fillStyle = shade(color, tint);
      g.fillRect(0, 0, w, h);
      if (grain) {
        // schmaler Streifen der Maserung, längs zur Diele (Maserung der Quelle verläuft horizontal)
        g.globalCompositeOperation = "multiply";
        const sh = Math.max(8, grain.width * (h / w) * 0.9);
        const sy = R() * (grain.height - sh);
        const flip = R() > 0.5;
        if (flip) {
          g.translate(w, 0);
          g.scale(-1, 1);
        }
        g.drawImage(grain, 0, sy, grain.width, sh, 0, 0, w, h);
        g.globalCompositeOperation = "source-over";
      }
      g.restore();
      // Fugen in Höhenkarte
      hg.save();
      hg.translate(x, y);
      hg.rotate(rotate);
      hg.strokeStyle = "#303030";
      hg.lineWidth = 2;
      hg.strokeRect(0, 0, w, h);
      hg.restore();
      g.save();
      g.translate(x, y);
      g.rotate(rotate);
      g.strokeStyle = shade(color, 0.7);
      g.globalAlpha = 0.45;
      g.lineWidth = 1;
      g.strokeRect(0.5, 0.5, w - 1, h - 1);
      g.restore();
      g.globalAlpha = 1;
    };
    if (kind === "planks" || kind === "deck") {
      const L = kind === "deck" ? 1.2 * PX : plankL * PX;
      const W = plankW * PX;
      const rows = Math.round(c.height / W);
      for (let r = 0; r < rows; r++) {
        const off = ((r * 0.37) % 1) * L;
        for (let x = -off; x < c.width; x += L) {
          plank(x, r * W, L, W, 0);
          if (x + L > c.width) plank(x - c.width, r * W, L, W, 0);
        }
      }
    } else if (kind === "herringbone" || kind === "chevron") {
      const L = 0.6 * PX;
      const W = 0.1 * PX;
      for (let y = -L; y < c.height + L; y += W * 2) {
        for (let x = -L; x < c.width + L; x += L * 0.7071 * 2) {
          plank(x, y, L, W, Math.PI / 4);
          plank(x + L * 0.7071, y + L * 0.7071 - W * 0.7, L, W, -Math.PI / 4);
        }
      }
    } else if (kind === "tiles" || kind === "stone") {
      const T = tile * PX;
      for (let y = 0; y < c.height; y += T) {
        for (let x = 0; x < c.width; x += T) {
          const tint = 0.95 + R() * 0.08;
          g.fillStyle = shade(color, tint);
          g.fillRect(x, y, T, T);
          if (grain) {
            g.globalCompositeOperation = "multiply";
            g.globalAlpha = 0.5;
            g.drawImage(grain, R() * 200, R() * 200, 300, 300, x, y, T, T);
            g.globalAlpha = 1;
            g.globalCompositeOperation = "source-over";
          }
          g.strokeStyle = color2 ?? shade(color, 0.8);
          g.lineWidth = 3;
          g.strokeRect(x, y, T, T);
          hg.strokeStyle = "#202020";
          hg.lineWidth = 4;
          hg.strokeRect(x, y, T, T);
        }
      }
    } else if (kind === "slats") {
      // Holzlamellendecke: Lamellen mit dunkler Schattenfuge (Akustikfilz)
      g.fillStyle = "#1b1a19";
      g.fillRect(0, 0, c.width, c.height);
      const W = plankW * PX, gap = 0.015 * PX;
      for (let y = 0; y < c.height; y += W + gap) plank(0, y, c.width, W, 0);
    } else if (kind === "terrazzo") {
      // Terrazzo: Grundmasse + Zuschlag in Grund-, Kontrast- und Akzentfarbe
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
      const chips = [shade(color, 0.72), shade(color, 1.12), color2 ?? "#9a8f82", shade(color2 ?? "#9a8f82", 0.7), "#f4f1ea"];
      for (let i = 0; i < 2600; i++) {
        const x = R() * c.width, y = R() * c.height, r = 2 + R() * R() * 16;
        g.fillStyle = chips[Math.floor(R() * chips.length)];
        g.beginPath();
        const n = 5 + Math.floor(R() * 3);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2, rr = r * (0.6 + R() * 0.5);
          if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.fill();
      }
    } else if (kind === "carpet") {
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
    } else if (kind === "microcement") {
      if (grain) {
        g.globalCompositeOperation = "multiply";
        g.drawImage(grain, 0, 0, c.width, c.height);
        g.globalCompositeOperation = "source-over";
      }
    }
    tex.needsUpdate = true;
    const n = heightToNormal(hc, 3);
    ntex.image = n;
    ntex.needsUpdate = true;
  };
  const src: TexKey | null = kind === "tiles" ? "concrete" : kind === "stone" ? "travertine" : kind === "microcement" ? "concrete" : kind === "carpet" ? null : "oakfine";
  if (src) neutralAlbedo(src, kind === "planks" || kind === "deck" ? 1.1 : 0.6, 236).then(draw);
  else draw(null);
  return res;
}

/** Tapeten-/Fliesen-/Paneelmuster für Wandflächen. */
export function wallPatternTexture(kind: string, pattern: string | undefined, color: string, color2: string | undefined, scale = 1) {
  const key = `${kind}|${pattern}|${color}|${color2}|${scale}`;
  const hit = procCache.get(key);
  if (hit) return hit;
  const c2 = color2 ?? shade(color, 0.82);
  let size: [number, number] = [0.6 * scale, 0.6 * scale];
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  const hc = document.createElement("canvas");
  hc.width = hc.height = 512;
  const hg = hc.getContext("2d")!;
  hg.fillStyle = "#808080";
  hg.fillRect(0, 0, 512, 512);
  g.fillStyle = color;
  g.fillRect(0, 0, 512, 512);
  if (kind === "wallpaper") {
    g.fillStyle = c2;
    g.strokeStyle = c2;
    const p = pattern ?? "stripes";
    if (p === "stripes") {
      for (let x = 0; x < 512; x += 64) g.fillRect(x, 0, 24, 512);
      size = [0.53 * scale, 0.53 * scale];
    } else if (p === "pinstripe") {
      for (let x = 0; x < 512; x += 32) g.fillRect(x, 0, 3, 512);
      size = [0.4 * scale, 0.4 * scale];
    } else if (p === "arches") {
      g.lineWidth = 10;
      for (let x = 0; x <= 512; x += 128)
        for (let y = 64; y <= 576; y += 128) {
          g.beginPath();
          g.arc(x + 64, y, 48, Math.PI, 0);
          g.lineTo(x + 112, y + 60);
          g.moveTo(x + 16, y);
          g.lineTo(x + 16, y + 60);
          g.stroke();
        }
      size = [0.5 * scale, 0.5 * scale];
    } else if (p === "grid") {
      g.lineWidth = 3;
      for (let x = 0; x <= 512; x += 64) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, 512);
        g.moveTo(0, x);
        g.lineTo(512, x);
        g.stroke();
      }
    } else if (p === "dots") {
      for (let x = 32; x < 512; x += 64) for (let y = 32; y < 512; y += 64) {
        g.beginPath();
        g.arc(x + ((y / 64) % 2) * 32, y, 7, 0, Math.PI * 2);
        g.fill();
      }
    } else if (p === "leaves") {
      const R = rng(7);
      g.globalAlpha = 0.85;
      for (let i = 0; i < 70; i++) {
        const x = R() * 512;
        const y = R() * 512;
        const a = R() * Math.PI * 2;
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.beginPath();
        g.ellipse(0, 0, 34, 11, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
      size = [0.7 * scale, 0.7 * scale];
    } else if (p === "linen") {
      const R = rng(3);
      for (let i = 0; i < 4000; i++) {
        g.globalAlpha = 0.06;
        g.fillRect(R() * 512, 0, 1, 512);
        g.fillRect(0, R() * 512, 512, 1);
      }
      g.globalAlpha = 1;
    }
  } else if (kind === "tiles") {
    const p = pattern ?? "large";
    const ts = p === "subway" ? [128, 64] : p === "small" ? [64, 64] : [256, 256];
    size = p === "subway" ? [0.3 * scale, 0.3 * scale] : p === "small" ? [0.2 * scale, 0.2 * scale] : [1.2 * scale, 1.2 * scale];
    const R = rng(9);
    for (let y = 0, row = 0; y < 512; y += ts[1], row++) {
      for (let x = p === "subway" && row % 2 ? -ts[0] / 2 : 0; x < 512; x += ts[0]) {
        g.fillStyle = shade(color, 0.97 + R() * 0.06);
        g.fillRect(x, y, ts[0], ts[1]);
        g.strokeStyle = c2;
        g.lineWidth = 3;
        g.strokeRect(x, y, ts[0], ts[1]);
        hg.strokeStyle = "#202020";
        hg.lineWidth = 5;
        hg.strokeRect(x, y, ts[0], ts[1]);
      }
    }
  } else if (kind === "woodPanel") {
    for (let x = 0; x < 512; x += 64) {
      g.fillStyle = shade(color, 0.95 + ((x / 64) % 3) * 0.03);
      g.fillRect(x, 0, 64, 512);
      hg.fillStyle = "#303030";
      hg.fillRect(x, 0, 3, 512);
    }
    size = [0.8 * scale, 0.8 * scale];
  }
  const res = { map: canvasTex(c), normal: canvasTex(heightToNormal(hc, 3), false), size };
  procCache.set(key, res);
  return res;
}

/** Normalmap für Cord (Rippen) und Riffelglas. */
export function ribNormal(period = 16): THREE.Texture {
  const key = `rib|${period}`;
  const hit = procCache.get(key);
  if (hit) return hit.map;
  const hc = document.createElement("canvas");
  hc.width = hc.height = 128;
  const hg = hc.getContext("2d")!;
  for (let x = 0; x < 128; x++) {
    const v = 128 + 110 * Math.sin((x / period) * Math.PI * 2);
    hg.fillStyle = `rgb(${v},${v},${v})`;
    hg.fillRect(x, 0, 1, 128);
  }
  const t = canvasTex(heightToNormal(hc, 1.5), false);
  procCache.set(key, { map: t, size: [1, 1] });
  return t;
}

/** Gemälde/Druck (abstrakt, je Motiv) als Leinwandtextur. */
export function artTexture(motif: string, c1: string, c2: string, seed = 1): THREE.Texture {
  const key = `art|${motif}|${c1}|${c2}|${seed}`;
  const hit = procCache.get(key);
  if (hit) return hit.map;
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 512;
  const g = c.getContext("2d")!;
  const R = rng(seed * 97 + motif.length * 13);
  g.fillStyle = c1;
  g.fillRect(0, 0, c.width, c.height);
  const strokes = (n: number, col: string, wmin: number, wmax: number, alpha = 0.6) => {
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha * (0.4 + R() * 0.6);
      g.strokeStyle = col;
      g.lineWidth = wmin + R() * (wmax - wmin);
      g.lineCap = "round";
      g.beginPath();
      const x = R() * c.width;
      const y = R() * c.height;
      g.moveTo(x, y);
      g.bezierCurveTo(x + (R() - 0.5) * 300, y + (R() - 0.5) * 200, x + (R() - 0.5) * 300, y + (R() - 0.5) * 200, x + (R() - 0.5) * 260, y + (R() - 0.5) * 260);
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  switch (motif) {
    case "bluestroke":
    case "blueplay":
      strokes(26, c2, 18, 60, 0.75);
      strokes(10, shade(c2, 1.5), 8, 30, 0.5);
      break;
    case "growing": {
      g.strokeStyle = c2;
      g.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        const x = 60 + R() * 260;
        g.moveTo(x, 500);
        g.quadraticCurveTo(x + (R() - 0.5) * 120, 300, x + (R() - 0.5) * 160, 80 + R() * 120);
        g.stroke();
        g.fillStyle = shade(c2, 1.1);
        g.beginPath();
        g.ellipse(x + (R() - 0.5) * 80, 120 + R() * 200, 18, 8, R() * 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "everlast":
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? c2 : shade(c1, 0.85);
        g.globalAlpha = 0.7;
        g.beginPath();
        g.arc(80 + R() * 220, 80 + R() * 350, 40 + R() * 90, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      strokes(8, "#8d8d8a", 2, 6, 0.6);
      break;
    default: {
      // gestische Farbflächen (Scenario, Vibranium, Rust, Green Petite …)
      for (let i = 0; i < 14; i++) {
        g.globalAlpha = 0.25 + R() * 0.5;
        g.fillStyle = R() > 0.5 ? c2 : shade(c1, 0.75 + R() * 0.4);
        g.fillRect(R() * c.width - 60, R() * c.height - 60, 80 + R() * 220, 40 + R() * 180);
      }
      g.globalAlpha = 1;
      strokes(18, c2, 6, 26, 0.55);
    }
  }
  // Leinwandstruktur
  const R2 = rng(5);
  g.globalAlpha = 0.05;
  g.fillStyle = "#000";
  for (let i = 0; i < 3000; i++) g.fillRect(R2() * c.width, R2() * c.height, 1, 1);
  g.globalAlpha = 1;
  const t = canvasTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  procCache.set(key, { map: t, size: [1, 1] });
  return t;
}

/** Teppichmuster (Relief, Ringe, geflochten, Kiesel). */
export function rugTexture(pattern: string, color: string, color2?: string): { map: THREE.Texture; normal: THREE.Texture } {
  const key = `rug|${pattern}|${color}|${color2}`;
  const hit = procCache.get(key);
  if (hit) return { map: hit.map, normal: hit.normal! };
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const hc = document.createElement("canvas");
  hc.width = hc.height = 512;
  const hg = hc.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, 512, 512);
  hg.fillStyle = "#808080";
  hg.fillRect(0, 0, 512, 512);
  const R = rng(11);
  const c2 = color2 ?? shade(color, 0.9);
  if (pattern === "braided") {
    for (let y = 0; y < 512; y += 16)
      for (let x = 0; x < 512; x += 32) {
        hg.fillStyle = (x / 32 + y / 16) % 2 ? "#b0b0b0" : "#606060";
        hg.fillRect(x, y, 32, 16);
        g.fillStyle = shade(color, (x / 32 + y / 16) % 2 ? 1.03 : 0.95);
        g.fillRect(x, y, 32, 16);
      }
  } else if (pattern === "relief") {
    for (let i = 0; i < 40; i++) {
      hg.strokeStyle = "#b8b8b8";
      hg.lineWidth = 6 + R() * 10;
      hg.beginPath();
      const y = R() * 512;
      hg.moveTo(0, y);
      hg.bezierCurveTo(170, y + (R() - 0.5) * 120, 340, y + (R() - 0.5) * 120, 512, y);
      hg.stroke();
    }
    if (color2) {
      g.strokeStyle = c2;
      g.globalAlpha = 0.55;
      for (let i = 0; i < 6; i++) {
        g.lineWidth = 10 + R() * 20;
        g.beginPath();
        const y = R() * 512;
        g.moveTo(0, y);
        g.bezierCurveTo(170, y + (R() - 0.5) * 150, 340, y + (R() - 0.5) * 150, 512, y);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  } else if (pattern === "rings") {
    for (let r = 20; r < 380; r += 24) {
      hg.strokeStyle = r % 48 ? "#a8a8a8" : "#585858";
      hg.lineWidth = 10;
      hg.beginPath();
      hg.arc(256, 256, r, 0, Math.PI * 2);
      hg.stroke();
    }
  } else if (pattern === "pebble") {
    for (let i = 0; i < 160; i++) {
      hg.fillStyle = `rgb(${150 + R() * 60},${150 + R() * 60},${150 + R() * 60})`;
      hg.beginPath();
      hg.ellipse(R() * 512, R() * 512, 10 + R() * 18, 7 + R() * 12, R() * 3, 0, Math.PI * 2);
      hg.fill();
    }
  } else if (pattern === "zigzag") {
    g.strokeStyle = c2;
    g.lineWidth = 14;
    for (let y = 0; y < 560; y += 64) {
      g.beginPath();
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + ((x / 32) % 2) * 28);
      g.stroke();
    }
  }
  // Flor
  for (let i = 0; i < 9000; i++) {
    const v = 110 + R() * 40;
    hg.fillStyle = `rgba(${v},${v},${v},0.25)`;
    hg.fillRect(R() * 512, R() * 512, 2, 2);
  }
  const res = { map: canvasTex(c), normal: canvasTex(heightToNormal(hc, 2.5), false), size: [1, 1] as [number, number] };
  procCache.set(key, res);
  return { map: res.map, normal: res.normal };
}
