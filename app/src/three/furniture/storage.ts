import { BLACK, num, rng, str, bool, type Ctx } from "./common";
import { getMaterial } from "../materials";

/** Fronten (Türen/Schubladen) mit Fugen, optional geriffelt. */
function fronts(c: Ctx, x0: number, x1: number, y0: number, y1: number, z: number, cols: number, rows: number, style: string, handle: string) {
  const { b } = c;
  const M = c.m("main");
  const H = c.m("detail", BLACK);
  const gap = 0.003;
  const cw = (x1 - x0) / cols;
  const rh = (y1 - y0) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = x0 + cw * (i + 0.5);
      const fy = y0 + rh * j + gap;
      const fh = rh - 2 * gap;
      const fw = cw - 2 * gap;
      if (style === "ribbed") {
        const n = Math.max(4, Math.round(fw / 0.022));
        const rw = fw / n;
        for (let k = 0; k < n; k++) b.cyl(rw * 0.5, rw * 0.5, fh, M, cx - fw / 2 + rw * (k + 0.5), fy, z + 0.004, 10);
        b.box(fw, fh, 0.012, M, cx, fy, z - 0.006);
      } else {
        b.box(fw, fh, 0.018, M, cx, fy, z);
      }
      if (handle === "knob") b.sphere(0.012, H, cx + (i % 2 ? -1 : 1) * (fw / 2 - 0.04), fy + fh / 2, z + 0.02, 12);
      else if (handle === "bar") b.box(0.012, Math.min(0.14, fh * 0.4), 0.02, H, cx + (i % 2 ? -1 : 1) * (fw / 2 - 0.035), fy + fh / 2 - Math.min(0.07, fh * 0.2), z + 0.018);
      else if (handle === "pull") b.box(Math.min(0.12, fw * 0.5), 0.012, 0.02, H, cx, fy + fh - 0.04, z + 0.018);
    }
  }
}

function legsOrPlinth(c: Ctx, legH: number, inset = 0.05) {
  const { w, d, b } = c;
  const L = c.m("legs", c.slots.main);
  if (legH <= 0.001) return;
  if (str(c.p, "plinth", "") === "plinth") {
    b.box(w - 0.04, legH, d - 0.06, L, 0, 0, -0.01);
    return;
  }
  const lx = w / 2 - inset, lz = d / 2 - inset;
  b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], legH, 0.018, L, 0.7);
}

/** Sideboard (Chandler, Calary, Stockholm, Besta). */
export function sideboard(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const legH = num(p, "legHeight", 0.12);
  const doors = Math.max(1, Math.round(num(p, "doors", Math.max(2, Math.round(w / 0.45)))));
  const drawers = Math.round(num(p, "drawers", 0));
  const style = str(p, "front", "flat");
  b.rbox(w, h - legH, d - 0.02, 0.008, M, 0, legH, -0.01, 2);
  const z = d / 2 - 0.01;
  if (drawers > 0) {
    const dw = (w - 0.04) / doors;
    fronts(c, -w / 2 + 0.02, -w / 2 + 0.02 + dw * (doors - 1), legH + 0.02, h - 0.02, z, doors - 1, 1, style, str(p, "handle", style === "ribbed" ? "none" : "bar"));
    fronts(c, -w / 2 + 0.02 + dw * (doors - 1), w / 2 - 0.02, legH + 0.02, h - 0.02, z, 1, drawers, style, "pull");
  } else {
    fronts(c, -w / 2 + 0.02, w / 2 - 0.02, legH + 0.02, h - 0.02, z, doors, 1, style, str(p, "handle", style === "ribbed" ? (c.slots.detail ? "bar" : "none") : "none"));
  }
  legsOrPlinth(c, legH, 0.08);
}

export const lowboard = sideboard;

/** Kommode / Highboard / Schuhschrank. */
export function dresser(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const legH = num(p, "legHeight", h > 1 ? 0.0 : 0.1);
  const flaps = Math.round(num(p, "flaps", 0));
  const rows = flaps || Math.max(2, Math.round((h - legH) / 0.22));
  const cols = flaps ? 1 : w > 1.0 ? 2 : 1;
  b.rbox(w, h - legH, d - 0.02, 0.006, M, 0, legH, -0.01, 2);
  fronts(c, -w / 2 + 0.015, w / 2 - 0.015, legH + 0.015, h - 0.015, d / 2 - 0.01, cols, rows, str(p, "front", "flat"), flaps ? "pull" : str(p, "handle", "knob"));
  legsOrPlinth(c, legH, 0.06);
}

