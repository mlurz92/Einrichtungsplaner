import { apartment } from "../data";
import { pointInPolygon } from "../model/geometry";
import type { PlacedItem, Vec2 } from "../model/types";

// Hilfen für Kameraansichten: Raumansichten auf Augenhöhe und Kollision im Rundgang.

function segDist(px: number, py: number, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

function edgeDist(x: number, y: number, poly: Vec2[]) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(x, y, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

/** Liegt (x, y) in der Grundfläche eines höheren Möbels (zzgl. Abstand)? */
export function inFurniture(x: number, y: number, items: PlacedItem[], margin = 0.15): boolean {
  for (const i of items) {
    if (i.hidden || i.mount !== "floor" || i.h < 0.35) continue;
    const r = (i.rot * Math.PI) / 180;
    const dx = x - i.x, dy = y - i.y;
    const lx = dx * Math.cos(r) + dy * Math.sin(r);
    const ly = -dx * Math.sin(r) + dy * Math.cos(r);
    if (Math.abs(lx) < i.w / 2 + margin && Math.abs(ly) < i.d / 2 + margin) return true;
  }
  return false;
}

/** Punkt im Raum mit größtem Wandabstand (auch für L-förmige Räume innerhalb des Raums). */
export function roomPole(poly: Vec2[]): Vec2 {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  let best: Vec2 = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  let bestD = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.1)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.1) {
      if (!pointInPolygon(x, y, poly)) continue;
      const d = edgeDist(x, y, poly);
      if (d > bestD) {
        bestD = d;
        best = [x, y];
      }
    }
  return best;
}

/** Bleibt die Strecke a→b innerhalb des Raumpolygons? */
function insideAlong(poly: Vec2[], a: Vec2, b: Vec2): boolean {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(L / 0.15));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (!pointInPolygon(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, poly)) return false;
  }
  return true;
}

/**
 * Ansicht eines Raums auf Augenhöhe: Standpunkte am Raumrand (frei von Möbeln) werden danach bewertet,
 * wie viel Raumfläche (nach Entfernung gewichtet) im Bildausschnitt (±hFov/2) frei sichtbar ist;
 * Blick zum Schwerpunkt dieser Fläche.
 */
export function roomView(roomId: string, items: PlacedItem[], eye = 1.6, hFov = 80): { pos: [number, number, number]; target: [number, number, number] } | null {
  const room = apartment.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const poly = room.polygon as Vec2[];
  const pole = roomPole(poly);
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const samples: Vec2[] = [];
  for (let x = x0 + 0.25; x < x1; x += 0.5) for (let y = y0 + 0.25; y < y1; y += 0.5) if (pointInPolygon(x, y, poly)) samples.push([x, y]);
  const half = ((hFov / 2) * Math.PI) / 180;
  let best: { p: Vec2; t: Vec2; s: number } | null = null;
  for (let x = x0; x <= x1; x += 0.3)
    for (let y = y0; y <= y1; y += 0.3) {
      if (!pointInPolygon(x, y, poly)) continue;
      const ed = edgeDist(x, y, poly);
      if (ed < 0.3 || ed > 0.9 || inFurniture(x, y, items, 0.2)) continue;
      const a0 = Math.atan2(pole[1] - y, pole[0] - x);
      let cnt = 0, sx = 0, sy = 0;
      for (const q of samples) {
        const dx = q[0] - x, dy = q[1] - y;
        const d = Math.hypot(dx, dy);
        if (d < 0.8) continue;
        let da = Math.atan2(dy, dx) - a0;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > half || !insideAlong(poly, [x, y], q)) continue;
        // Tiefe zählt: weiter entfernte sichtbare Fläche ergibt den großzügigeren Raumeindruck
        cnt += d;
        sx += q[0] * d;
        sy += q[1] * d;
      }
      if (cnt && (!best || cnt > best.s)) best = { p: [x, y], t: [sx / cnt, sy / cnt], s: cnt };
    }
  if (!best) return { pos: [pole[0] - 1.2, eye, pole[1] - 1.2], target: [pole[0], 1.0, pole[1]] };
  return { pos: [best.p[0], eye, best.p[1]], target: [best.t[0], 1.0, best.t[1]] };
}
