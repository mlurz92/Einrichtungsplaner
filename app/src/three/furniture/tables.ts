import * as THREE from "three";
import { BLACK, OAK, bool, num, str, type Ctx } from "./common";
import { ellipseShape, organicShape, roundRectShape } from "../geom";

const topMat = (c: Ctx) => c.m("top", c.slots.main ?? OAK);
const baseMat = (c: Ctx) => c.m("legs", c.slots.main ?? BLACK);

export function tableRect(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = num(p, "top", h < 0.5 ? 0.04 : 0.035);
  b.extrudeXZ(roundRectShape(w, d, num(p, "radius", 0.01)), t, T, h - t, 0.002);
  const leg = num(p, "leg", h < 0.5 ? 0.035 : 0.045);
  const inset = num(p, "inset", 0.06);
  const lx = w / 2 - inset, lz = d / 2 - inset;
  const style = str(p, "legStyle", "round");
  const y0 = h - t;
  if (str(p, "base", "legs") === "panel") {
    for (const sx of [-1, 1]) b.box(0.05, h - t, d * 0.8, L, sx * (w / 2 - 0.15), 0, 0);
  } else if (style === "xframe") {
    // Kufen-/X-Gestell (bert plantagie Aiven): je Ende zwei Beinpaare, die vom Scheitel unter der Platte zu beiden Seiten
    // in Längsrichtung auslaufen, Querstange zwischen den Scheiteln
    const ax = w / 2 - inset, z = d / 2 - 0.12, spread = 0.26;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.strut([sx * ax, y0, sz * (z - 0.02)], [sx * (ax + spread), 0, sz * z], leg, L, true);
        b.strut([sx * ax, y0, sz * (z - 0.02)], [sx * (ax - spread), 0, sz * z], leg, L, true);
      }
      b.box(leg, leg, 2 * z - 0.04, L, sx * ax, y0 - leg, 0);
    }
    b.box(2 * ax, leg, leg, L, 0, y0 - leg * 1.2, 0);
  } else if (style === "cross") {
    // Gekreuzte Schrägbeine (connubia Master): je Ende und Seite zwei Beine, die sich in der Seitenansicht überkreuzen
    const ax = w / 2 - inset, z = d / 2 - 0.16, s2 = 0.2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.strut([sx * (ax - s2), y0, sz * (z - 0.06)], [sx * (ax + s2 * 0.6), 0, sz * z], leg, L, false, 0.8);
        b.strut([sx * (ax + s2 * 0.5), y0, sz * (z - 0.1)], [sx * (ax - s2 * 1.1), 0, sz * (z + 0.04)], leg, L, false, 0.8);
      }
    }
  } else if (num(p, "splay", 0) > 0) {
    // Leicht schräg ausgestellte, konische Beine (Mobitec Terra)
    const sp = num(p, "splay", 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.strut([sx * (lx - sp), y0, sz * (lz - sp * 0.6)], [sx * lx, 0, sz * lz], leg, L, false, 0.6);
  } else if (style === "square") {
    b.legsSquare([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], h - t, leg, L);
  } else {
    b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], h - t, leg / 2, L, 0.75);
  }
  if (h > 0.6 && !bool(p, "noApron")) {
    b.box(w - 2 * inset, 0.07, 0.02, L, 0, h - t - 0.07, -lz);
    b.box(w - 2 * inset, 0.07, 0.02, L, 0, h - t - 0.07, lz);
  }
}

export function tableRound(c: Ctx) {
  const { w, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const r = w / 2;
  const t = num(p, "top", 0.035);
  b.cyl(r, r, t, T, 0, h - t, 0, 64);
  const lr = r * 0.62;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.cyl(0.018, 0.024, h - t, L, Math.cos(a) * lr, 0, Math.sin(a) * lr, 16);
  }
}

