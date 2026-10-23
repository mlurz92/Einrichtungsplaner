import * as THREE from "three";
import { BLACK, CHROME, OAK, bool, num, shellShape, str, tube, type Ctx } from "./common";
import { roundRectShape } from "../geom";

const legMat = (c: Ctx) => c.m("legs", BLACK);

/** Klassisches Polstersofa (z. B. Tribeca, Eliot): Rahmen, Armlehnen, Sitz- und Rückenkissen. */
export function sofa(c: Ctx, opts: { bed?: boolean } = {}) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const L = legMat(c);
  const seats = Math.max(1, Math.round(num(p, "seats", w > 2.1 ? 3 : w > 1.4 ? 2 : 1)));
  const armW = num(p, "armWidth", 0.2);
  const armH = num(p, "armHeight", Math.min(h - 0.1, 0.62));
  const seatH = num(p, "seatHeight", 0.44);
  const legH = num(p, "legHeight", 0.08);
  const backD = num(p, "backDepth", 0.2);
  const style = str(p, "style", "classic");
  const baseH = seatH - 0.13;
  // Sockel/Rahmen
  b.rbox(w - 0.02, baseH - legH, d - 0.02, 0.03, M, 0, legH, 0);
  // Armlehnen
  const armR = style === "tribeca" ? 0.1 : 0.05;
  for (const sx of [-1, 1]) b.rbox(armW, armH - legH, d, armR, M, sx * (w / 2 - armW / 2), legH, 0, 4);
  // Rücken
  b.rbox(w - 2 * armW + 0.02, h - legH, backD, 0.05, M, 0, legH, -d / 2 + backD / 2, 4);
  // Sitzkissen
  const innerW = w - 2 * armW;
  const sw = innerW / seats;
  const sd = d - backD - 0.02;
  for (let i = 0; i < seats; i++) {
    b.cushion(sw - 0.01, 0.15, sd, M, -innerW / 2 + sw * (i + 0.5), baseH - 0.02, -d / 2 + backD + sd / 2, 0.3);
  }
  // Rückenkissen
  const bh = h - seatH - 0.02;
  if (bh > 0.12) {
    for (let i = 0; i < seats; i++) {
      b.cushion(sw - 0.02, bh, 0.16, M, -innerW / 2 + sw * (i + 0.5), seatH - 0.02, -d / 2 + backD + 0.06, 0.35, -0.12);
    }
  }
  if (opts.bed) {
    // Naht für Schlaffunktion angedeutet (Bezug bleibt)
  }
  if (legH > 0.01) {
    const lx = w / 2 - 0.06;
    const lz = d / 2 - 0.06;
    b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], legH, 0.018, L, 0.85);
  }
}

/** Modulsofa mit tiefen Sitzen (Lennon, Söderhamn): niedrige, breite Armlehnen. */
export function sofaModular(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const L = legMat(c);
  const modules = Math.max(1, Math.round(num(p, "modules", Math.max(1, Math.round(w / 1.19)))));
  const armW = num(p, "armWidth", 0.32);
  const seatH = num(p, "seatHeight", 0.43);
  const armTop = Math.min(h, seatH + num(p, "armHeight", 0.25));
  const backD = num(p, "backDepth", 0.25);
  const legH = 0.04;
  const base = seatH - 0.18;
  b.rbox(w, base - legH, d, 0.04, M, 0, legH, 0, 3);
  // Armlehnen (breit, flach, abgerundet)
  b.cushion(armW, armTop - base, d - backD * 0.2, M, -w / 2 + armW / 2, base, backD * 0.1, 0.12);
  b.cushion(armW, armTop - base, d - backD * 0.2, M, w / 2 - armW / 2, base, backD * 0.1, 0.12);
  // Rückenpolster
  b.cushion(w - 0.02, h - base, backD, M, 0, base, -d / 2 + backD / 2, 0.12);
  // Sitzflächen je Modul (tiefe Kissen)
  const innerW = w - 2 * armW;
  const sw = innerW / modules;
  const sd = d - backD;
  for (let i = 0; i < modules; i++) b.cushion(sw - 0.01, 0.2, sd - 0.02, M, -innerW / 2 + sw * (i + 0.5), base - 0.01, -d / 2 + backD + sd / 2, 0.35);
  // Rückenkissen lose
  for (let i = 0; i < modules; i++) b.cushion(sw - 0.04, h - seatH + 0.02, 0.22, M, -innerW / 2 + sw * (i + 0.5), seatH - 0.02, -d / 2 + backD + 0.1, 0.35, -0.18);
  const lx = w / 2 - 0.08, lz = d / 2 - 0.08;
  b.legsSquare([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], legH, 0.04, L);
}

