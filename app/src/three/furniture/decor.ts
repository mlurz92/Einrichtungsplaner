import * as THREE from "three";
import { BLACK, bool, num, rng, str, type Ctx } from "./common";
import { getMaterial } from "../materials";
import { artTexture, rugTexture } from "../textures";
import { organicShape, roundRectShape } from "../geom";
import { wallClipPlanes } from "../surfaces";

// ---------------------------------------------------------------- Teppiche
function rugMaterial(c: Ctx, w: number, d: number) {
  const s = c.slots.main ?? { color: "#dcd6cb", material: "wool" };
  const pattern = str(c.p, "pattern", "plain");
  const base = getMaterial(s) as THREE.MeshPhysicalMaterial;
  if (pattern === "plain") return base;
  const key = `${pattern}|${s.color}|${c.p.color2 ?? ""}|${w.toFixed(2)}|${d.toFixed(2)}`;
  const hit = rugCache.get(key);
  if (hit) return hit;
  const t = rugTexture(pattern, s.color, c.p.color2 as string | undefined);
  const m = base.clone();
  m.color.set("#ffffff");
  m.map = t.map.clone();
  m.normalMap = t.normal.clone();
  const tile = pattern === "rings" ? w : 0.8;
  m.map.repeat.set(1 / tile, 1 / tile);
  m.normalMap.repeat.set(1 / tile, 1 / tile);
  if (pattern === "rings") {
    m.map.offset.set(0.5, 0.5);
    m.normalMap.offset.set(0.5, 0.5);
  }
  m.map.needsUpdate = m.normalMap.needsUpdate = true;
  rugCache.set(key, m);
  return m;
}
const rugCache = new Map<string, THREE.MeshPhysicalMaterial>();

export function rugRect(c: Ctx) {
  const { w, d, h, b } = c;
  b.extrudeXZ(roundRectShape(w, d, 0.01), Math.max(0.006, h), rugMaterial(c, w, d), 0, 0.002);
}
export function rugRound(c: Ctx) {
  const { w, h, b } = c;
  b.cyl(w / 2, w / 2, Math.max(0.006, h), rugMaterial(c, w, w), 0, 0, 0, 96);
}
export function rugOrganic(c: Ctx) {
  const { w, d, h, b } = c;
  b.extrudeXZ(organicShape(w, d, 2), Math.max(0.006, h), rugMaterial(c, w, d), 0, 0.002);
}