export function tableOval(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = num(p, "top", h < 0.5 ? 0.05 : 0.035);
  const shape = bool(p, "organic") ? organicShape(w, d, 3) : ellipseShape(w, d);
  b.extrudeXZ(shape, t, T, h - t, 0.003);
  if (h < 0.5) {
    // Couchtisch: geschlossener Sockel
    b.extrudeXZ(bool(p, "organic") ? organicShape(w * 0.72, d * 0.66, 5) : ellipseShape(w * 0.7, d * 0.62), h - t, L, 0);
  } else {
    for (const sx of [-1, 1]) b.cyl(0.05, 0.08, h - t, L, sx * w * 0.28, 0, 0, 24);
  }
}

/** Säulen-/Konusfuß (Abby, Noam, Sculpt, Hiray). */
export function tablePedestal(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = num(p, "top", 0.03);
  const round = bool(p, "round", Math.abs(w - d) < 0.01);
  if (round) b.cyl(w / 2, w / 2, t, T, 0, h - t, 0, 72);
  else b.extrudeXZ(ellipseShape(w, d), t, T, h - t);
  const foot = num(p, "footD", Math.min(w, d) * 0.5) / 2;
  const base = str(p, "base", "column");
  if (base === "cone") {
    b.lathe([[0, 0], [foot, 0], [foot, 0.02], [0.07, h * 0.55], [0.09, h - t], [0, h - t]], L);
  } else {
    b.lathe([[0, 0], [foot, 0], [foot * 0.98, 0.04], [foot * 0.62, 0.12], [foot * 0.55, h - t - 0.08], [foot * 0.7, h - t], [0, h - t]], L);
  }
}

/** Couchtisch-Duo (zwei Steinblöcke unterschiedlicher Höhe). */
export function coffeeDuo(c: Ctx) {
  const { p, b } = c;
  const M = c.m("main");
  const parts = [
    { w: num(p, "a_w", 0.8), d: num(p, "a_d", 0.7), h: num(p, "a_h", 0.35), x: num(p, "a_x", -0.3), z: num(p, "a_y", 0), r: num(p, "a_rot", 0) },
    { w: num(p, "b_w", 0.7), d: num(p, "b_d", 0.53), h: num(p, "b_h", 0.23), x: num(p, "b_x", 0.3), z: num(p, "b_y", 0), r: num(p, "b_rot", 0) },
  ];
  for (const q of parts) {
    const s = roundRectShape(q.w, q.d, Math.min(q.w, q.d) * 0.22);
    const g = new THREE.ExtrudeGeometry(s, { depth: q.h - 0.01, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 24 });
    g.rotateX(Math.PI / 2);
    g.translate(0, q.h - 0.008, 0);
    g.rotateY((-q.r * Math.PI) / 180);
    b.add(g, M, q.x, 0, -q.z);
  }
}

/** Monolithischer Couchtisch (Distinct, Marisa): Block mit Sockel bzw. zweistufig. */
export function coffeeBlock(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const t = 0.06;
  b.extrudeXZ(roundRectShape(w, d, 0.04), t, M, h - t, 0.004);
  if (bool(p, "twoLevel")) {
    b.extrudeXZ(roundRectShape(w * 0.48, d, 0.04), h - t, M, 0, 0);
    b.extrudeXZ(roundRectShape(w * 0.46, d * 0.9, 0.04), h * 0.6, M, 0, 0);
    b.box(w * 0.5, 0.05, d * 0.9, M, w * 0.24, h * 0.6 - 0.05, 0);
  } else {
    b.extrudeXZ(roundRectShape(w * 0.62, d * 0.62, 0.05), h - t, M, 0, 0);
  }
}

export function coffeeRound(c: Ctx) {
  const { w, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = num(p, "top", 0.04);
  b.cyl(w / 2, w / 2, t, T, 0, h - t, 0, 64);
  if (str(p, "base", "drum") === "drum") b.cyl(w * 0.38, w * 0.38, h - t, L, 0, 0, 0, 48);
  else {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.cyl(0.02, 0.025, h - t, L, Math.cos(a) * w * 0.33, 0, Math.sin(a) * w * 0.33, 16);
    }
  }
}

