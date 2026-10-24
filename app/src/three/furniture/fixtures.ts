import * as THREE from "three";
import { BLACK, bool, num, tube, type Ctx } from "./common";
import { lightMarker } from "./lighting";
import { getMaterial } from "../materials";
import { roundRectShape } from "../geom";

/** Küchenzeile (Alno 2060, schematisch): Hochschränke, Unterschränke mit Arbeitsplatte, Spüle, Kochfeld, Oberschränke. */
export function kitchenRun(c: Ctx) {
  const { w, d, h, p, b } = c;
  const F = c.m("main", { color: "#4a3426", material: "walnut" });
  const G = c.m("secondary", { color: "#7f9a86", material: "lacquer" });
  const T = c.m("top", { color: "#e9e6df", material: "stone" });
  const D = c.m("detail", BLACK);
  const carcass = getMaterial({ color: "#2f2a26", material: "matte" });
  const tallW = num(p, "tallUnits", 1.2);
  const baseH = 0.9;
  const plinth = 0.1;
  // Hochschränke (hinten = Nordende → lokal links)
  const x0 = -w / 2;
  b.box(tallW, h - plinth, d, carcass, x0 + tallW / 2, plinth, 0);
  b.box(tallW, plinth, d - 0.06, getMaterial({ color: "#1d1d1d", material: "matte" }), x0 + tallW / 2, 0, -0.03);
  const tn = Math.round(tallW / 0.6);
  for (let i = 0; i < tn; i++) {
    const cx = x0 + (tallW / tn) * (i + 0.5);
    b.box(tallW / tn - 0.004, h - plinth - 0.004, 0.02, i % 2 ? F : G, cx, plinth + 0.002, d / 2 - 0.01);
    b.box(0.012, 0.6, 0.02, D, cx + (i % 2 ? -1 : 1) * (tallW / tn / 2 - 0.04), 1.0, d / 2 + 0.01);
  }
  // Unterschränke
  const runW = w - tallW;
  const rx = x0 + tallW + runW / 2;
  b.box(runW, baseH - plinth - 0.04, d, carcass, rx, plinth, 0);
  b.box(runW, plinth, d - 0.06, getMaterial({ color: "#1d1d1d", material: "matte" }), rx, 0, -0.03);
  const un = Math.max(2, Math.round(runW / 0.6));
  for (let i = 0; i < un; i++) {
    const cx = x0 + tallW + (runW / un) * (i + 0.5);
    const drawers = i % 2 === 0;
    if (drawers) {
      for (let j = 0; j < 3; j++) b.box(runW / un - 0.004, (baseH - plinth - 0.04) / 3 - 0.004, 0.02, F, cx, plinth + 0.002 + ((baseH - plinth - 0.04) / 3) * j, d / 2 - 0.01);
    } else b.box(runW / un - 0.004, baseH - plinth - 0.044, 0.02, F, cx, plinth + 0.002, d / 2 - 0.01);
  }
  // Arbeitsplatte
  b.box(runW, 0.04, d + 0.02, T, rx, baseH - 0.04, 0.01);
  // Spüle + Armatur
  const sinkX = x0 + tallW + runW * num(p, "sink", 0.55);
  b.box(0.5, 0.005, 0.4, getMaterial({ color: "#2a2a2a", material: "stone" }), sinkX, baseH + 0.001, 0.02);
  b.object(Object.assign(tube([new THREE.Vector3(sinkX, baseH, -d / 2 + 0.12), new THREE.Vector3(sinkX, baseH + 0.32, -d / 2 + 0.12), new THREE.Vector3(sinkX, baseH + 0.34, -d / 2 + 0.24), new THREE.Vector3(sinkX, baseH + 0.25, -d / 2 + 0.3)], 0.012, D)));
  // Kochfeld
  const hobX = x0 + tallW + runW * num(p, "hob", 0.25);
  b.box(0.6, 0.006, 0.5, getMaterial({ color: "#0d0d0d", material: "gloss" }), hobX, baseH, 0.0);
  // Oberschränke + Nischenrückwand
  if (bool(p, "upper", true)) {
    const uh = 0.72;
    const uy = h - uh;
    b.box(runW, uh, 0.35, carcass, rx, uy, -d / 2 + 0.175);
    const n2 = Math.max(2, Math.round(runW / 0.6));
    for (let i = 0; i < n2; i++) b.box(runW / n2 - 0.004, uh - 0.004, 0.02, G, x0 + tallW + (runW / n2) * (i + 0.5), uy + 0.002, -d / 2 + 0.36);
    b.box(runW, uy - baseH, 0.01, T, rx, baseH, -d / 2 + 0.005);
    // Dunstabzug-Ausschnitt unter Oberschrank
    b.box(0.6, 0.03, 0.3, getMaterial({ color: "#c6cbd0", material: "steel" }), hobX, uy - 0.03, -d / 2 + 0.16);
  }
}

