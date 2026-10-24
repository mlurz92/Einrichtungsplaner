import * as THREE from "three";
import { BLACK, CHROME, OAK, bool, num, polyTube, shellShape, str, tube, type Ctx } from "./common";
import { roundRectShape } from "../geom";

const legMat = (c: Ctx) => c.m("legs", BLACK);

/** Klassisches Polstersofa (z. B. Tribeca, Eliot): Rahmen, Armlehnen, Sitz- und Rückenkissen. */
export function sofa(c: Ctx, opts: { bed?: boolean } = {}) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  // Kissen: Zweitfarbe bei zweifarbigen Bezügen (z. B. Korpus Weiß, Kissen Schwarz)
  const C = c.slots.secondary ? c.m("secondary") : M;
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
    b.cushion(sw - 0.01, 0.15, sd, C, -innerW / 2 + sw * (i + 0.5), baseH - 0.02, -d / 2 + backD + sd / 2, 0.3);
  }
  // Rückenkissen
  const bh = h - seatH - 0.02;
  if (bh > 0.12) {
    for (let i = 0; i < seats; i++) {
      b.cushion(sw - 0.02, bh, 0.16, C, -innerW / 2 + sw * (i + 0.5), seatH - 0.02, -d / 2 + backD + 0.06, 0.35, -0.12);
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
  const C = c.slots.secondary ? c.m("secondary") : M;
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
  for (let i = 0; i < n; i++) b.cushion(sw - 0.01, 0.15, sd - back - 0.01, C, x0 + sw * (i + 0.5), base - 0.01, -d / 2 + back + (sd - back) / 2, 0.3);
  b.cushion(chaiseW - 0.02, 0.15, d - back - 0.02, C, cx, base - 0.01, -d / 2 + back + (d - back) / 2, 0.3);
  for (let i = 0; i < n + 1; i++) {
    const xx = i < n ? x0 + sw * (i + 0.5) : cx;
    const ww = i < n ? sw : chaiseW;
    b.cushion(ww - 0.04, h - seatH, 0.18, C, xx, seatH - 0.02, -d / 2 + back + 0.07, 0.3, -0.15);
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

/** Superellipsen-Band in XZ (Rücken/Armlehnen einer Polsterschale), vorne offen; n = 2 rund, größer = kastiger. */
function bandShape(w: number, d: number, thick: number, openFront: number, n = 2.6): THREE.Shape {
  const pt = (a: number, rx: number, rz: number) => {
    const c = Math.cos(a), s = Math.sin(a);
    return new THREE.Vector2(Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * rx, Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * rz);
  };
  const a1 = Math.PI * (0.5 + openFront / 2);
  const span = Math.PI * 2 - Math.PI * openFront;
  const steps = 56;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) pts.push(pt(a1 + (span * i) / steps, w / 2, d / 2));
  for (let i = steps; i >= 0; i--) pts.push(pt(a1 + (span * i) / steps, w / 2 - thick, d / 2 - thick));
  return new THREE.Shape(pts);
}

/**
 * Stuhlsystem „Flex“ (DELIFE): Polsterschale auf wählbarem Gestell.
 * shell: arm (Armlehnstuhl, Rücken höher als Armlehnen), side (ohne Armlehnen), shell (Sitz und Rücken getrennte Schalen),
 * tub (runde Schale bis oben); stitch: channel (senkrechte Steppung), seam (Quernaht), tufted (Knopfheftung);
 * base: cone (4-Fuß konisch), cross/crossSquare/crossFlat/wood (Kreuzgestell rund/kantig/breit/Holz, Beine aus einem Knoten
 * unter dem Sitz diagonal zum Boden), star (Fußkreuz mit Säule), sled (Kufen aus Rundstahl), cantilever (Freischwinger Flachstahl).
 */
export function chairFlex(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const L = c.m("legs", BLACK);
  const seatH = num(p, "seatHeight", 0.48);
  const shell = str(p, "shell", "arm");
  const stitch = str(p, "stitch", "none");
  const base = str(p, "base", "cone");
  const armH = Math.min(num(p, "armHeight", 0.66), h - 0.05);
  const swivel = bool(p, "swivel");
  const bar = seatH > 0.6;
  const yb = seatH - 0.12;
  const thick = shell === "tub" ? 0.075 : 0.05;
  const round = shell === "tub" || shell === "shell" ? 2.1 : 2.7;
  // Sitzpolster
  const inner = shell === "side" || shell === "shell" ? w - 0.03 : w - 2 * thick + 0.01;
  const sd = d - 0.04;
  // Sitzkissen: vorne über die Armlehnen hinaus (Wasserfallkante), bei Nube rund aufgepolstert
  b.cushion(inner, 0.12, sd - thick * 0.6, M, 0, yb, 0.02 + thick * 0.3, shell === "shell" ? 0.45 : 0.3);
  // Schale: Rücken (und Armlehnen)
  if (shell === "arm") {
    // Armlehnen als Seitenwangen bis ca. 3/4 der Tiefe, Rücken darüber leicht schmaler
    b.extrudeXZ(bandShape(w, d, thick, 0.62, round), armH - yb - 0.012, M, yb + 0.012, 0.012);
    b.extrudeXZ(bandShape(w * 0.96, d * 0.97, thick, 1.38, round), h - armH - 0.012, M, armH - 0.006, 0.012);
  } else if (shell === "tub") {
    b.extrudeXZ(bandShape(w, d, thick, 0.5, round), h - yb - 0.012, M, yb, 0.012);
  } else if (shell === "shell") {
    // Nube: ovales, nach hinten geneigtes Rückenpolster, vom Sitz abgesetzt, mittiger Träger
    const by = seatH + 0.05, ph = h - by;
    const tilt = 0.14, zc = -d / 2 + 0.06 + Math.sin(tilt) * ph * 0.5;
    b.cushion(w * 0.96, 0.085, ph, M, 0, by + ph / 2 - 0.0425, zc, 0.7, -Math.PI / 2 - tilt);
    b.box(0.05, by - yb + 0.04, 0.02, L, 0, yb - 0.01, -d / 2 + 0.09);
  } else {
    b.extrudeXZ(bandShape(w, d, thick, 1.3, round), h - yb - 0.012, M, yb + 0.02, 0.012);
  }
  // Steppung/Naht auf der Rückeninnenseite
  const ry0 = Math.max(seatH + 0.05, shell === "shell" ? seatH + 0.1 : seatH + 0.04), ry1 = h - 0.05;
  if (stitch === "channel") {
    const n = Math.max(5, Math.round(w / 0.075));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + thick + 0.05 + ((w - 2 * thick - 0.1) * i) / (n - 1);
      const zf = -d / 2 + thick + 0.004 + Math.pow(Math.abs(x) / (w / 2), 2.4) * 0.06;
      b.cyl(0.013, 0.013, ry1 - ry0, M, x, ry0, zf, 10);
    }
  } else if (stitch === "seam") {
    b.extrudeXZ(bandShape(w * 0.96 + 0.006, d * 0.97 + 0.006, thick + 0.012, shell === "arm" ? 1.38 : 1.3, round), 0.012, M, seatH + (h - seatH) * 0.52);
  } else if (stitch === "tufted") {
    for (let r = 0; r < 3; r++) for (let k = -1; k <= 1; k++) {
      b.sphere(0.009, M, k * w * 0.2 + (r % 2 ? w * 0.1 : 0), ry0 + 0.06 + r * (ry1 - ry0 - 0.1) / 2.5, -d / 2 + thick + 0.002, 8);
    }
  }
  // Gestell
  const fx = w / 2 - 0.05, fz = d / 2 - 0.06;
  if (base === "cone") {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.strut([sx * (fx - 0.06), yb + 0.01, sz * (fz - 0.07)], [sx * fx, 0, sz * fz], 0.03, L, false, 0.45);
    if (bar) b.box(2 * fx - 0.06, 0.016, 0.016, L, 0, 0.3, fz - 0.03);
  } else if (base === "cross" || base === "crossSquare" || base === "crossFlat" || base === "wood") {
    const sq = base !== "cross";
    const s = base === "wood" ? 0.04 : base === "crossFlat" ? 0.032 : base === "crossSquare" ? 0.026 : 0.024;
    const hubY = yb - (swivel ? 0.08 : 0.025);
    if (swivel) b.cyl(0.028, 0.028, yb - hubY, L, 0, hubY, 0, 20);
    if (sq) b.box(0.13, 0.02, 0.13, L, 0, hubY - 0.01, 0, Math.PI / 4);
    else b.cyl(0.065, 0.065, 0.016, L, 0, hubY - 0.008, 0, 24);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.strut([sx * 0.045, hubY, sz * 0.045], [sx * fx, 0, sz * fz], s, L, sq, sq ? 1 : 0.6);
    if (bar) b.torus(Math.min(fx, fz) * 0.62, 0.008, L, 0, 0.3, 0);
  } else if (base === "star") {
    b.cyl(0.026, 0.03, yb - 0.06, L, 0, 0.06, 0, 20);
    b.cyl(0.05, 0.05, 0.02, L, 0, yb - 0.02, 0, 24);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.strut([0, 0.07, 0], [sx * fx * 0.92, 0.012, sz * fz * 0.92], 0.026, L, true);
    if (bar) b.torus(0.2, 0.009, L, 0, 0.32, 0);
  } else if (base === "sled") {
    const r = 0.006;
    for (const sx of [-1, 1]) {
      const x = sx * fx;
      b.object(polyTube([
        new THREE.Vector3(x, r, -fz), new THREE.Vector3(x, r, fz), new THREE.Vector3(x - sx * 0.03, yb - r, fz - 0.06),
        new THREE.Vector3(x - sx * 0.03, yb - r, -fz + 0.08), new THREE.Vector3(x, r, -fz),
      ], r, L));
    }
    for (const sz of [-1, 1]) b.cyl(r, r, 2 * fx - 0.06, L, 0, yb - r, sz * (fz - 0.07), 8, 0, Math.PI / 2);
    if (bar) b.cyl(r * 1.4, r * 1.4, 2 * fx, L, 0, 0.3, fz - 0.03, 8, 0, Math.PI / 2);
  } else if (base === "cantilever") {
    // Flachstahl 40 × 12 mm: Bodenkufen mit Querhaupt hinten, vorne gebogen nach oben und unter dem Sitz zurück
    const bw = 0.04, bt = 0.012;
    for (const sx of [-1, 1]) {
      const x = sx * (fx - 0.01);
      b.box(bw, bt, 2 * fz - 0.02, L, x, 0, -0.01);
      b.strut([x, 0.01, fz - 0.01], [x, yb - 0.02, fz - 0.07], bt * 1.6, L, true);
      b.box(bw, bt, d * 0.55, L, x, yb - 0.02 - bt, fz - 0.07 - d * 0.275);
    }
    b.box(2 * fx - 0.02 + bw, bt, bw, L, 0, 0, -fz + 0.02);
  } else if (base === "column") {
    // Säulenfuß (Bar-/Tresenhocker): Bodenteller, Gasdruckfeder-Säule, Fußring
    const rr = Math.min(w, d) * 0.4;
    b.cyl(rr, rr, 0.012, L, 0, 0, 0, 40);
    b.cyl(0.03, 0.03, yb - 0.012, L, 0, 0.012, 0, 20);
    b.cyl(0.07, 0.05, 0.03, L, 0, yb - 0.03, 0, 24);
    if (bar) b.torus(Math.min(rr * 0.95, 0.19), 0.009, L, 0, 0.3, 0);
  }
}

/**
 * Polsterbank „Flex“ (DELIFE Taya-Flex): Sitzkissen, optional Rücken und Armlehnen, als gerade Bank oder Eckbank (L-Form,
 * Schenkel an side = left|right); base: sled (Kufen Flachstahl), sledSquare (Kufen Vierkant), crossSquare (X-Gestell kantig),
 * legs (konische Füße). Gestellrahmen an den Enden und bei langen Schenkeln mittig.
 */
export function benchFlex(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const L = c.m("legs", BLACK);
  const seatH = num(p, "seatHeight", 0.5);
  const armH = Math.min(num(p, "armHeight", 0), h - 0.02);
  const hasBack = bool(p, "back", h > seatH + 0.15);
  const base = str(p, "base", "sled");
  const corner = bool(p, "corner");
  const sx = str(p, "side", "right") === "left" ? -1 : 1;
  const bd = corner ? Math.min(num(p, "benchDepth", 0.69), d / 2) : d;
  const yb = seatH - 0.13;
  const bt = hasBack ? 0.13 : 0;
  type Seg = { x: number; z: number; lx: number; lz: number; ax: "x" | "z"; ends: number[] };
  const segs: Seg[] = [{ x: 0, z: -d / 2 + bd / 2, lx: w, lz: bd, ax: "x", ends: corner ? [-sx] : [-1, 1] }];
  if (corner) segs.push({ x: sx * (w / 2 - bd / 2), z: -d / 2 + bd + (d - bd) / 2, lx: bd, lz: d - bd, ax: "z", ends: [1] });
  for (const s of segs) {
    const along = s.ax === "x" ? s.lx : s.lz;
    const deep = s.ax === "x" ? s.lz : s.lx;
    // Korpus und Sitzkissen
    b.rbox(s.lx - 0.01, 0.05, s.lz - 0.01, 0.012, M, s.x, yb, s.z, 3);
    const n = Math.max(1, Math.round(along / 0.7));
    const off = s.ax === "x" ? bt / 2 : 0;
    for (let i = 0; i < n; i++) {
      const u = -along / 2 + (along / n) * (i + 0.5);
      if (s.ax === "x") b.cushion(s.lx / n - 0.008, seatH - yb - 0.05, s.lz - bt, M, s.x + u, yb + 0.05, s.z + off, 0.3);
      else b.cushion(s.lx - bt, seatH - yb - 0.05, s.lz / n - 0.008, M, s.x - sx * bt / 2, yb + 0.05, s.z + u, 0.3);
    }
    // Rücken (außen) und Armlehnen (freie Enden)
    if (hasBack) {
      if (s.ax === "x") b.cushion(s.lx, h - yb, bt, M, s.x, yb, s.z - s.lz / 2 + bt / 2, 0.25);
      else b.cushion(bt, h - yb, s.lz, M, s.x + sx * (s.lx / 2 - bt / 2), yb, s.z, 0.25);
    }
    if (armH > seatH) for (const e of s.ends) {
      if (s.ax === "x") b.cushion(0.09, armH - yb, s.lz - bt, M, s.x + e * (s.lx / 2 - 0.045), yb, s.z + off, 0.3);
      else b.cushion(s.lx - bt, armH - yb, 0.09, M, s.x - sx * bt / 2, yb, s.z + e * (s.lz / 2 - 0.045), 0.3);
    }
    // Gestell: Rahmen quer zur Bank an beiden Enden (Eckschenkel ohne Rahmen an der Ecke), mittig ab 1,6 m
    const us = [-along / 2 + 0.14, along / 2 - 0.14];
    if (along > 1.6) us.push(0);
    if (corner && s.ax === "z") us[0] = -along / 2 + 0.1;
    const half = deep / 2 - 0.08;
    for (const u of us) {
      const P = (q: number, y: number): [number, number, number] =>
        s.ax === "x" ? [s.x + u, y, s.z + q] : [s.x + q, y, s.z + u];
      if (base === "sled" || base === "sledSquare") {
        const t = base === "sled" ? 0.014 : 0.03;
        b.strut(P(-half, 0), P(half, 0), t, L, true);
        b.strut(P(-half + 0.02, 0), P(-half + 0.06, yb), t, L, true);
        b.strut(P(half - 0.02, 0), P(half - 0.06, yb), t, L, true);
        b.strut(P(-half + 0.06, yb - t), P(half - 0.06, yb - t), t, L, true);
      } else if (base === "crossSquare") {
        b.strut(P(-half, 0), P(half - 0.04, yb), 0.03, L, true);
        b.strut(P(half, 0), P(-half + 0.04, yb), 0.03, L, true);
      } else {
        for (const q of [-half, half]) b.strut(P(q * 0.82, yb), P(q, 0), 0.032, L, false, 0.5);
      }
    }
  }
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
    // Armlehnen: Stütze + Auflage (statt massiver Platte)
    if (bool(p, "arms", true)) {
      const pad = c.m("detail", BLACK);
      for (const sx of [-1, 1]) {
        b.box(0.028, 0.2, 0.03, L, sx * w * 0.36, 0.48, -0.02);
        b.rbox(0.06, 0.025, 0.24, 0.01, pad, sx * w * 0.36, 0.68, 0.0, 3);
      }
    }
  }
}