// ---------------------------------------------------------------- Vorhänge
/** Fläche mit Wellenfalten; x0..x1 entlang Breite, Höhe h, Wellenamplitude a. */
function pleated(width: number, height: number, amp: number, folds: number, mat: THREE.Material): THREE.Mesh {
  const segX = Math.max(8, folds * 8);
  const g = new THREE.PlaneGeometry(width, height, segX, 4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = (x + width / 2) / width;
    pos.setZ(i, Math.sin(t * folds * Math.PI * 2) * amp);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const curtainMatCache = new Map<string, THREE.Material>();
function curtainMat(c: Ctx, slot: "main" | "secondary", sheer: boolean) {
  const s = c.slots[slot] ?? { color: "#f4f1ea", material: "linen" };
  const key = `${s.color}|${s.material}|${sheer}`;
  let m = curtainMatCache.get(key);
  if (!m) {
    const base = (getMaterial(s) as THREE.MeshPhysicalMaterial).clone();
    base.side = THREE.DoubleSide;
    base.clippingPlanes = wallClipPlanes;
    if (sheer) {
      base.transparent = true;
      base.opacity = 0.72;
      base.depthWrite = false;
    }
    m = base;
    curtainMatCache.set(key, m);
  }
  return m;
}

/** Vorhang an Deckenschiene: lokale Breite = Schienenlänge, Vorderseite (+Z) in den Raum. */
export function curtain(c: Ctx) {
  const { w, d, h, p, b } = c;
  const layers = Math.max(1, Math.round(num(p, "layers", 1)));
  const open = Math.max(0, Math.min(1, num(p, "open", 0.85)));
  const sheer = bool(p, "sheer", true);
  // Schiene
  b.box(w, 0.02, 0.03 * layers, getMaterial({ color: "#f2f1ed", material: "matte" }), 0, h, 0);
  for (let L = 0; L < layers; L++) {
    const front = L === 0;
    const mat = curtainMat(c, front ? "main" : "secondary", front && sheer);
    const z = (front ? 1 : -1) * (layers > 1 ? d / 4 : 0);
    const stack = Math.max(0.18, (w / 2) * (1 - open));
    const panelW = open > 0.99 ? 0 : stack;
    for (const sx of [-1, 1]) {
      const pw = Math.max(0.16, panelW);
      const m = pleated(pw, h - 0.02, front ? 0.035 : 0.045, Math.max(3, Math.round(pw / 0.09)), mat);
      m.position.set(sx * (w / 2 - pw / 2), (h - 0.02) / 2, z);
      b.object(m);
    }
  }
}

// ---------------------------------------------------------------- Kunst, Spiegel
export function art(c: Ctx) {
  const { w, d, h, p, b } = c;
  const s1 = c.slots.main ?? { color: "#e1d6c4", material: "canvas" };
  const s2 = c.slots.secondary ?? { color: "#8f8576", material: "canvas" };
  const frame = c.m("frame", { color: "#b38c60", material: "oak" });
  const motif = str(p, "motif", "abstract");
  const tex = artTexture(motif, s1.color, s2.color, Math.round(c.seed * 13) % 97);
  const canvasMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const noFrame = bool(p, "noFrame");
  const fw = noFrame ? 0 : 0.025;
  const depth = Math.max(0.02, d);
  if (!noFrame) {
    b.box(w, fw, depth, frame, 0, 0, 0);
    b.box(w, fw, depth, frame, 0, h - fw, 0);
    b.box(fw, h - 2 * fw, depth, frame, -w / 2 + fw / 2, fw, 0);
    b.box(fw, h - 2 * fw, depth, frame, w / 2 - fw / 2, fw, 0);
  }
  const mat = bool(p, "mat") ? 0.06 : 0;
  if (mat) b.box(w - 2 * fw, h - 2 * fw, 0.004, getMaterial({ color: "#f6f3ec", material: "paper" }), 0, fw, depth / 2 - 0.006);
  const pw = w - 2 * fw - 2 * mat;
  const ph = h - 2 * fw - 2 * mat;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), canvasMat);
  plane.position.set(0, h / 2, depth / 2 - 0.002);
  plane.receiveShadow = true;
  b.object(plane);
  b.box(pw, ph, depth - 0.006, getMaterial({ color: s1.color, material: "canvas" }), 0, fw + mat, -0.003);
}

const mirrorMat = () => getMaterial({ color: "#f4f6f8", material: "mirror" });

export function mirrorRound(c: Ctx) {
  const { w, d, h, p, b } = c;
  const F = c.m("frame", { color: "#6b4a33", material: "walnut" });
  const r = Math.min(w, h) / 2;
  b.cyl(r, r, Math.max(0.015, d), F, 0, h / 2, 0, 64, Math.PI / 2);
  b.cyl(r - 0.03, r - 0.03, 0.004, mirrorMat(), 0, h / 2, d / 2 - 0.002, 64, Math.PI / 2);
  if (bool(p, "rays")) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      b.box(0.006, 0.05, 0.006, F, Math.cos(a) * (r + 0.02), h / 2 + Math.sin(a) * (r + 0.02) - 0.025, 0);
    }
  }
}

export function mirrorArch(c: Ctx) {
  const { w, d, h, b } = c;
  const F = c.m("frame", { color: "#c9a55c", material: "brass" });
  const r = w / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-r, 0);
  shape.lineTo(r, 0);
  shape.lineTo(r, h - r);
  shape.absarc(0, h - r, r, 0, Math.PI, false);
  shape.lineTo(-r, 0);
  const inner = new THREE.Path();
  const ri = r - 0.02;
  inner.moveTo(-ri, 0.02);
  inner.lineTo(ri, 0.02);
  inner.lineTo(ri, h - r);
  inner.absarc(0, h - r, ri, 0, Math.PI, false);
  inner.lineTo(-ri, 0.02);
  shape.holes.push(inner);
  b.extrudeXY(shape, Math.max(0.015, d), F, 0);
  const ms = new THREE.Shape(inner.getPoints(48));
  b.extrudeXY(ms, 0.004, mirrorMat(), d / 2 - 0.006);
}

export function mirrorRect(c: Ctx) {
  const { w, d, h, b } = c;
  const F = c.m("frame", BLACK);
  b.box(w, h, Math.max(0.015, d), F, 0, 0, 0);
  b.box(w - 0.03, h - 0.03, 0.004, mirrorMat(), 0, 0.015, d / 2);
}