export function washer(c: Ctx) {
  const { w, d, h, b } = c;
  const M = c.m("main", { color: "#f4f4f2", material: "gloss" });
  b.rbox(w, h, d, 0.02, M, 0, 0, 0);
  b.torus(0.17, 0.025, getMaterial({ color: "#c9c9c9", material: "chrome" }), 0, h * 0.45, d / 2 + 0.01, 0);
  b.cyl(0.15, 0.15, 0.01, c.m("detail", { color: "#2a2a2a", material: "glass" }), 0, h * 0.45, d / 2, 40, Math.PI / 2);
  b.box(w - 0.04, 0.1, 0.01, getMaterial({ color: "#e0e0de", material: "plastic" }), 0, h - 0.12, d / 2 + 0.002);
}

export function toilet(c: Ctx) {
  const { w, d, b } = c;
  const M = c.m("main", { color: "#f6f6f4", material: "ceramic" });
  const D = c.m("detail", BLACK);
  // Vorwand-Betätigungsplatte
  b.box(0.24, 0.16, 0.01, D, 0, 0.98, -d / 2 + 0.005);
  b.extrudeXZ(roundRectShape(w, d - 0.05, w * 0.48), 0.32, M, 0.08, 0.02);
  b.extrudeXZ(roundRectShape(w * 0.98, d - 0.07, w * 0.47), 0.025, getMaterial({ color: "#f2f2f0", material: "plastic" }), 0.41);
}

export function bathtub(c: Ctx) {
  const { w, d, h, b } = c;
  const M = c.m("main", { color: "#f6f6f4", material: "ceramic" });
  const outer = roundRectShape(w, d, 0.06);
  const inner = roundRectShape(w - 0.12, d - 0.12, 0.18);
  outer.holes.push(new THREE.Path(inner.getPoints(48)));
  b.extrudeXZ(outer, h - 0.04, M, 0.04);
  b.box(w, 0.04, d, getMaterial({ color: "#efefed", material: "matte" }), 0, 0, 0);
  b.extrudeXZ(roundRectShape(w - 0.12, d - 0.12, 0.18), 0.02, M, 0.12);
  b.object(tube([new THREE.Vector3(w / 2 - 0.25, h, -d / 2 + 0.05), new THREE.Vector3(w / 2 - 0.25, h + 0.1, -d / 2 + 0.05), new THREE.Vector3(w / 2 - 0.25, h + 0.1, -d / 2 + 0.16)], 0.012, c.m("detail", BLACK)));
}

export function washbasin(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main", { color: "#f6f6f4", material: "ceramic" });
  const V = c.m("secondary", { color: "#d6c5ad", material: "oak" });
  const D = c.m("detail", BLACK);
  const small = bool(p, "small");
  if (!small) b.box(w, 0.42, d - 0.02, V, 0, h - 0.5, -0.01);
  b.extrudeXZ(roundRectShape(w * 0.9, d * 0.85, 0.08), 0.12, M, h - 0.12, 0.01);
  b.object(tube([new THREE.Vector3(0, h, -d / 2 + 0.06), new THREE.Vector3(0, h + 0.18, -d / 2 + 0.06), new THREE.Vector3(0, h + 0.18, -d / 2 + 0.16)], 0.01, D));
  if (bool(p, "mirror")) {
    b.box(w * 0.85, 0.7, 0.02, getMaterial({ color: "#f4f6f8", material: "mirror" }), 0, h + 0.3, -d / 2 + 0.01);
  }
}

