import type { PlacedItem, Vec2 } from "./types";
import { DEG, rotationForFace, segmentDistance, type WallFace } from "./geometry";

/** Möbel, die üblicherweise mit der Rückseite an der Wand stehen. */
export const WALL_BACKED = new Set([
  "sofa", "sofaModular", "sofaCorner", "sofaBed", "console", "sideboard", "lowboard", "vitrine", "shelfOpen", "bookcase",
  "wardrobe", "dresser", "nightstand", "bed", "bedWood", "desk", "deskStanding", "kitchenRun", "kitchenAlno", "kitchenAlnoSide", "washer", "bench", "tylkoStorage",
]);

export interface SnapGuide {
  a: Vec2;
  b: Vec2;
}

export interface SnapResult {
  x: number;
  y: number;
  rot: number;
  guides: SnapGuide[];
}

/** Fangradius für das Anlegen einer Seite an eine parallele Wand. */
export const FLUSH_CAPTURE = 0.2;
/** Fangradius für das Andrehen der Rückseite an die Wand. */
export const BACK_CAPTURE = 0.4;
/** Höchstabweichung der aktuellen Drehung, bis zu der automatisch zur Wand gedreht wird. */
export const BACK_MAX_TURN = 50;
const GAP = 0.002;

const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

function guideFor(f: WallFace, p: Vec2, half: number): SnapGuide {
  // Hilfslinie: Stück der Wandfläche entlang der angelegten Objektseite (± 0,4 m)
  const r = segmentDistance(p, f.a, f.b);
  const ext = half + 0.4;
  const t0 = Math.max(0, r.t - ext / f.length);
  const t1 = Math.min(1, r.t + ext / f.length);
  const at = (t: number): Vec2 => [f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t];
  return { a: at(t0), b: at(t1) };
}

/**
 * Wandfang für Bodenobjekte.
 * 1. Wandmöbel (Sofa, Sideboard, Bett …): liegt die Rückseite ≤ 40 cm vor einer Wand und weicht die
 *    Drehung ≤ 50° ab, wird das Objekt mit der Rückseite zur Wand gedreht und bündig angelegt.
 * 2. Alle Objekte: Seiten, die ≤ 20 cm vor einer parallelen Wand liegen (oder in sie hineinragen),
 *    werden bündig angelegt – zwei Achsen ergeben den Eckfang.
 */
export function snapFloorItem(it: Pick<PlacedItem, "x" | "y" | "rot" | "w" | "d">, faces: WallFace[], wallBacked: boolean): SnapResult {
  let { x, y, rot } = it;
  const guides: SnapGuide[] = [];
  const usedAxes: Vec2[] = [];

  if (wallBacked) {
    let best: { f: WallFace; gap: number; rot: number } | null = null;
    for (const f of faces) {
      if (f.wallRatio < 0.3) continue;
      const r = rotationForFace(f);
      if (angDiff(rot, r) > BACK_MAX_TURN) continue;
      const seg = segmentDistance([x, y], f.a, f.b);
      // Objektmitte muss vor der Wandfläche liegen (nicht über deren Enden hinaus)
      const along = ((x - f.a[0]) * f.u[0] + (y - f.a[1]) * f.u[1]) / f.length;
      if (along < -0.02 || along > 1.02 || seg.d > it.d / 2 + BACK_CAPTURE + 0.2) continue;
      const signed = (x - f.a[0]) * f.n[0] + (y - f.a[1]) * f.n[1];
      const gap = signed - it.d / 2;
      if (gap < -it.d / 2 || gap > BACK_CAPTURE) continue;
      if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { f, gap, rot: r };
    }
    if (best) {
      rot = best.rot;
      x -= best.f.n[0] * (best.gap - GAP);
      y -= best.f.n[1] * (best.gap - GAP);
      usedAxes.push(best.f.n);
      guides.push(guideFor(best.f, [x, y], it.w / 2));
    }
  }

  const a = rot * DEG;
  const ax: Vec2 = [Math.cos(a), Math.sin(a)];
  const ay: Vec2 = [-Math.sin(a), Math.cos(a)];
  const sides: { n: Vec2; half: number; along: number }[] = [
    { n: ay, half: it.d / 2, along: it.w / 2 },
    { n: [-ay[0], -ay[1]], half: it.d / 2, along: it.w / 2 },
    { n: ax, half: it.w / 2, along: it.d / 2 },
    { n: [-ax[0], -ax[1]], half: it.w / 2, along: it.d / 2 },
  ];
  for (const s of sides) {
    if (usedAxes.some((u) => Math.abs(u[0] * s.n[0] + u[1] * s.n[1]) > 0.9)) continue;
    const px = x + s.n[0] * s.half;
    const py = y + s.n[1] * s.half;
    let best: { f: WallFace; dist: number } | null = null;
    for (const f of faces) {
      if (f.wallRatio < 0.3) continue;
      // Wand muss der Objektseite gegenüberliegen (Toleranz ≈ 3°)
      if (f.n[0] * s.n[0] + f.n[1] * s.n[1] > -0.9986) continue;
      const along = ((px - f.a[0]) * f.u[0] + (py - f.a[1]) * f.u[1]) / f.length;
      // Seite muss die Wandfläche zumindest teilweise überdecken
      const m = s.along / f.length;
      if (along + m < 0.01 || along - m > 0.99) continue;
      const signed = (px - f.a[0]) * f.n[0] + (py - f.a[1]) * f.n[1];
      if (signed < -Math.min(0.3, s.half) || signed > FLUSH_CAPTURE) continue;
      if (!best || Math.abs(signed) < Math.abs(best.dist)) best = { f, dist: signed };
    }
    if (best) {
      x += s.n[0] * (best.dist - GAP);
      y += s.n[1] * (best.dist - GAP);
      usedAxes.push(s.n);
      guides.push(guideFor(best.f, [x + s.n[0] * s.half, y + s.n[1] * s.half], s.along));
    }
  }
  return { x, y, rot, guides };
}

/** Wandobjekte (Bilder, Spiegel, Wand-TV): an die nächste Wandfläche andocken. */
export function snapWallItem(it: Pick<PlacedItem, "x" | "y" | "d">, faces: WallFace[], maxDist = 1.2): SnapResult | null {
  let best: { f: WallFace; d: number; q: Vec2 } | null = null;
  for (const f of faces) {
    if (f.wallRatio < 0.2) continue;
    const r = segmentDistance([it.x, it.y], f.a, f.b);
    const side = (it.x - r.q[0]) * f.n[0] + (it.y - r.q[1]) * f.n[1];
    if (side < -0.05) continue;
    if (r.d <= maxDist && (!best || r.d < best.d)) best = { f, d: r.d, q: r.q };
  }
  if (!best) return null;
  const x = best.q[0] + best.f.n[0] * (it.d / 2 + GAP);
  const y = best.q[1] + best.f.n[1] * (it.d / 2 + GAP);
  return { x, y, rot: rotationForFace(best.f), guides: [guideFor(best.f, best.q, 0.3)] };
}
