import type { Apartment, ApartmentOpening, PlacedItem, Vec2 } from "./types";

export const DEG = Math.PI / 180;

export function polygonArea(p: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function pointInPolygon(x: number, y: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(p: Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
    a += f;
  }
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
}

export function bbox(points: Vec2[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Ecken der Grundfläche eines Objekts (Plan-Koordinaten, Reihenfolge hinten-links … vorne-links). */
export function footprint(it: Pick<PlacedItem, "x" | "y" | "rot" | "w" | "d">, grow = 0): Vec2[] {
  const a = it.rot * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const hw = it.w / 2 + grow;
  const hd = it.d / 2 + grow;
  const loc: Vec2[] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return loc.map(([lx, ly]) => [it.x + lx * c - ly * s, it.y + lx * s + ly * c]);
}

/** Plan → lokal (Objektachsen). */
export function toLocal(it: Pick<PlacedItem, "x" | "y" | "rot">, px: number, py: number): Vec2 {
  const a = -it.rot * DEG;
  const dx = px - it.x;
  const dy = py - it.y;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

export function localToPlan(it: Pick<PlacedItem, "x" | "y" | "rot">, lx: number, ly: number): Vec2 {
  const a = it.rot * DEG;
  return [it.x + lx * Math.cos(a) - ly * Math.sin(a), it.y + lx * Math.sin(a) + ly * Math.cos(a)];
}

/** Separating-Axis-Test zweier konvexer Polygone. */
export function polygonsOverlap(a: Vec2[], b: Vec2[], eps = 0.004): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y2 - y1;
      const ny = x1 - x2;
      const len = Math.hypot(nx, ny) || 1;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [x, y] of a) {
        const p = (x * nx + y * ny) / len;
        minA = Math.min(minA, p);
        maxA = Math.max(maxA, p);
      }
      for (const [x, y] of b) {
        const p = (x * nx + y * ny) / len;
        minB = Math.min(minB, p);
        maxB = Math.max(maxB, p);
      }
      if (maxA - eps <= minB || maxB - eps <= minA) return false;
    }
  }
  return true;
}

export function segmentDistance(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number; q: Vec2 } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  const q: Vec2 = [a[0] + t * dx, a[1] + t * dy];
  return { d: dist(p, q), t, q };
}

// ---------------------------------------------------------------- Wandflächen
export type SpanKind = "wall" | "door" | "window" | "open";

export interface WallSpan {
  t0: number;
  t1: number;
  kind: SpanKind;
  openingId?: string;
}

export interface WallFace {
  id: string;
  roomId: string;
  index: number;
  a: Vec2;
  b: Vec2;
  /** Einheitsrichtung a→b. */
  u: Vec2;
  /** Normale in den Raum. */
  n: Vec2;
  length: number;
  spans: WallSpan[];
  /** Wandanteil (0–1) – Kanten ohne Wand (offene Raumgrenze) werden nicht verkleidet. */
  wallRatio: number;
  angleDeg: number;
}

function insideAnyWall(apt: Apartment, x: number, y: number): boolean {
  for (const w of apt.walls) if (pointInPolygon(x, y, w)) return true;
  return false;
}

function openingAt(apt: Apartment, x: number, y: number): ApartmentOpening | undefined {
  for (const o of apt.openings) if (o.reveal && pointInPolygon(x, y, o.reveal)) return o;
  return undefined;
}