export function nightstand(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const legH = num(p, "legHeight", 0.08);
  const top = c.slots.top ? c.m("top") : M;
  b.rbox(w, h - legH - 0.025, d - 0.02, 0.01, M, 0, legH, -0.01, 2);
  b.rbox(w, 0.025, d, 0.006, top, 0, h - 0.025, 0, 2);
  const drawers = Math.round(num(p, "drawers", 0));
  if (drawers > 0) fronts(c, -w / 2 + 0.015, w / 2 - 0.015, legH + 0.015, h - 0.04, d / 2 - 0.01, 1, drawers, "flat", "knob");
  else if (bool(p, "door", true)) {
    fronts(c, -w / 2 + 0.015, w / 2 - 0.015, legH + 0.015, h - 0.13, d / 2 - 0.01, 1, 1, "flat", "none");
    b.box(w * 0.5, 0.02, 0.02, c.m("detail", c.slots.top ?? BLACK), 0, h - 0.11, d / 2);
  }
  legsOrPlinth(c, legH, 0.05);
}

/** Vitrine (Metall + Riffelglas / Holz + Glas). */
export function vitrine(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const G = c.m("secondary", { color: "#dfe7e4", material: "glass" });
  const legH = num(p, "legHeight", 0.1);
  const t = 0.02;
  const bodyH = h - legH;
  b.box(w, t, d, M, 0, legH, 0);
  b.box(w, t, d, M, 0, h - t, 0);
  for (const sx of [-1, 1]) b.box(t, bodyH, d, M, sx * (w / 2 - t / 2), legH, 0);
  b.box(w, bodyH, 0.01, M, 0, legH, -d / 2 + 0.005);
  const shelves = Math.max(1, Math.round(num(p, "shelves", 4)));
  const R = rng(c.seed);
  for (let i = 1; i < shelves; i++) {
    const y = legH + (bodyH * i) / shelves;
    b.box(w - 2 * t, 0.008, d - 0.03, G, 0, y, 0);
    // Objekte (Gläser/Vasen/Bücher)
    for (let k = 0; k < 3; k++) {
      const x = -w / 2 + 0.12 + R() * (w - 0.24);
      if (R() > 0.5) b.cyl(0.03, 0.035, 0.12 + R() * 0.1, getMaterial({ color: ["#e9e4da", "#a7b59e", "#c9a477", "#d9d9d9"][Math.floor(R() * 4)], material: "ceramic" }), x, y + 0.008, 0, 16);
      else b.box(0.12, 0.2, 0.15, getMaterial({ color: ["#e1d6c4", "#5e4130", "#8d8d8a"][Math.floor(R() * 3)], material: "paper" }), x, y + 0.008, 0);
    }
  }
  // Glastüren mit Rahmen
  const doorN = w > 0.6 ? 2 : 1;
  const dw = (w - 2 * t) / doorN;
  for (let i = 0; i < doorN; i++) {
    const cx = -w / 2 + t + dw * (i + 0.5);
    b.box(dw - 0.006, bodyH - 2 * t, 0.006, G, cx, legH + t, d / 2 - 0.006);
    b.box(0.018, bodyH - 2 * t, 0.012, M, cx - dw / 2 + 0.009, legH + t, d / 2 - 0.006);
    b.box(0.018, bodyH - 2 * t, 0.012, M, cx + dw / 2 - 0.009, legH + t, d / 2 - 0.006);
  }
  const lx = w / 2 - 0.03, lz = d / 2 - 0.03;
  b.legsSquare([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], legH, 0.025, c.m("legs", c.slots.main));
}