export function sideRound(c: Ctx) {
  const { w, h, p, b } = c;
  const M = c.m("main");
  const style = str(p, "style", "column");
  if (style === "drum") {
    b.lathe([[0, 0], [w / 2 - 0.01, 0], [w / 2, 0.02], [w / 2, h - 0.02], [w / 2 - 0.01, h], [0, h]], M);
  } else if (style === "tray") {
    b.cyl(w / 2, w / 2, 0.03, M, 0, h - 0.03, 0, 48);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.cyl(0.008, 0.008, h - 0.03, c.m("legs", BLACK), Math.cos(a) * w * 0.4, 0, Math.sin(a) * w * 0.4, 8);
    }
  } else {
    // Säule mit Platte (Travertin)
    b.cyl(w / 2, w / 2, 0.04, M, 0, h - 0.04, 0, 48);
    b.cyl(w * 0.3, w * 0.34, h - 0.04, M, 0, 0, 0, 40);
  }
}

/** Componibili-Container (gestapelte Zylinder mit Griffloch). */
export function sideContainer(c: Ctx) {
  const { w, h, p, b } = c;
  const M = c.m("main");
  const tiers = Math.max(1, Math.round(num(p, "tiers", 2)));
  const th = (h - 0.02) / tiers;
  for (let i = 0; i < tiers; i++) {
    b.cyl(w / 2, w / 2, th - 0.004, M, 0, 0.01 + i * th, 0, 48);
    b.cyl(w / 2 + 0.001, w / 2 + 0.001, 0.004, c.m("detail", { color: "#202020", material: "plastic" }), 0, 0.01 + (i + 1) * th - 0.004, 0, 48);
  }
  b.cyl(w / 2 - 0.01, w / 2 - 0.01, 0.02, M, 0, h - 0.02, 0, 48);
}

export function desk(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = 0.025;
  b.extrudeXZ(roundRectShape(w, d, 0.02), t, T, h - t, 0.002);
  if (str(p, "style", "") === "marte") {
    for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]] as [number, number][]) b.cyl(0.016, 0.025, h - t, L, x, 0, z, 16);
    b.box(w - 0.16, 0.08, d - 0.14, T, 0, h - t - 0.08, -0.01);
  } else {
    b.legs([[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]], h - t, 0.018, L, 1);
  }
}

/** Sitz-/Steh-Schreibtisch mit T-Füßen. */
export function deskStanding(c: Ctx) {
  const { w, d, h, b } = c;
  const T = topMat(c);
  const L = c.m("legs", BLACK);
  const t = 0.025;
  b.extrudeXZ(roundRectShape(w, d, 0.015), t, T, h - t, 0.002);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.12);
    b.box(0.07, 0.03, d - 0.06, L, x, 0, 0);
    b.box(0.06, h - t - 0.03, 0.06, L, x, 0.03, -0.05);
    b.box(0.05, 0.03, d - 0.12, L, x, h - t - 0.03, 0);
  }
  b.box(w - 0.3, 0.04, 0.04, L, 0, h - t - 0.05, -0.05);
}

/** Konsole: "chandler" (Holzgestell mit Steinplatte), "noam" (Metallbeine), Standard. */
export function console_(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = c.m("top", c.slots.main);
  const M = c.m("main");
  const style = str(p, "style", "chandler");
  const t = 0.035;
  b.extrudeXZ(roundRectShape(w, d, 0.01), t, T, h - t, 0.002);
  if (style === "noam") {
    for (const sx of [-1, 1]) {
      b.cyl(0.015, 0.015, h - t, M, sx * (w / 2 - 0.06), 0, d / 2 - 0.06, 16);
      b.cyl(0.015, 0.015, h - t, M, sx * (w / 2 - 0.06), 0, -d / 2 + 0.06, 16);
    }
    b.box(w - 0.12, 0.02, 0.02, M, 0, 0.12, -d / 2 + 0.06);
  } else {
    for (const sx of [-1, 1]) b.box(0.06, h - t, d - 0.02, M, sx * (w / 2 - 0.04), 0, 0);
    b.box(w - 0.14, 0.03, d - 0.06, M, 0, 0.12, 0);
    b.box(w - 0.14, 0.08, 0.03, M, 0, h - t - 0.08, -d / 2 + 0.03);
  }
}
