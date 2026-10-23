import * as THREE from "three";
import { BLACK, bool, num, tube, type Ctx } from "./common";
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