/** Offenes Regal (Tylko, BOAXEL, Kallax). */
export function shelfOpen(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const style = str(p, "style", "tylko");
  const rows = Math.max(2, Math.round(num(p, "rows", Math.round(h / 0.36))));
  const cols = Math.max(1, Math.round(num(p, "cols", Math.max(1, Math.round(w / 0.42)))));
  const t = style === "boaxel" ? 0.012 : 0.018;
  const R = rng(c.seed + 3);
  if (style === "boaxel") {
    // Wandschienen + Konsolen + Böden
    for (const sx of [-1, 1]) b.box(0.025, h, 0.012, M, sx * (w / 2 - 0.05), 0, -d / 2 + 0.006);
    for (let i = 0; i < rows; i++) {
      const y = 0.25 + (i * (h - 0.35)) / (rows - 1);
      b.box(w, t, d, M, 0, y, 0);
      for (const sx of [-1, 1]) b.box(0.012, 0.04, d - 0.02, M, sx * (w / 2 - 0.05), y - 0.04, 0);
      if (i < rows - 1 && R() > 0.3) b.box(0.3 + R() * 0.2, 0.18, d * 0.7, getMaterial({ color: ["#e8e2d6", "#c9c3b7", "#a7b59e"][Math.floor(R() * 3)], material: "plastic" }), -w * 0.15 + R() * 0.1, y + t, 0);
    }
    return;
  }
  b.box(w, t, d, M, 0, 0.02, 0);
  b.box(w, t, d, M, 0, h - t, 0);
  for (let i = 0; i <= cols; i++) b.box(t, h - 0.02, d, M, -w / 2 + t / 2 + ((w - t) * i) / cols, 0.02, 0);
  const doorsBottom = Math.round(num(p, "doorsBottom", 0));
  for (let j = 1; j < rows; j++) {
    const y = 0.02 + ((h - 0.02) * j) / rows;
    b.box(w - 0.004, t, d, M, 0, y, 0);
  }
  b.box(w, h - 0.02, 0.008, M, 0, 0.02, -d / 2 + 0.004);
  const cw = (w - t) / cols;
  const rh = (h - 0.02) / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = -w / 2 + t + cw * (i + 0.5) - t / 2;
      const y = 0.02 + rh * j + t;
      if (j < doorsBottom) {
        b.box(cw - t - 0.004, rh - t - 0.004, 0.016, M, cx, y, d / 2 - 0.008);
        continue;
      }
      // Bücher und Objekte
      const r = R();
      if (r < 0.55) {
        let x = cx - cw / 2 + t + 0.02;
        const end = cx + (cw / 2) * (0.2 + R() * 0.7);
        while (x < end) {
          const bw = 0.02 + R() * 0.03;
          const bh = Math.min(rh - t - 0.03, 0.18 + R() * 0.1);
          b.box(bw, bh, d * 0.7, getMaterial({ color: ["#e7e0d3", "#c9b79c", "#2e3f57", "#8a6a4f", "#f1ede4", "#6e7450", "#b8653f"][Math.floor(R() * 7)], material: "paper" }), x + bw / 2, y, 0);
          x += bw + 0.002;
        }
      } else if (r < 0.8) {
        b.cyl(0.04, 0.05, Math.min(rh - t - 0.04, 0.16 + R() * 0.1), getMaterial({ color: ["#ece3d2", "#a7b59e", "#c9a55c", "#3a3b3c"][Math.floor(R() * 4)], material: R() > 0.8 ? "brass" : "ceramic" }), cx, y, 0, 20);
      }
    }
  }
}

/** Bücherregal (BILLY + Aufsatz, Hemnes) mit Büchern. */
export function bookcase(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const t = 0.018;
  const topper = num(p, "topper", 0);
  b.box(w, 0.06, d - 0.02, M, 0, 0, 0.0);
  for (const sx of [-1, 1]) b.box(t, h, d, M, sx * (w / 2 - t / 2), 0, 0);
  b.box(w, t, d, M, 0, h - t, 0);
  if (topper > 0) b.box(w - 2 * t, t, d, M, 0, h - topper, 0);
  b.box(w - 2 * t, h, 0.005, M, 0, 0, -d / 2 + 0.003);
  const rows = Math.max(3, Math.round(num(p, "rows", Math.round(h / 0.35))));
  const R = rng(c.seed + 7);
  const inner = w - 2 * t;
  for (let j = 0; j < rows; j++) {
    const y0 = 0.06 + ((h - 0.06 - t) * j) / rows;
    const y1 = 0.06 + ((h - 0.06 - t) * (j + 1)) / rows;
    if (j > 0) b.box(inner, t, d - 0.01, M, 0, y0, 0);
    let x = -inner / 2 + 0.005;
    while (x < inner / 2 - 0.05) {
      if (R() < 0.12) {
        x += 0.08 + R() * 0.12;
        continue;
      }
      const bw = 0.018 + R() * 0.03;
      const bh = Math.min(y1 - y0 - t - 0.02, 0.17 + R() * 0.12);
      b.box(bw, bh, d * 0.75, getMaterial({ color: ["#e7e0d3", "#c9b79c", "#2e3f57", "#8a6a4f", "#f1ede4", "#6e7450", "#a5563b", "#1d1d1d"][Math.floor(R() * 8)], material: "paper" }), x + bw / 2, y0 + t, 0.02);
      x += bw + 0.001;
    }
  }
}