export function shower(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main", { color: "#e8e4dc", material: "stone" });
  const D = c.m("detail", BLACK);
  b.box(w, 0.02, d, M, 0, 0, 0);
  b.box(0.12, 0.004, 0.12, D, 0, 0.02, 0);
  if (bool(p, "glass", true)) {
    b.box(0.008, h, d * 0.7, getMaterial({ color: "#e0eae8", material: "glass" }), w / 2 - 0.004, 0.02, d * 0.15);
    b.box(0.012, h, 0.03, D, w / 2 - 0.004, 0.02, d / 2 - 0.02);
  }
  b.object(tube([new THREE.Vector3(-w / 2 + 0.02, 1.0, -d / 2 + 0.02), new THREE.Vector3(-w / 2 + 0.02, h + 0.1, -d / 2 + 0.02), new THREE.Vector3(-w / 2 + 0.3, h + 0.12, -d / 2 + 0.02)], 0.01, D));
  b.cyl(0.13, 0.13, 0.01, D, -w / 2 + 0.3, h + 0.08, -d / 2 + 0.25);
  b.box(0.02, 0.02, 0.24, D, -w / 2 + 0.3, h + 0.1, -d / 2 + 0.12);
}

// ---------------------------------------------------------------- Balkon
export function outdoorTable(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  if (bool(p, "round", Math.abs(w - d) < 0.02)) {
    b.cyl(w / 2, w / 2, 0.02, M, 0, h - 0.02, 0, 48);
    b.cyl(0.03, 0.03, h - 0.02, M, 0, 0, 0, 16);
    b.cyl(0.25, 0.27, 0.02, M, 0, 0, 0, 32);
  } else {
    b.box(w, 0.025, d, M, 0, h - 0.025, 0);
    b.legsSquare([[-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + 0.04], [-w / 2 + 0.04, d / 2 - 0.04], [w / 2 - 0.04, d / 2 - 0.04]], h - 0.025, 0.035, M);
  }
}

export function outdoorChair(c: Ctx) {
  const { w, d, h, b } = c;
  const M = c.m("main");
  const r = 0.01;
  b.extrudeXZ(roundRectShape(w * 0.9, d * 0.85, 0.08), 0.012, M, 0.45);
  b.rbox(w * 0.88, h - 0.5, 0.012, 0.006, M, 0, 0.5, -d / 2 + 0.05, 2, -0.12);
  for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]] as [number, number][]) b.cyl(r, r, 0.45, M, x, 0, z, 10);
}

export function outdoorSofa(c: Ctx) {
  const { w, d, h, b } = c;
  const F = c.m("main", { color: "#f2f0eb", material: "matte" });
  const C = c.m("secondary", { color: "#ded6c6", material: "fabric" });
  b.box(w, 0.05, d, F, 0, 0.3, 0);
  for (const sx of [-1, 1]) b.box(0.05, 0.62, d, F, sx * (w / 2 - 0.025), 0, 0);
  b.box(w, h - 0.3, 0.05, F, 0, 0.3, -d / 2 + 0.025);
  b.cushion(w - 0.12, 0.1, d - 0.12, C, 0, 0.35, 0.03, 0.2);
  b.cushion(w - 0.14, 0.38, 0.12, C, 0, 0.42, -d / 2 + 0.12, 0.25, -0.15);
  b.legsSquare([[-w / 2 + 0.03, -d / 2 + 0.03], [w / 2 - 0.03, -d / 2 + 0.03], [-w / 2 + 0.03, d / 2 - 0.03], [w / 2 - 0.03, d / 2 - 0.03]], 0.3, 0.04, F);
}

// ---------------------------------------------------------------- Einbauküche Alno 2060 (Höffner, Kaufvertrag 3037702)