/** Organisches/rundes Sofa (Wolke, Alba, Lillesäter). */
export function sofaRound(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const seatH = num(p, "seatHeight", 0.42);
  // Sitz als Kiesel-Form
  const seat = roundRectShape(w, d, Math.min(d * 0.48, w * 0.25));
  b.extrudeXZ(seat, seatH - 0.08, M, 0.0, 0.04);
  // Rücken/Arme als C-Schale
  const sh = shellShape(w, d * 1.02, Math.min(0.24, d * 0.28), 0.42);
  b.extrudeXZ(sh, h - 0.12, M, 0.02, 0.07);
  // Sitzkissen
  const n = Math.max(1, Math.round(w / 0.9));
  const sw = (w - 0.4) / n;
  for (let i = 0; i < n; i++) b.cushion(sw, 0.12, d * 0.6, M, -((w - 0.4) / 2) + sw * (i + 0.5), seatH - 0.1, d * 0.12, 0.3);
}

/** Ecksofa / Récamiere (Seite über params.side). */
export function sofaCorner(c: Ctx) {
  const { w, d, p, b, h } = c;
  const M = c.m("main");
  const L = legMat(c);
  const side = str(p, "side", "right");
  const sd = Math.min(num(p, "seatDepth", 0.98), d - 0.3);
  const chaiseW = Math.min(num(p, "chaiseWidth", 0.95), w / 2);
  const armW = num(p, "armWidth", 0.15);
  const seatH = num(p, "seatHeight", 0.43);
  const base = seatH - 0.15;
  const back = 0.22;
  const legH = 0.05;
  // Hauptteil
  b.rbox(w, base - legH, sd, 0.03, M, 0, legH, -d / 2 + sd / 2);
  b.cushion(w - 0.02, h - base, back, M, 0, base, -d / 2 + back / 2, 0.1);
  // Chaise
  const cx = side === "right" ? w / 2 - chaiseW / 2 : -w / 2 + chaiseW / 2;
  b.rbox(chaiseW, base - legH, d - sd + 0.02, 0.03, M, cx, legH, -d / 2 + sd + (d - sd) / 2 - 0.01);
  // Arme
  const armSide = side === "right" ? -1 : 1;
  b.cushion(armW, Math.min(h, 0.62) - base, sd - back, M, armSide * (w / 2 - armW / 2), base, -d / 2 + back + (sd - back) / 2, 0.1);
  // Sitzkissen
  const seatW = w - chaiseW - armW;
  const n = Math.max(1, Math.round(seatW / 0.7));
  const sw = seatW / n;
  const x0 = side === "right" ? -w / 2 + armW : -w / 2 + chaiseW;
  for (let i = 0; i < n; i++) b.cushion(sw - 0.01, 0.15, sd - back - 0.01, M, x0 + sw * (i + 0.5), base - 0.01, -d / 2 + back + (sd - back) / 2, 0.3);
  b.cushion(chaiseW - 0.02, 0.15, d - back - 0.02, M, cx, base - 0.01, -d / 2 + back + (d - back) / 2, 0.3);
  for (let i = 0; i < n + 1; i++) {
    const xx = i < n ? x0 + sw * (i + 0.5) : cx;
    const ww = i < n ? sw : chaiseW;
    b.cushion(ww - 0.04, h - seatH, 0.18, M, xx, seatH - 0.02, -d / 2 + back + 0.07, 0.3, -0.15);
  }
  const lx = w / 2 - 0.06;
  b.legs([[-lx, -d / 2 + 0.06], [lx, -d / 2 + 0.06], [side === "right" ? -lx : lx, -d / 2 + sd - 0.06], [cx, d / 2 - 0.06]], legH, 0.02, L);
}

/** Loungesessel (rechteckig) – Raymond, Ekenäset, Landskrona. */
export function armchairLounge(c: Ctx) {
  c.p.seats = 1;
  if (bool(c.p, "woodFrame") || str(c.p, "style", "") === "wood") {
    const { w, d, h, b } = c;
    const M = c.m("main");
    const W = c.m("legs", OAK);
    for (const sx of [-1, 1]) {
      b.box(0.04, 0.6, 0.04, W, sx * (w / 2 - 0.03), 0, d / 2 - 0.05);
      b.box(0.04, h * 0.85, 0.04, W, sx * (w / 2 - 0.03), 0, -d / 2 + 0.06);
      b.box(0.05, 0.03, d, W, sx * (w / 2 - 0.03), 0.58, 0);
    }
    b.cushion(w - 0.12, 0.14, d - 0.15, M, 0, 0.32, 0.05, 0.3);
    b.cushion(w - 0.12, h * 0.55, 0.14, M, 0, 0.42, -d / 2 + 0.12, 0.3, -0.25);
    return;
  }
  sofa(c);
}

