import { BLACK, OAK, bool, num, type Ctx } from "./common";
import { getMaterial } from "../materials";

// Bett: lokale Breite = Bettbreite, Tiefe = Länge, Kopfteil hinten (−Z), Fußende vorne (+Z).

function bedding(c: Ctx, mw: number, ml: number, top: number, zc: number) {
  const { b, p } = c;
  const sheet = getMaterial({ color: "#f7f6f2", material: "linen" });
  const duvet = c.m("secondary", { color: "#f4f2ec", material: "linen" });
  const throwM = c.m("accent", { color: "#d9cdb8", material: "wool" });
  // Matratze
  b.rbox(mw, 0.22, ml, 0.04, sheet, 0, top, zc, 3);
  const y = top + 0.22;
  // Bettdecke (ab 35 % der Länge, leicht überhängend), oberer Umschlag
  const dl = ml * 0.68;
  const dz = zc + ml / 2 - dl / 2 + 0.02;
  b.cushion(mw + 0.06, 0.07, dl, duvet, 0, y - 0.03, dz, 0.4);
  b.cushion(mw + 0.04, 0.05, 0.28, duvet, 0, y + 0.02, dz - dl / 2 + 0.14, 0.4);
  // Seitlicher Überhang
  for (const sx of [-1, 1]) b.box(0.025, 0.18, dl - 0.04, duvet, sx * (mw / 2 + 0.035), y - 0.2, dz);
  // Kissen
  const single = bool(p, "duvetSingle", false);
  const pw = single ? 0.8 : mw / 2 - 0.05;
  const pillows = mw > 1.3 ? 2 : 1;
  for (let i = 0; i < pillows; i++) {
    const x = pillows === 1 ? 0 : (i === 0 ? -1 : 1) * (mw / 4);
    b.cushion(Math.min(pw, 0.8), 0.14, 0.5, sheet, x, y - 0.01, zc - ml / 2 + 0.32, 0.6, -0.35);
  }
  // Plaid quer am Fußende
  b.cushion(mw + 0.08, 0.035, 0.42, throwM, 0, y + 0.035, zc + ml / 2 - 0.3, 0.2);
  for (const sx of [-1, 1]) b.box(0.02, 0.22, 0.42, throwM, sx * (mw / 2 + 0.05), y - 0.18, zc + ml / 2 - 0.3);
}

/** Polsterbett (Dream, Lennon, Tufjord) mit gepolstertem Kopfteil. */
export function bed(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const L = c.m("legs", BLACK);
  const mw = num(p, "mattressW", Math.max(0.9, w - 0.16));
  const ml = num(p, "mattressL", Math.max(1.9, d - 0.22));
  const frameH = num(p, "frameH", 0.35);
  const head = num(p, "headboard", h);
  const legH = bool(p, "storage", true) ? 0.03 : 0.12;
  const hbD = Math.max(0.08, d - ml - 0.06);
  // Rahmen
  b.rbox(w, frameH - legH, d - hbD + 0.02, 0.05, M, 0, legH, hbD / 2 - 0.01, 3);
  // Kopfteil (gepolstert, Kanäle)
  const ch = Math.max(3, Math.round(w / 0.28));
  const cw = w / ch;
  for (let i = 0; i < ch; i++) b.cushion(cw - 0.004, head - legH, hbD, M, -w / 2 + cw * (i + 0.5), legH, -d / 2 + hbD / 2, 0.15);
  if (legH > 0.02) b.legsSquare([[-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06], [-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06]], legH, 0.04, L);
  bedding(c, mw, ml, frameH - 0.04, -d / 2 + hbD + ml / 2 + 0.01);
}

/** Holzbett (Tammy, Sato, Hemnes) mit Lamellenkopfteil. */
export function bedWood(c: Ctx) {
  const { w, d, h, p, b } = c;
  const W = c.m("main", OAK);
  const mw = num(p, "mattressW", Math.max(0.9, w - 0.1));
  const ml = num(p, "mattressL", Math.max(1.9, d - 0.12));
  const frameH = num(p, "frameH", 0.32);
  const hb = 0.05;
  b.box(w, 0.2, d - hb, W, 0, frameH - 0.2, hb / 2);
  b.legsSquare([[-w / 2 + 0.04, d / 2 - 0.04], [w / 2 - 0.04, d / 2 - 0.04], [-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + 0.04]], frameH - 0.2, 0.06, W);
  if (h > frameH + 0.1) {
    const n = Math.round(w / 0.07);
    for (let i = 0; i < n; i++) b.box(w / n - 0.012, h - frameH + 0.1, hb, W, -w / 2 + (w / n) * (i + 0.5), frameH - 0.1, -d / 2 + hb / 2);
    b.box(w, 0.04, hb + 0.01, W, 0, h - 0.04, -d / 2 + hb / 2);
  }
  bedding(c, mw, ml, frameH - 0.02, -d / 2 + hb + ml / 2 + 0.01);
}

export function cushion(c: Ctx) {
  const { w, d, h, b } = c;
  // h = Kissenhöhe (aufrecht), d = Dicke
  // aufrecht, leicht nach hinten gelehnt (h = Kissenhöhe, d = Dicke)
  const t = Math.min(d, 0.11);
  b.cushion(w * 0.96, t, h * 0.96, c.m("main"), 0, h * 0.44 - t / 2, 0, 1.4, -Math.PI / 2 + 0.3, 0);
}

export function throwBlanket(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  if (bool(p, "draped")) {
    b.cushion(w, 0.03, d, M, 0, h - 0.03, 0, 0.2);
    b.box(w, h - 0.02, 0.02, M, 0, 0, d / 2 - 0.01);
    b.box(w, h - 0.08, 0.02, M, 0, 0.05, -d / 2 + 0.01);
  } else {
    b.cushion(w, Math.max(0.03, h), d, M, 0, 0, 0, 0.3);
    b.cushion(w * 0.98, Math.max(0.02, h * 0.6), d * 0.9, M, 0, Math.max(0.03, h) * 0.9, 0.0, 0.3);
  }
}