/** Griffleiste (schwarz) als flacher Aufsatzgriff an der Oberkante einer Front. */
function gripBar(c: Ctx, x: number, y: number, z: number, len: number, vertical = false) {
  const D = c.m("detail", BLACK);
  if (vertical) c.b.box(0.012, len, 0.014, D, x, y, z + 0.007);
  else c.b.box(len, 0.012, 0.014, D, x, y, z + 0.007);
}

/** Front mit 3-mm-Fugen; Griff oben (Unterschrank), unten (Oberschrank) oder seitlich (Hochschrank). */
function front(c: Ctx, x0: number, x1: number, y0: number, y1: number, z: number, grip: "top" | "bottom" | "left" | "right" | "none" = "top") {
  const F = c.m("main", { color: "#7a5236", material: "oakDark" });
  const g = 0.0015;
  const w = x1 - x0 - 2 * g, h = y1 - y0 - 2 * g;
  c.b.box(w, h, 0.019, F, (x0 + x1) / 2, y0 + g, z + 0.0095);
  const zf = z + 0.019;
  if (grip === "top") gripBar(c, (x0 + x1) / 2, y1 - 0.035, zf, Math.max(0.1, w - 0.1));
  else if (grip === "bottom") gripBar(c, (x0 + x1) / 2, y0 + 0.025, zf, Math.max(0.1, w - 0.1));
  else if (grip === "left") gripBar(c, x0 + 0.035, y0 + 0.06, zf, h - 0.12, true);
  else if (grip === "right") gripBar(c, x1 - 0.035, y0 + 0.06, zf, h - 0.12, true);
}

const PLINTH = 0.15;
const BASE_TOP = 0.93; // Korpus 78 cm auf 15-cm-Sockel
const WORK = 0.968; // + Natursteinplatte 38 mm (Arbeitshöhe ≈ 96 cm)
const TALL_TOP = 2.358; // Hochschrank 220,8 cm + Sockel
const UPPER_H = 0.78;

/**
 * Küchenzeile an der Westwand, maßgenau nach der Höffner-Planung (Breiten in mm von links/Fensterseite):
 * 55 Passstück · 600 Geräte-Hochschrank Backofen · 16 Wange · 300 Auszug (cooking AGENT) · 800 Kochfeld-Unterschrank 2 Auszüge ·
 * 450 Geschirrspüler · 450 Spüle · 300 2 Auszüge · 16 Wange · 600 Geräte-Hochschrank Kühl-Gefrier-Kombination · 53 Passstück.
 * Oberschränke 900/500/900 mit Faltlifttüren und LED-Unterbauleuchten, Nischenrückwand Naturstein.
 */