/** Runder Loungesessel / Tub (Sofia, Alba): Schale + Sitzkissen. */
export function armchairRound(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const seatH = num(p, "seatHeight", 0.44);
  b.extrudeXZ(roundRectShape(w * 0.98, d * 0.98, Math.min(w, d) * 0.42), seatH - 0.14, M, 0.02, 0.025);
  b.extrudeXZ(shellShape(w, d, Math.min(0.2, w * 0.21), 0.5), h - 0.08, M, 0.02, 0.06);
  b.cushion(w * 0.66, 0.14, d * 0.62, M, 0, seatH - 0.15, d * 0.08, 0.35);
  b.legsSquare([[-w * 0.3, -d * 0.3], [w * 0.3, -d * 0.3], [-w * 0.3, d * 0.3], [w * 0.3, d * 0.3]], 0.025, 0.04, c.m("legs", BLACK));
}

/** Ohrensessel (Strandmon, Kalia). */
export function armchairWing(c: Ctx) {
  const { w, d, h, b } = c;
  const M = c.m("main");
  const W = c.m("legs", OAK);
  const seatH = 0.45;
  const legH = 0.14;
  b.rbox(w * 0.9, seatH - legH - 0.12, d * 0.9, 0.03, M, 0, legH, 0.02);
  b.cushion(w * 0.68, 0.14, d * 0.7, M, 0, seatH - 0.14, 0.08, 0.3);
  b.rbox(w * 0.78, h - legH, 0.16, 0.05, M, 0, legH, -d / 2 + 0.1, 4, -0.08);
  for (const sx of [-1, 1]) {
    b.rbox(0.13, 0.66 - legH, d * 0.85, 0.05, M, sx * (w / 2 - 0.08), legH, 0.04);
    b.rbox(0.1, h - 0.6, 0.38, 0.05, M, sx * (w / 2 - 0.1), 0.58, -d / 2 + 0.24, 4, 0, sx * 0.15);
  }
  const lx = w * 0.38, lz = d * 0.36;
  b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], legH, 0.022, W, 0.7);
}

/** Cocktail-/Schalensessel (Koarp, Luan, Drehsessel). */
export function armchairShell(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const L = c.m("legs", BLACK);
  const seatH = num(p, "seatHeight", 0.43);
  const legH = 0.2;
  b.extrudeXZ(shellShape(w, d, 0.09, 0.55), h - seatH + 0.12, M, seatH - 0.12, 0.04);
  b.cushion(w * 0.78, 0.16, d * 0.78, M, 0, seatH - 0.16, 0.04, 0.3);
  if (bool(p, "swivel") || /dreh/i.test(String(p.name ?? ""))) {
    b.cyl(0.03, 0.03, legH, L, 0, 0.02, 0);
    b.cyl(0.26, 0.28, 0.02, L, 0, 0, 0);
  } else {
    const lx = w * 0.32, lz = d * 0.32;
    b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], seatH - 0.12, 0.013, L, 0.9);
  }
}

/** Armlehnstuhl mit Tub-Lehne (Nik). */
export function diningArmchair(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const W = c.m("legs", OAK);
  const seatH = num(p, "seatHeight", 0.47);
  const armH = Math.min(num(p, "armHeight", 0.7), h);
  const legH = seatH - 0.1;
  b.cushion(w * 0.82, 0.1, d * 0.82, M, 0, legH, 0.02, 0.25);
  b.extrudeXZ(shellShape(w, d, 0.06, 0.55), h - legH - 0.06, M, legH + 0.04, 0.025);
  void armH;
  const lx = w * 0.36, lz = d * 0.34;
  for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]] as [number, number][]) {
    b.cyl(0.016, 0.02, legH + 0.02, W, x, 0, z, 16);
  }
}

