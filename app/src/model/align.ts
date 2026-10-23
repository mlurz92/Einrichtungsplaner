import type { PlacedItem } from "./types";
import { bbox, footprint } from "./geometry";

export type AlignMode = "left" | "right" | "top" | "bottom" | "centerX" | "centerY";

type Box = Pick<PlacedItem, "id" | "x" | "y" | "rot" | "w" | "d">;

/** Verschiebungen (dx, dy) je Objekt, damit die Grundrisse bündig/mittig ausgerichtet sind (Planachsen). */
export function alignOffsets(items: Box[], mode: AlignMode): Map<string, [number, number]> {
  const bbs = items.map((i) => ({ id: i.id, b: bbox(footprint(i)) }));
  const out = new Map<string, [number, number]>();
  if (bbs.length < 2) return out;
  const minX = Math.min(...bbs.map((e) => e.b[0])), maxX = Math.max(...bbs.map((e) => e.b[2]));
  const minY = Math.min(...bbs.map((e) => e.b[1])), maxY = Math.max(...bbs.map((e) => e.b[3]));
  const cx = bbs.reduce((a, e) => a + (e.b[0] + e.b[2]) / 2, 0) / bbs.length;
  const cy = bbs.reduce((a, e) => a + (e.b[1] + e.b[3]) / 2, 0) / bbs.length;
  for (const { id, b } of bbs) {
    const [x0, y0, x1, y1] = b;
    const d: [number, number] =
      mode === "left" ? [minX - x0, 0]
      : mode === "right" ? [maxX - x1, 0]
      : mode === "top" ? [0, minY - y0]
      : mode === "bottom" ? [0, maxY - y1]
      : mode === "centerX" ? [cx - (x0 + x1) / 2, 0]
      : [0, cy - (y0 + y1) / 2];
    out.set(id, d);
  }
  return out;
}

/** Gleichmäßige Abstände zwischen den Grundrissen entlang x oder y (äußere Objekte bleiben stehen). */
export function distributeOffsets(items: Box[], axis: "x" | "y"): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  if (items.length < 3) return out;
  const k = axis === "x" ? 0 : 1;
  const bbs = items.map((i) => ({ id: i.id, b: bbox(footprint(i)) })).sort((a, b) => a.b[k] + a.b[k + 2] - (b.b[k] + b.b[k + 2]));
  const total = bbs.reduce((a, e) => a + (e.b[k + 2] - e.b[k]), 0);
  const span = bbs[bbs.length - 1].b[k + 2] - bbs[0].b[k];
  const gap = (span - total) / (bbs.length - 1);
  let pos = bbs[0].b[k];
  for (const e of bbs) {
    const delta = pos - e.b[k];
    out.set(e.id, axis === "x" ? [delta, 0] : [0, delta]);
    pos += e.b[k + 2] - e.b[k] + gap;
  }
  return out;
}