/** Kleiderschrank (PAX + TONSTAD-Fronten) mit Deckenblende. */
export function wardrobe(c: Ctx) {
  const { w, d, h, p, b } = c;
  const F = c.m("main");
  const C = c.m("secondary", { color: "#f3f1ec", material: "matte" });
  const doors = Math.max(1, Math.round(num(p, "doors", Math.round(w / 0.5))));
  const plinth = 0.04;
  b.box(w, h - 0.02, d - 0.02, C, 0, 0, -0.01);
  const dw = w / doors;
  for (let i = 0; i < doors; i++) {
    const cx = -w / 2 + dw * (i + 0.5);
    b.box(dw - 0.004, h - plinth - 0.006, 0.02, F, cx, plinth, d / 2 - 0.01);
    // integrierte Griffleiste (TONSTAD) als Schattenfuge oben
    if (str(p, "handle", "edge") === "edge") b.box(dw * 0.5, 0.012, 0.004, getMaterial({ color: "#2a2520", material: "matte" }), cx + (i % 2 ? -1 : 1) * dw * 0.18, h - 0.03, d / 2 + 0.001);
  }
  const fascia = num(p, "fascia", 0);
  if (fascia > 0.005) {
    b.box(w + 0.004, fascia, 0.019, getMaterial({ color: String(p.fasciaColor ?? "#f3f0e8"), material: "matte" }), 0, h, d / 2 - 0.01);
  }
}

/**
 * Tylko Original/Tone-Stauraum: Raster aus Böden und je Reihe versetzten Trennwänden (Muster „Slant“/„Grid“),
 * Fächer offen, mit Tür (Griffmulde) oder Schublade (Griffkante); optional Rückwände, Beine, sichtbare
 * Multiplex-Kanten (Original Classic) und Schreibtischform (Knieraum zwischen zwei Korpussen).
 */