/** Esszimmerstuhl (Polster, Holz). */
export function diningChair(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const W = c.m("legs", OAK);
  const seatH = num(p, "seatHeight", 0.46);
  b.cushion(w * 0.92, 0.07, d * 0.86, M, 0, seatH - 0.07, 0.02, 0.2);
  b.rbox(w * 0.9, h - seatH - 0.02, 0.05, 0.02, M, 0, seatH + 0.02, -d / 2 + 0.06, 3, -0.1);
  const lx = w / 2 - 0.04, lz = d / 2 - 0.04;
  b.legs([[-lx, lz], [lx, lz]], seatH - 0.07, 0.016, W, 0.75);
  b.legs([[-lx, -lz], [lx, -lz]], seatH - 0.07, 0.016, W, 0.75);
}

/** Freischwinger (Jordan, Don) – Rohrgestell verchromt, Sitz/Rücken gepolstert. */
export function cantilever(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const T = c.m("legs", CHROME);
  const seatH = num(p, "seatHeight", 0.46);
  const r = 0.011;
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.03);
    const pts = [
      new THREE.Vector3(x, h - 0.02, -d / 2 + 0.04),
      new THREE.Vector3(x, seatH + 0.02, -d / 2 + 0.06),
      new THREE.Vector3(x, seatH - 0.02, d / 2 - 0.06),
      new THREE.Vector3(x, seatH - 0.05, d / 2 - 0.01),
      new THREE.Vector3(x, 0.14, d / 2 - 0.02),
      new THREE.Vector3(x, r, d / 2 - 0.06),
      new THREE.Vector3(x, r, -d / 2 + 0.1),
    ];
    b.object(tube(pts, r, T));
  }
  b.cushion(w - 0.06, 0.07, d - 0.12, M, 0, seatH - 0.05, 0.02, 0.15);
  b.rbox(w - 0.06, h - seatH - 0.08, 0.05, 0.02, M, 0, seatH + 0.06, -d / 2 + 0.06, 3, -0.12);
}

export function barStool(c: Ctx) {
  const { w, d, h, b } = c;
  const M = c.m("main");
  const L = c.m("legs", BLACK);
  b.cushion(w, 0.07, d, M, 0, h - 0.07, 0, 0.2);
  b.rbox(w * 0.9, 0.22, 0.04, 0.015, M, 0, h, -d / 2 + 0.04);
  const lx = w / 2 - 0.04, lz = d / 2 - 0.04;
  b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], h - 0.07, 0.012, L, 0.9);
  b.box(w - 0.06, 0.012, 0.012, L, 0, 0.28, lz);
}

export function pouf(c: Ctx) {
  const { w, d, h, b } = c;
  const M = c.m("main");
  if (Math.abs(w - d) < 0.02) b.lathe([[0, 0], [w / 2 - 0.03, 0], [w / 2, 0.03], [w / 2, h - 0.04], [w / 2 - 0.04, h], [0, h]], M);
  else b.cushion(w, h, d, M, 0, 0, 0, 0.15);
}

export function bench(c: Ctx) {
  const { w, d, h, b } = c;
  const M = c.m("main");
  const L = c.m("legs", OAK);
  b.cushion(w, 0.1, d, M, 0, h - 0.1, 0, 0.2);
  b.box(w - 0.04, 0.03, d - 0.04, L, 0, h - 0.13, 0);
  const lx = w / 2 - 0.06, lz = d / 2 - 0.05;
  b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], h - 0.13, 0.02, L);
}

/** Bürostuhl: "task" (Rollen, Netzrücken) oder "lounge" (Bouclé-Schale). */
export function officeChair(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const L = c.m("legs", BLACK);
  const style = str(p, "style", "task");
  // Fünfstern-Fuß
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const len = Math.min(w, d) / 2 - 0.03;
    b.box(0.035, 0.03, len, L, Math.sin(a) * len / 2, 0.05, Math.cos(a) * len / 2, a);
    b.sphere(0.025, c.m("detail", BLACK), Math.sin(a) * len, 0.025, Math.cos(a) * len, 12);
  }
  b.cyl(0.025, 0.025, 0.36, L, 0, 0.06, 0, 16);
  if (style === "lounge") {
    b.extrudeXZ(shellShape(w, d, 0.08, 0.5), h - 0.42, M, 0.42, 0.04);
    b.cushion(w * 0.78, 0.1, d * 0.75, M, 0, 0.42, 0.04, 0.3);
  } else {
    b.cushion(w * 0.72, 0.08, d * 0.7, M, 0, 0.44, 0.03, 0.2);
    b.rbox(w * 0.66, h - 0.6, 0.05, 0.04, M, 0, 0.58, -d * 0.32, 4, -0.1);
    for (const sx of [-1, 1]) b.box(0.04, 0.2, 0.3, L, sx * w * 0.36, 0.5, 0.0);
  }
}