// ---------------------------------------------------------------- Pflanzen
let leafTex: THREE.Texture | null = null;
function leafTexture() {
  if (leafTex) return leafTex;
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(62, 40, 58, 96, 32, 124);
  g.bezierCurveTo(6, 96, 2, 40, 32, 4);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(32, 8);
  g.lineTo(32, 120);
  g.stroke();
  leafTex = new THREE.CanvasTexture(cv);
  leafTex.colorSpace = THREE.SRGBColorSpace;
  return leafTex;
}

function foliage(c: Ctx, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, count: number, leafL: number, color: string, seed: number) {
  const R = rng(seed);
  const geo = new THREE.PlaneGeometry(leafL * 0.45, leafL);
  geo.translate(0, leafL / 2, 0);
  const mat = new THREE.MeshStandardMaterial({ color, map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // Punkt im Ellipsoid
    let x, y, z;
    do {
      x = R() * 2 - 1;
      y = R() * 2 - 1;
      z = R() * 2 - 1;
    } while (x * x + y * y + z * z > 1);
    q.setFromEuler(new THREE.Euler((R() - 0.5) * 2.2, R() * Math.PI * 2, (R() - 0.5) * 2.2));
    const s = 0.7 + R() * 0.6;
    m.compose(new THREE.Vector3(cx + x * rx, cy + y * ry, cz + z * rz), q, new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, m);
    col.set(color).offsetHSL((R() - 0.5) * 0.04, (R() - 0.5) * 0.1, (R() - 0.5) * 0.12);
    inst.setColorAt(i, col);
  }
  inst.castShadow = true;
  inst.receiveShadow = true;
  c.b.object(inst);
}

function pot(c: Ctx, d: number, h: number, shape = "round") {
  const P = c.m("secondary", { color: "#d8ccb6", material: "ceramic" });
  if (shape === "hourglass") c.b.lathe([[0, 0], [d * 0.42, 0], [d * 0.5, h * 0.12], [d * 0.28, h * 0.5], [d * 0.5, h * 0.92], [d * 0.48, h], [d * 0.4, h * 0.95], [0, h * 0.95]], P);
  else c.b.lathe([[0, 0], [d * 0.38, 0], [d * 0.5, h * 0.85], [d * 0.5, h], [d * 0.44, h], [d * 0.44, h * 0.92], [0, h * 0.92]], P);
  c.b.cyl(d * 0.43, d * 0.43, 0.005, getMaterial({ color: "#4a3a2c", material: "matte" }), 0, h * 0.9, 0, 24);
}

export function plantTree(c: Ctx) {
  const { w, h, p, b } = c;
  const species = str(p, "species", "olive");
  const leaf = (c.slots.main?.color ?? "#5b6e45");
  const potD = num(p, "potD", 0.34);
  const potH = num(p, "potH", 0.36);
  const hasPot = bool(p, "pot", true);
  const base = hasPot ? potH * 0.9 : 0;
  if (hasPot) pot(c, potD, potH);
  const trunk = getMaterial({ color: "#6d5a45", material: "oakDark" });
  const crownY = base + (h - base) * (species === "moneytree" ? 0.62 : 0.68);
  const R = rng(c.seed + 11);
  const stems = species === "moneytree" ? 5 : 3;
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2 + R();
    const tx = Math.cos(a) * w * 0.08;
    const tz = Math.sin(a) * w * 0.08;
    b.object(polyTubeLocal([new THREE.Vector3(0, base, 0), new THREE.Vector3(tx * 0.5, base + (crownY - base) * 0.6, tz * 0.5), new THREE.Vector3(tx, crownY, tz)], 0.012 + R() * 0.01, trunk));
  }
  if (species === "moneytree") {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      foliage(c, Math.cos(a) * w * 0.22, crownY + (R() - 0.3) * 0.4, Math.sin(a) * w * 0.22, w * 0.18, 0.18, w * 0.18, 70, 0.11, leaf, c.seed + k);
    }
  } else if (species === "ficus") {
    foliage(c, 0, crownY + 0.15, 0, w * 0.35, (h - crownY) * 0.9, w * 0.35, 160, 0.2, "#3f5a2f", c.seed);
  } else {
    foliage(c, 0, crownY + (h - crownY) * 0.25, 0, w * 0.42, (h - crownY) * 0.8, w * 0.42, 700, 0.075, leaf, c.seed);
  }
}