export function kitchenAlno(c: Ctx) {
  const { w, d, b } = c;
  const F = c.m("main", { color: "#7a5236", material: "oakDark" });
  const K = c.m("secondary", { color: "#1c1c1c", material: "matte" });
  const T = c.m("top", { color: "#e3d7c1", material: "granite" });
  const D = c.m("detail", BLACK);
  const black = getMaterial({ color: "#151515", material: "matte" });
  const glass = getMaterial({ color: "#0b0b0c", material: "gloss" });
  const steel = getMaterial({ color: "#c6cbd0", material: "steel" });
  const sinkM = getMaterial({ color: "#1f1f20", material: "stone" });
  const zw = -d / 2; // Wand
  const cd = 0.56; // Korpustiefe
  const zf = zw + cd; // Vorderkante Korpus = Rückseite Front
  // Breiten (Summe = 3,64 m; bei abweichender Länge werden die Passstücke angepasst)
  const mods = [0.6, 0.016, 0.3, 0.8, 0.45, 0.45, 0.3, 0.016, 0.6];
  const core = mods.reduce((a, v) => a + v, 0);
  const fillL = Math.max(0.005, (w - core) * (55 / 108));
  const xs: number[] = [-w / 2 + fillL];
  for (const m of mods) xs.push(xs[xs.length - 1] + m);
  const [xOven, xW1, xPull, xHob, xDw, xSink, xDr, xW2, xFridge, xEnd] = xs;
  const runL = xW1 + 0.016, runR = xW2; // Arbeitsplatte/Oberschränke zwischen den Wangen

  // Sockel (zurückgesetzt) über die ganze Länge
  b.box(w - 0.01, PLINTH, cd - 0.07, black, 0, 0, zw + (cd - 0.07) / 2 + 0.005);
  // Passstücke in Frontmaterial
  b.box(fillL, TALL_TOP - PLINTH, 0.019, F, -w / 2 + fillL / 2, PLINTH, zf + 0.0095);
  b.box(w / 2 - xEnd, TALL_TOP - PLINTH, 0.019, F, (xEnd + w / 2) / 2, PLINTH, zf + 0.0095);
  b.box(w / 2 - xEnd, PLINTH, 0.019, black, (xEnd + w / 2) / 2, 0, zf - 0.05);
  b.box(fillL, PLINTH, 0.019, black, -w / 2 + fillL / 2, 0, zf - 0.05);

  // --- Geräte-Hochschrank Backofen: 2 Auszüge, Blende, Backofennische, Tür oben
  b.box(0.6, TALL_TOP - PLINTH, cd, K, (xOven + xW1) / 2, PLINTH, zw + cd / 2);
  front(c, xOven, xW1, PLINTH, 0.51, zf);
  front(c, xOven, xW1, 0.51, 0.872, zf);
  front(c, xOven, xW1, 0.872, 0.95, zf, "none");
  {
    // AEG-Pyrolyse-Backofen, schwarz: Glasfront mit Bedienleiste und Edelstahlgriff
    const cx = (xOven + xW1) / 2, y0 = 0.952, oh = 0.595;
    b.box(0.595, oh, 0.025, black, cx, y0, zf + 0.012);
    b.box(0.57, oh - 0.13, 0.006, glass, cx, y0 + 0.02, zf + 0.026);
    b.box(0.57, 0.085, 0.006, glass, cx, y0 + oh - 0.1, zf + 0.026);
    b.box(0.12, 0.022, 0.002, getMaterial({ color: "#f2e8d8", material: "opal" }), cx, y0 + oh - 0.065, zf + 0.0295);
    b.cyl(0.009, 0.009, 0.5, steel, cx, y0 + oh - 0.16, zf + 0.06, 16, 0, Math.PI / 2);
    for (const s of [-1, 1]) b.box(0.014, 0.014, 0.034, steel, cx + s * 0.22, y0 + oh - 0.167, zf + 0.043);
  }
  front(c, xOven, xW1, 1.549, TALL_TOP, zf, "bottom");
  // Wange (65 cm tief) neben dem Backofenschrank
  b.box(0.016, TALL_TOP - PLINTH, d, F, xW1 + 0.008, PLINTH, 0);

  // --- Unterschränke
  b.box(runR - runL, BASE_TOP - PLINTH, cd, K, (runL + runR) / 2, PLINTH, zw + cd / 2);
  const fy0 = PLINTH + 0.003, fy1 = BASE_TOP - 0.004;
  front(c, xPull, xHob, fy0, fy1, zf);
  front(c, xHob, xDw, fy0, 0.624, zf);
  front(c, xHob, xDw, 0.624, fy1, zf);
  front(c, xDw, xSink, fy0, fy1, zf);
  front(c, xSink, xDr, fy0, fy1, zf);
  front(c, xDr, xW2, fy0, 0.624, zf);
  front(c, xDr, xW2, 0.624, fy1, zf);

  // --- Arbeitsplatte Naturstein 38 mm, 61 cm tief, mit Ausschnitt für die Spüle (Auflage)
  const td = 0.61;
  const tz0 = zw, tz1 = zw + td;
  const sinkW = 0.44, sinkD = 0.5;
  const sx = (xSink + xDr) / 2, sz = zw + 0.03 + 0.02 + sinkD / 2 + 0.02;
  const cut = { x0: sx - sinkW / 2 + 0.02, x1: sx + sinkW / 2 - 0.02, z0: sz - sinkD / 2 + 0.02, z1: sz + sinkD / 2 - 0.02 };
  const slab = (x0: number, x1: number, z0: number, z1: number) => x1 - x0 > 0.001 && z1 - z0 > 0.001 && b.box(x1 - x0, WORK - BASE_TOP, z1 - z0, T, (x0 + x1) / 2, BASE_TOP, (z0 + z1) / 2);
  slab(runL, cut.x0, tz0, tz1);
  slab(cut.x1, runR, tz0, tz1);
  slab(cut.x0, cut.x1, tz0, cut.z0);
  slab(cut.x0, cut.x1, cut.z1, tz1);
  // Franke Granitspüle Maris MRG 610-37, Black Matt, Auflage mit Becken
  {
    const rim = 0.006;
    b.box(sinkW, rim, 0.022, sinkM, sx, WORK, sz - sinkD / 2 + 0.011);
    b.box(sinkW, rim, 0.022, sinkM, sx, WORK, sz + sinkD / 2 - 0.011);
    b.box(0.022, rim, sinkD, sinkM, sx - sinkW / 2 + 0.011, WORK, sz);
    b.box(0.022, rim, sinkD, sinkM, sx + sinkW / 2 - 0.011, WORK, sz);
    const depth = 0.19;
    b.box(cut.x1 - cut.x0, 0.01, cut.z1 - cut.z0, sinkM, sx, WORK - depth, sz);
    b.box(0.01, depth, cut.z1 - cut.z0, sinkM, cut.x0 + 0.005, WORK - depth, sz);
    b.box(0.01, depth, cut.z1 - cut.z0, sinkM, cut.x1 - 0.005, WORK - depth, sz);
    b.box(cut.x1 - cut.x0, depth, 0.01, sinkM, sx, WORK - depth, cut.z0 + 0.005);
    b.box(cut.x1 - cut.x0, depth, 0.01, sinkM, sx, WORK - depth, cut.z1 - 0.005);
    b.cyl(0.03, 0.03, 0.004, steel, sx, WORK - depth + 0.011, sz, 24);
    // Armatur Franke Lina, schwarz matt, Hochdruck, hoher Auslauf
    const tx = sx + 0.06, tz = zw + 0.04 + 0.02;
    b.cyl(0.026, 0.028, 0.03, D, tx, WORK, tz, 24);
    b.object(
      tube(
        [new THREE.Vector3(tx, WORK + 0.02, tz), new THREE.Vector3(tx, WORK + 0.3, tz), new THREE.Vector3(tx, WORK + 0.36, tz + 0.06), new THREE.Vector3(tx, WORK + 0.33, tz + 0.2), new THREE.Vector3(tx, WORK + 0.27, tz + 0.21)],
        0.013,
        D,
      ),
    );
    b.box(0.012, 0.012, 0.09, D, tx + 0.03, WORK + 0.2, tz + 0.04);
  }
  // AEG-Induktionskochfeld 80 cm mit integriertem Dunstabzug (Auflage, Rahmen mattschwarz)
  {
    const hx = (xHob + xDw) / 2, hz = zw + 0.03 + 0.02 + 0.26;
    b.box(0.8, 0.006, 0.52, glass, hx, WORK, hz);
    b.box(0.8, 0.007, 0.006, black, hx, WORK, hz - 0.257);
    b.box(0.8, 0.007, 0.006, black, hx, WORK, hz + 0.257);
    b.box(0.006, 0.007, 0.52, black, hx - 0.397, WORK, hz);
    b.box(0.006, 0.007, 0.52, black, hx + 0.397, WORK, hz);
    // Abzugsöffnung in der Mitte mit Lamellen
    b.box(0.09, 0.0075, 0.46, black, hx, WORK, hz);
    for (let i = 0; i < 9; i++) b.box(0.003, 0.008, 0.44, getMaterial({ color: "#2b2b2b", material: "blackMetal" }), hx - 0.036 + i * 0.009, WORK, hz);
    // Kochzonen (feine Markierung) und Bedienfeld
    const ring = getMaterial({ color: "#3a3a3c", material: "matte" });
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.torus(0.085, 0.0015, ring, hx + s * 0.2, WORK + 0.0065, hz + t * 0.1);
    b.box(0.3, 0.0005, 0.03, getMaterial({ color: "#7a7a7c", material: "matte" }), hx, WORK + 0.0062, hz + 0.23);
  }
  // Nischenrückwand Naturstein 20 mm zwischen Arbeitsplatte und Oberschränken
  const upY = TALL_TOP - UPPER_H;
  b.box(runR - runL, upY - WORK, 0.02, T, (runL + runR) / 2, WORK, zw + 0.01);
  // Doppelsteckdose schwarz
  b.box(0.15, 0.08, 0.012, D, xPull + 0.12, WORK + 0.18, zw + 0.026);

  // --- Geräte-Hochschrank Kühl-Gefrier-Kombination (2 Türen, Griff zur Arbeitsplatte hin)
  b.box(0.016, TALL_TOP - PLINTH, cd + 0.019, F, xW2 + 0.008, PLINTH, zw + (cd + 0.019) / 2);
  b.box(0.6, TALL_TOP - PLINTH, cd, K, (xFridge + xEnd) / 2, PLINTH, zw + cd / 2);
  front(c, xFridge, xEnd, PLINTH, WORK, zf, "left");
  front(c, xFridge, xEnd, WORK, TALL_TOP, zf, "left");

  // --- Oberschränke 90 / 50 / 90 mit Faltlifttüren (zwei Fronten übereinander), 35 cm tief
  const ud = 0.35;
  b.box(runR - runL, UPPER_H, ud, K, (runL + runR) / 2, upY, zw + ud / 2);
  const ux = [runL, runL + 0.9, runL + 1.4, runR];
  for (let i = 0; i < 3; i++) {
    front(c, ux[i], ux[i + 1], upY, upY + UPPER_H / 2, zw + ud, "none");
    front(c, ux[i], ux[i + 1], upY + UPPER_H / 2, TALL_TOP, zw + ud, "none");
  }
  // LED-Unterbauleuchten (leuchten im Abendmodus) mit Lichtpunkten
  b.box(runR - runL - 0.06, 0.006, 0.018, getMaterial({ color: "#fff4e0", material: "opal" }), (runL + runR) / 2, upY - 0.006, zw + ud - 0.06);
  for (const t of [0.2, 0.5, 0.8]) b.object(lightMarker(runL + (runR - runL) * t, upY - 0.03, zw + ud - 0.08, 420, "down"));
}