export function tylkoStorage(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const F = c.slots.secondary ? c.m("secondary") : M; // Fronten (zweifarbig)
  const edge = getMaterial({ color: "#d9bb8f", material: "oak" });
  const grip = getMaterial({ color: "#2a2724", material: "matte" });
  const t = 0.018;
  const legH = num(p, "legH", 0);
  const ply = bool(p, "plywood");
  const backs = bool(p, "backs", true);
  const pattern = str(p, "pattern", "slant");
  const doorsF = num(p, "doorShare", 0);
  const drawersF = num(p, "drawerShare", 0);
  const R = rng(c.seed * 31 + 7);
  const y0 = Math.max(0.008, legH);

  if (legH > 0.02) {
    const lx = w / 2 - 0.04, lz = d / 2 - 0.04;
    b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], legH, 0.012, getMaterial({ color: "#2a2724", material: "blackMetal" }), 1);
  } else {
    b.box(w - 0.02, y0, d - 0.04, getMaterial({ color: "#2a2724", material: "matte" }), 0, 0, -0.01);
  }
  const plyEdge = (x: number, y: number, ww: number, hh: number) => {
    if (ply) b.box(ww, hh, 0.002, edge, x, y, d / 2 + 0.001);
  };

  // Körper = Liste von Korpussen [x0, x1, yTop]; Schreibtisch: zwei Korpusse + durchgehende Platte
  const desk = bool(p, "desk");
  const knee = desk ? Math.min(0.8, Math.max(0.5, w * 0.45)) : 0;
  const bodies: [number, number][] = desk ? [[-w / 2, -knee / 2], [knee / 2, w / 2]] : [[-w / 2, w / 2]];
  const top = desk ? h - t : h;
  if (desk) {
    b.box(w, t, d, M, 0, h - t, 0);
    plyEdge(0, h - t, w, t);
    if (backs) b.box(knee, Math.min(0.35, h * 0.45), t, M, 0, h - t - Math.min(0.35, h * 0.45), -d / 2 + t / 2 + 0.02);
  }
  for (const [bx0, bx1] of bodies) {
    const bw = bx1 - bx0;
    const bh = top - y0;
    const rows = Math.max(1, Math.round(num(p, "rows", Math.max(1, Math.round(bh / (desk ? 0.22 : 0.34))))));
    const cols = Math.max(1, Math.round(num(p, "cols", Math.max(1, Math.round(bw / (desk ? 0.45 : 0.42))))));
    const rh = bh / rows;
    // Außenwände, Boden, Deckel
    for (const x of [bx0 + t / 2, bx1 - t / 2]) {
      b.box(t, bh, d, M, x, y0, 0);
      plyEdge(x, y0, t, bh);
    }
    for (let j = 0; j <= rows; j++) {
      const y = j === rows ? top - t : y0 + rh * j - (j > 0 ? t / 2 : 0);
      if (desk && j === rows) continue;
      b.box(bw, t, d, M, (bx0 + bx1) / 2, y, 0);
      plyEdge((bx0 + bx1) / 2, y, bw, t);
    }
    if (backs) b.box(bw - 2 * t, bh - t, 0.006, M, (bx0 + bx1) / 2, y0 + t / 2, -d / 2 + 0.003);
    for (let j = 0; j < rows; j++) {
      // Trennwände je Reihe; „slant“ versetzt die Teilung reihenweise
      const off = pattern === "slant" && cols > 1 ? ((j % 3) - 1) * 0.18 : pattern === "gradient" ? (j / Math.max(1, rows - 1) - 0.5) * 0.3 : 0;
      const xs = [bx0 + t];
      for (let i = 1; i < cols; i++) xs.push(bx0 + t + ((bw - 2 * t) * (i + off * (i === 1 ? 1 : 0.5))) / cols);
      xs.push(bx1 - t);
      const ya = y0 + rh * j + (j > 0 ? t / 2 : t);
      const yb = y0 + rh * (j + 1) - (j < rows - 1 ? t / 2 : t);
      for (let i = 1; i < xs.length - 1; i++) {
        b.box(t, yb - ya, d - 0.006, M, xs[i], ya, 0.003);
        plyEdge(xs[i], ya, t, yb - ya);
      }
      for (let i = 0; i < xs.length - 1; i++) {
        const xa = xs[i] + (i > 0 ? t / 2 : 0);
        const xb = xs[i + 1] - (i < xs.length - 2 ? t / 2 : 0);
        const cw = xb - xa, ch = yb - ya, cx = (xa + xb) / 2;
        const r = R();
        const drawerRow = j < Math.ceil(rows * Math.min(1, drawersF * 1.6));
        if ((desk && drawersF > 0) || (drawersF > 0 && drawerRow && r < 0.75 + drawersF * 0.25)) {
          // Schublade: Front mit Griffkante oben
          b.box(cw - 0.004, ch - 0.004, 0.018, F, cx, ya + 0.002, d / 2 - 0.009);
          b.box(cw * 0.6, 0.008, 0.004, grip, cx, ya + ch - 0.022, d / 2 + 0.001);
        } else if (doorsF > 0 && r < doorsF + (drawersF > 0 ? 0.15 : 0)) {
          // Tür: Front mit Griffmulde in der oberen Ecke
          b.box(cw - 0.004, ch - 0.004, 0.018, F, cx, ya + 0.002, d / 2 - 0.009);
          const sx = i % 2 ? -1 : 1;
          b.box(0.035, 0.012, 0.004, grip, cx + sx * (cw / 2 - 0.03), ya + ch - 0.03, d / 2 + 0.001);
        } else if (!desk && r > 0.55 && ch > 0.16) {
          // offene Fächer: wenige Objekte
          const hh = Math.min(ch - 0.04, 0.12 + R() * 0.14);
          b.cyl(0.035, 0.045, hh, getMaterial({ color: ["#ece3d2", "#a7b59e", "#c9a55c", "#3a3b3c", "#b8653f"][Math.floor(R() * 5)], material: R() > 0.8 ? "brass" : "ceramic" }), cx + (R() - 0.5) * cw * 0.3, ya, 0, 18);
        }
      }
    }
  }
}