export function computeWallFaces(apt: Apartment): WallFace[] {
  const faces: WallFace[] = [];
  for (const room of apt.rooms) {
    const P = room.polygon;
    const ccw = polygonArea(P) > 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      const L = dist(a, b);
      if (L < 0.005) continue;
      const u: Vec2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      // In y-unten-Koordinaten: Polygon mit positiver Fläche → Innenseite links der Kante = (u_y, -u_x)? geprüft per Punkt
      let n: Vec2 = ccw ? [-u[1], u[0]] : [u[1], -u[0]];
      const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (!pointInPolygon(mid[0] + n[0] * 0.02, mid[1] + n[1] * 0.02, P)) n = [-n[0], -n[1]];
      // Abtasten hinter der Fläche
      const steps = Math.max(4, Math.ceil(L / 0.01));
      const samples: { kind: SpanKind; id?: string }[] = [];
      for (let k = 0; k < steps; k++) {
        const t = (k + 0.5) / steps;
        const px = a[0] + (b[0] - a[0]) * t - n[0] * 0.03;
        const py = a[1] + (b[1] - a[1]) * t - n[1] * 0.03;
        if (insideAnyWall(apt, px, py)) samples.push({ kind: "wall" });
        else {
          const o = openingAt(apt, px, py);
          if (o) samples.push({ kind: o.type === "window" ? "window" : "door", id: o.id });
          else samples.push({ kind: "open" });
        }
      }
      const spans: WallSpan[] = [];
      for (let k = 0; k < steps; k++) {
        const s = samples[k];
        const last = spans[spans.length - 1];
        if (last && last.kind === s.kind && last.openingId === s.id) last.t1 = (k + 1) / steps;
        else spans.push({ t0: k / steps, t1: (k + 1) / steps, kind: s.kind, openingId: s.id });
      }
      // Ausreißer (Einzelsamples an Ecken) glätten
      const merged: WallSpan[] = [];
      for (const s of spans) {
        if ((s.t1 - s.t0) * L < 0.025 && merged.length) {
          merged[merged.length - 1].t1 = s.t1;
          continue;
        }
        const last = merged[merged.length - 1];
        if (last && last.kind === s.kind && last.openingId === s.openingId) last.t1 = s.t1;
        else merged.push({ ...s });
      }
      const wallRatio = merged.filter((s) => s.kind !== "open").reduce((acc, s) => acc + s.t1 - s.t0, 0);
      faces.push({
        id: `${room.id}:${i}`,
        roomId: room.id,
        index: i,
        a,
        b,
        u,
        n,
        length: L,
        spans: merged,
        wallRatio,
        angleDeg: (Math.atan2(u[1], u[0]) * 180) / Math.PI,
      });
    }
  }
  return faces;
}

export function roomAt(apt: Apartment, x: number, y: number): string | undefined {
  for (const r of apt.rooms) if (pointInPolygon(x, y, r.polygon)) return r.id;
  return undefined;
}

/** Nächste Wandfläche zu einem Punkt (für Wandmontage und Andocken). */
export function nearestFace(faces: WallFace[], x: number, y: number, maxDist = 0.6): { face: WallFace; d: number; t: number } | null {
  let best: { face: WallFace; d: number; t: number } | null = null;
  for (const f of faces) {
    if (f.wallRatio < 0.2) continue;
    const r = segmentDistance([x, y], f.a, f.b);
    // nur Raumseite
    const side = (x - r.q[0]) * f.n[0] + (y - r.q[1]) * f.n[1];
    if (side < -0.05) continue;
    if (r.d <= maxDist && (!best || r.d < best.d)) best = { face: f, d: r.d, t: r.t };
  }
  return best;
}

/** Rotation, bei der die Objektvorderseite in Richtung der Wandnormalen zeigt. */
export function rotationForFace(face: WallFace): number {
  // Front (lokal +y) = (−sin θ, cos θ) soll n entsprechen
  const th = Math.atan2(-face.n[0], face.n[1]) / DEG;
  return (th + 360) % 360;
}

export function snapAngle(deg: number, step = 15, wing = 8): number {
  // rastet auf Vielfache von step, zusätzlich auf die Flügelausrichtung (8°)
  const cands: number[] = [];
  for (let k = 0; k < 360; k += step) {
    cands.push(k, (k + wing) % 360);
  }
  let best = deg;
  let bd = Infinity;
  for (const c of cands) {
    const d = Math.abs(((deg - c + 540) % 360) - 180);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export function normAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function fmtM(v: number, digits = 2): string {
  return v.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtCm(v: number): string {
  return `${Math.round(v * 1000) / 10}`.replace(".", ",");
}

export function fmtEuro(v: number): string {
  return v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}