function polyTubeLocal(points: THREE.Vector3[], r: number, mat: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, r, 6, false), mat);
  m.castShadow = true;
  return m;
}

export function plantBush(c: Ctx) {
  const { w, h, b } = c;
  pot(c, Math.min(w * 0.6, 0.3), Math.min(h * 0.35, 0.3));
  void b;
  foliage(c, 0, h * 0.62, 0, w * 0.45, h * 0.35, w * 0.45, 220, 0.12, c.slots.main?.color ?? "#56703f", c.seed);
}

export function plantPot(c: Ctx) {
  const { w, h, p } = c;
  const shape = str(p, "shape", "round");
  const orig = c.slots.secondary;
  c.slots.secondary = c.slots.main;
  pot(c, w, h, shape);
  c.slots.secondary = orig;
  if (bool(p, "plant")) foliage(c, 0, h + 0.12, 0, w * 0.55, 0.12, w * 0.55, 60, 0.08, "#4f6b3a", c.seed);
}

// ---------------------------------------------------------------- Kleinteile
export function vase(c: Ctx) {
  const { w, h, p, b } = c;
  const M = c.m("main", { color: "#ece3d2", material: "ceramic" });
  const r = w / 2;
  b.lathe([[0, 0], [r * 0.6, 0], [r, h * 0.35], [r * 0.8, h * 0.75], [r * 0.45, h * 0.92], [r * 0.5, h], [r * 0.42, h], [r * 0.36, h * 0.92], [0, h * 0.9]], M);
  if (bool(p, "branches") || bool(p, "pampas")) {
    const pampas = bool(p, "pampas");
    const col = pampas ? "#efe6d2" : "#6f7a52";
    const R = rng(c.seed + 5);
    for (let i = 0; i < (pampas ? 7 : 3); i++) {
      const a = R() * Math.PI * 2;
      const tip = new THREE.Vector3(Math.cos(a) * 0.15, h + 0.35 + R() * 0.3, Math.sin(a) * 0.15);
      b.object(polyTubeLocal([new THREE.Vector3(0, h * 0.8, 0), tip.clone().multiplyScalar(0.6).setY(h + 0.2), tip], 0.003, getMaterial({ color: "#7a6a52", material: "matte" })));
      if (pampas) b.sphere(0.04, getMaterial({ color: col, material: "wool" }), tip.x, tip.y, tip.z, 10, 2.4);
      else foliage(c, tip.x * 0.8, tip.y - 0.12, tip.z * 0.8, 0.06, 0.14, 0.06, 26, 0.05, col, c.seed + i);
    }
  }
  if (bool(p, "tray")) b.box(0.3, 0.02, 0.15, getMaterial({ color: "#e3d6c1", material: "marble" }), -0.2, 0, 0);
}

export function books(c: Ctx) {
  const { w, d, h, p, b } = c;
  const n = Math.max(1, Math.round(num(p, "count", 2)));
  const R = rng(c.seed + 2);
  const th = h / n;
  for (let i = 0; i < n; i++) {
    const col = i % 2 ? c.slots.secondary ?? c.slots.main : c.slots.main;
    b.box(w * (0.92 + R() * 0.08), th - 0.002, d * (0.9 + R() * 0.1), getMaterial(col ?? { color: "#ece6da", material: "paper" }), (R() - 0.5) * 0.02, i * th, (R() - 0.5) * 0.02, (R() - 0.5) * 0.15);
  }
  if (bool(p, "object")) b.sphere(0.06, getMaterial({ color: "#d9c7a8", material: "ceramic" }), 0, h + 0.06, 0, 20, 0.9);
}

export function tray(c: Ctx) {
  const { w, d, h, b } = c;
  const M = c.m("main", { color: "#e3d6c1", material: "marble" });
  b.extrudeXZ(roundRectShape(w, d, 0.02), 0.012, M, 0);
  const rim = roundRectShape(w, d, 0.02);
  const inner = roundRectShape(w - 0.024, d - 0.024, 0.014);
  rim.holes.push(new THREE.Path(inner.getPoints(24)));
  b.extrudeXZ(rim, h, M, 0);
}