/** Sideboard gegenüber: 2 × Unterschrank 60 cm (35 cm tief) mit Wangen und Natursteinplatte. */
export function kitchenAlnoSide(c: Ctx) {
  const { w, d, b } = c;
  const F = c.m("main", { color: "#7a5236", material: "oakDark" });
  const K = c.m("secondary", { color: "#1c1c1c", material: "matte" });
  const T = c.m("top", { color: "#e3d7c1", material: "granite" });
  const black = getMaterial({ color: "#151515", material: "matte" });
  const zw = -d / 2;
  const cd = 0.35;
  const top = c.h - 0.038;
  const inner = w - 0.032;
  b.box(inner, PLINTH, cd - 0.07, black, 0, 0, zw + (cd - 0.07) / 2);
  b.box(inner, top - PLINTH, cd, K, 0, PLINTH, zw + cd / 2);
  for (const s of [-1, 1]) b.box(0.016, top - PLINTH, cd + 0.023, F, s * (w / 2 - 0.008), PLINTH, zw + (cd + 0.023) / 2);
  const x0 = -inner / 2;
  for (let i = 0; i < 2; i++) front(c, x0 + (inner / 2) * i, x0 + (inner / 2) * (i + 1), PLINTH + 0.003, top - 0.004, zw + cd);
  b.box(w, 0.038, d, T, 0, top, 0);
}