export function bowl(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main", { color: "#d9cdb8", material: "marble" });
  const r = Math.min(w, d) / 2;
  if (bool(p, "footed")) b.lathe([[0, 0], [r * 0.3, 0], [r * 0.25, h * 0.35], [r, h * 0.9], [r * 0.95, h], [r * 0.9, h * 0.92], [0, h * 0.5]], M);
  else b.lathe([[0, 0], [r * 0.5, 0], [r, h * 0.8], [r * 0.97, h], [r * 0.9, h * 0.85], [0, h * 0.2]], M);
}

export function candles(c: Ctx) {
  const { w, h, b } = c;
  const M = c.m("main", { color: "#c9a55c", material: "brass" });
  b.cyl(w / 2, w * 0.55, 0.012, M, 0, 0, 0, 24);
  b.cyl(w * 0.12, w * 0.12, h * 0.6, M, 0, 0.012, 0, 16);
  b.cyl(w * 0.2, w * 0.15, 0.02, M, 0, h * 0.6, 0, 16);
  b.cyl(0.011, 0.011, h * 0.38, getMaterial({ color: "#f3efe6", material: "matte" }), 0, h * 0.62, 0, 12);
}

export function tv(c: Ctx) {
  const { w, h, b } = c;
  b.box(w, h, 0.03, getMaterial({ color: "#151515", material: "blackMetal" }), 0, 0, -0.005);
  b.box(w - 0.012, h - 0.012, 0.002, getMaterial({ color: "#050608", material: "gloss" }), 0, 0.006, 0.011);
}

/** Akustik-Lamellen (Holz auf Filz), d = Gesamttiefe. */
export function lamella(c: Ctx) {
  const { w, h, p, b } = c;
  const slat = num(p, "slat", 0.027);
  const gap = num(p, "gap", 0.0135);
  const W = c.m("main", { color: "#c9a273", material: "oak" });
  const F = c.m("secondary", { color: "#141414", material: "fabric" });
  b.box(w, h, 0.009, F, 0, 0, -0.006);
  const n = Math.floor((w + gap) / (slat + gap));
  const used = n * slat + (n - 1) * gap;
  for (let i = 0; i < n; i++) b.box(slat, h, 0.012, W, -used / 2 + slat / 2 + i * (slat + gap), 0, 0.0045);
}

/** Profilrahmen (Stuckleiste), optional Bogen. */
export function molding(c: Ctx) {
  const { w, h, p, b } = c;
  const M = c.m("main", { color: "#f3f0e8", material: "matte" });
  const t = num(p, "profile", 0.04);
  const depth = 0.019;
  if (bool(p, "arch")) {
    const r = w / 2;
    const outer = new THREE.Shape();
    outer.moveTo(-r, 0);
    outer.lineTo(-r, h - r);
    outer.absarc(0, h - r, r, Math.PI, 0, true);
    outer.lineTo(r, 0);
    outer.lineTo(r - t, 0);
    outer.lineTo(r - t, h - r);
    outer.absarc(0, h - r, r - t, 0, Math.PI, false);
    outer.lineTo(-r + t, 0);
    outer.lineTo(-r, 0);
    b.extrudeXY(outer, depth, M, 0, 0.003);
    return;
  }
  b.rbox(w, t, depth, 0.006, M, 0, 0, 0, 2);
  b.rbox(w, t, depth, 0.006, M, 0, h - t, 0, 2);
  b.rbox(t, h - 2 * t, depth, 0.006, M, -w / 2 + t / 2, t, 0, 2);
  b.rbox(t, h - 2 * t, depth, 0.006, M, w / 2 - t / 2, t, 0, 2);
}

/** Wandvertäfelung (Kassetten) mit Abschlussleiste. */
export function panelWall(c: Ctx) {
  const { w, h, p, b } = c;
  const M = c.m("main", { color: "#f3f0e8", material: "matte" });
  b.box(w, h, 0.008, M, 0, 0, -0.004);
  const n = Math.max(1, Math.round(w / 0.5));
  const pw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + pw * (i + 0.5);
    b.rbox(pw - 0.12, h - 0.22, 0.012, 0.004, M, x, 0.12, 0.004, 2);
  }
  if (bool(p, "rail", true)) b.rbox(w, 0.045, 0.03, 0.008, M, 0, h - 0.045, 0.01, 2);
  b.box(w, 0.08, 0.015, M, 0, 0, 0.004);
}

export function box(c: Ctx) {
  const { w, d, h, b } = c;
  b.rbox(w, h, d, 0.01, c.m("main"), 0, 0, 0);
}
