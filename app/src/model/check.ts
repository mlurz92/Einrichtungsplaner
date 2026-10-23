// Planungs-Check: Bewegungsflächen, Türschwenkbereiche, Balkonzugänge, Möbel in der Wand, Lieferweg.
// Richtwerte nach DIN 18011 (Stell- und Bewegungsflächen im Wohnungsbau), DIN 18022 (Küche/Bad)
// und gängigen Planungsmaßen; „min“ = darunter kaum nutzbar, „gut“ = komfortabel.

import type { Apartment, CatalogItem, PlacedItem, Vec2 } from "./types";
import { DEG, footprint, localToPlan, pointInPolygon, polygonArea, polygonsOverlap, type WallFace } from "./geometry";

export type CheckLevel = "fehler" | "warnung" | "hinweis";

export interface CheckFinding {
  id: string;
  level: CheckLevel;
  kind: "bewegung" | "tuer" | "fenster" | "wand" | "lieferung" | "abstand";
  title: string;
  detail: string;
  itemIds: string[];
  at: Vec2;
}

export interface ClearanceZone {
  poly: Vec2[];
  state: "ok" | "eng" | "zu";
  label?: string;
}

export interface RoomStats {
  roomId: string;
  area: number;
  /** Stellfläche der Möbel (ohne Teppiche, Wand-/Deckenobjekte) in m². */
  occupied: number;
  free: number;
  items: number;
}

export interface CheckResult {
  findings: CheckFinding[];
  zones: ClearanceZone[];
  rooms: RoomStats[];
}

/** Bewegungsfläche vor einer Möbelseite (cm). */
interface Rule {
  min: number;
  good: number;
  what: string;
}

const FRONT_RULES: Partial<Record<string, Rule>> = {
  wardrobe: { min: 70, good: 90, what: "vor dem Kleiderschrank" },
  dresser: { min: 70, good: 90, what: "vor der Kommode" },
  sideboard: { min: 60, good: 80, what: "vor dem Sideboard" },
  cabinet: { min: 60, good: 80, what: "vor dem Schrank" },
  lowboard: { min: 50, good: 70, what: "vor dem Lowboard" },
  shelf: { min: 50, good: 70, what: "vor dem Regal" },
  desk: { min: 80, good: 100, what: "für den Stuhl am Schreibtisch" },
  kitchenRun: { min: 100, good: 120, what: "vor der Küchenzeile" },
  washer: { min: 70, good: 90, what: "vor der Waschmaschine" },
  toilet: { min: 55, good: 70, what: "vor dem WC" },
  washbasin: { min: 55, good: 70, what: "vor dem Waschtisch" },
  bathtub: { min: 70, good: 90, what: "vor der Wanne" },
  bed: { min: 50, good: 70, what: "am Fußende des Bettes" },
};
const BED_SIDE: Rule = { min: 60, good: 70, what: "neben dem Bett" };
const DINING: Rule = { min: 75, good: 90, what: "hinter den Stühlen am Esstisch" };

/** Kategorien, die keine Hindernisse für Bewegungsflächen sind. */
const SOFT = new Set(["rug", "curtain", "textile", "decor", "art", "mirror", "wallPanel", "molding"]);
const SEATS = new Set(["chair", "stool", "officeChair", "pouf"]);

export type CatalogLookup = (id: string) => CatalogItem | undefined;

interface Ctx {
  apt: Apartment;
  faces: WallFace[];
  cat: CatalogLookup;
  obstacles: { id: string; poly: Vec2[]; category: string }[];
  wallPolys: Vec2[][];
}

function kindOf(it: PlacedItem, cat: CatalogLookup): { category: string; archetype: string } {
  const c = cat(it.catalogId);
  return { category: c?.category ?? "", archetype: c?.archetype ?? "box" };
}

function isFloorSolid(it: PlacedItem, cat: CatalogLookup): boolean {
  if (it.hidden || it.mount !== "floor" || it.elev > 0.3) return false;
  const { category } = kindOf(it, cat);
  return !SOFT.has(category) && it.h > 0.05;
}

/** Abstand vom Punkt o entlang d bis zur ersten Kante eines Polygons (oder null). */
function rayPoly(o: Vec2, d: Vec2, poly: Vec2[], maxL: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den;
    const s = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
    if (t > 0.002 && s >= 0 && s <= 1 && t < maxL && (best === null || t < best)) best = t;
  }
  return best;
}

/**
 * Freie Tiefe vor einer Möbelseite: mehrere Strahlen über die Seitenbreite gegen Wände und Möbel.
 * Liefert den kleinsten Wert und das verursachende Objekt.
 */
function clearDepth(ctx: Ctx, it: PlacedItem, side: "front" | "left" | "right", span: [number, number], ignore: (o: { id: string; category: string }) => boolean, maxL = 1.6): { depth: number; by?: string } {
  const a = it.rot * DEG;
  const fwd: Vec2 = [-Math.sin(a), Math.cos(a)];
  const right: Vec2 = [Math.cos(a), Math.sin(a)];
  const dir: Vec2 = side === "front" ? fwd : side === "right" ? right : [-right[0], -right[1]];
  let depth = maxL;
  let by: string | undefined;
  const N = 7;
  for (let k = 0; k < N; k++) {
    const f = span[0] + ((span[1] - span[0]) * k) / (N - 1);
    const o: Vec2 =
      side === "front"
        ? localToPlan(it, -it.w / 2 + it.w * f, it.d / 2 + 0.001)
        : localToPlan(it, (side === "right" ? 1 : -1) * (it.w / 2 + 0.001), -it.d / 2 + it.d * f);
    for (const w of ctx.wallPolys) {
      const t = rayPoly(o, dir, w, depth);
      if (t !== null && t < depth) {
        depth = t;
        by = undefined;
      }
    }
    for (const ob of ctx.obstacles) {
      if (ob.id === it.id || ignore(ob)) continue;
      const t = rayPoly(o, dir, ob.poly, depth);
      if (t !== null && t < depth) {
        depth = t;
        by = ob.id;
      }
    }
  }
  return { depth, by };
}

function zoneRect(it: PlacedItem, side: "front" | "left" | "right", depth: number, span: [number, number] = [0, 1]): Vec2[] {
  if (side === "front") {
    const x0 = -it.w / 2 + it.w * span[0], x1 = -it.w / 2 + it.w * span[1];
    return [localToPlan(it, x0, it.d / 2), localToPlan(it, x1, it.d / 2), localToPlan(it, x1, it.d / 2 + depth), localToPlan(it, x0, it.d / 2 + depth)];
  }
  const s = side === "right" ? 1 : -1;
  const y0 = -it.d / 2 + it.d * span[0], y1 = -it.d / 2 + it.d * span[1];
  return [localToPlan(it, (s * it.w) / 2, y0), localToPlan(it, (s * it.w) / 2 + s * depth, y0), localToPlan(it, (s * it.w) / 2 + s * depth, y1), localToPlan(it, (s * it.w) / 2, y1)];
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o = (p: Vec2, q: Vec2, r: Vec2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function polygonEdgesCross(p: Vec2[], q: Vec2[]): boolean {
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < q.length; j++) if (segmentsCross(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length])) return true;
  return false;
}

const cm = (m: number) => Math.round(m * 100);

function nameOf(it: PlacedItem, cat: CatalogLookup): string {
  return it.label ?? cat(it.catalogId)?.name ?? "Objekt";
}

/** Lichte Durchgangsbreite einer Tür aus der Rohbaubreite (Zarge/Türblatt ca. 12 cm). */
export function clearDoorWidth(rawWidth: number): number {
  return Math.max(0, rawWidth - 0.12);
}

/** Passt ein Quader (m) durch eine Öffnung, ggf. gekippt? Die zwei kleinsten Maße müssen in Breite × Höhe passen. */
export function fitsThrough(dims: [number, number, number], clearW: number, clearH: number): boolean {
  const [s1, s2] = [...dims].sort((a, b) => a - b);
  return (s1 <= clearW && s2 <= clearH) || (s1 <= clearH && s2 <= clearW);
}

/** Typischerweise montiert gelieferte Möbel (Polster, Massivholz) – Betten und Flachpaket-Händler ausgenommen. */
const BULKY = new Set(["sofa", "armchair", "wardrobe", "cabinet", "sideboard", "dresser", "diningTable", "lowboard", "bench", "desk"]);
const FLATPACK_VENDORS = new Set(["IKEA", "JYSK", "Tylko"]);

export function runChecks(items: PlacedItem[], apt: Apartment, faces: WallFace[], cat: CatalogLookup): CheckResult {
  const findings: CheckFinding[] = [];
  const zones: ClearanceZone[] = [];
  const solid = items.filter((i) => isFloorSolid(i, cat));
  const windowReveals = apt.openings.filter((o) => o.type === "window" && o.reveal).map((o) => o.reveal!);
  const ctx: Ctx = {
    apt,
    faces,
    cat,
    obstacles: solid.map((i) => ({ id: i.id, poly: footprint(i), category: kindOf(i, cat).category })),
    wallPolys: [...apt.walls, ...windowReveals],
  };
  const byId = new Map(items.map((i) => [i.id, i]));
  // Konflikte nur zwischen Bestandsobjekten (Sanitär, Küche) sind nicht änderbar und werden nicht gemeldet.
  const push = (f: Omit<CheckFinding, "id">) => {
    if (f.itemIds.every((id) => byId.get(id)?.existing)) return;
    findings.push({ ...f, id: `${f.kind}:${f.itemIds.join(",")}:${findings.length}` });
  };
  const rate = (depth: number, r: Rule): ClearanceZone["state"] => (depth * 100 >= r.good - 0.5 ? "ok" : depth * 100 >= r.min - 0.5 ? "eng" : "zu");

  const report = (it: PlacedItem, r: Rule, res: { depth: number; by?: string }, zone: Vec2[], side?: string) => {
    const state = rate(res.depth, r);
    const blocker = res.by ? byId.get(res.by) : undefined;
    // Bestand gegen Bestand (bzw. Wand) ist nicht änderbar: weder Zone noch Meldung
    if (state !== "ok" && it.existing && (!blocker || blocker.existing)) return;
    zones.push({ poly: zone, state, label: `${cm(Math.min(res.depth, r.good / 100))}` });
    if (state === "ok") return;
    const by = blocker ? ` (durch ${nameOf(blocker, cat)})` : " (Wand)";
    push({
      level: state === "zu" ? "warnung" : "hinweis",
      kind: "bewegung",
      title: `${nameOf(it, cat)}: nur ${cm(res.depth)} cm ${r.what}${side ?? ""}`,
      detail: `Empfohlen ≥ ${r.good} cm, Minimum ${r.min} cm${by}.`,
      itemIds: blocker ? [it.id, blocker.id] : [it.id],
      at: [it.x, it.y],
    });
  };

  // ---------------------------------------------------------------- Bewegungsflächen
  for (const it of items) {
    if (it.hidden || it.mount !== "floor") continue;
    const { category, archetype } = kindOf(it, cat);
    const key = FRONT_RULES[archetype] ? archetype : category;
    const r = FRONT_RULES[key];
    const ignoreSeats = (o: { category: string }) => SEATS.has(o.category);
    if (r) {
      const ignore = category === "desk" ? ignoreSeats : () => false;
      // Schreibtisch: nur der Stuhlbereich in der Mitte zählt
      const span: [number, number] = category === "desk" ? [0.25, 0.75] : [0.1, 0.9];
      const res = clearDepth(ctx, it, "front", span, ignore);
      report(it, r, res, zoneRect(it, "front", Math.min(res.depth, r.good / 100), span));
    }
    if (category === "bed") {
      // Seiten ab Kopfteil-Ende (Nachttische) bis Fußende; Einzelbett: eine freie Seite genügt
      const span: [number, number] = [0.4, 0.95];
      const ignore = (o: { category: string }) => o.category === "nightstand";
      const L = clearDepth(ctx, it, "left", span, ignore);
      const R = clearDepth(ctx, it, "right", span, ignore);
      const double = it.w >= 1.35;
      if (double) {
        report(it, BED_SIDE, L, zoneRect(it, "left", Math.min(L.depth, 0.7), span), " (links)");
        report(it, BED_SIDE, R, zoneRect(it, "right", Math.min(R.depth, 0.7), span), " (rechts)");
      } else {
        const best = L.depth >= R.depth ? { res: L, side: "left" as const } : { res: R, side: "right" as const };
        report(it, BED_SIDE, best.res, zoneRect(it, best.side, Math.min(best.res.depth, 0.7), span));
      }
    }
    if (category === "diningTable" || archetype === "outdoorTable") {
      // Seiten mit Stühlen: Stuhlzone ab Tischkante (Stuhl + Aufstehen + Vorbeigehen)
      const chairs = items.filter((c) => !c.hidden && SEATS.has(kindOf(c, cat).category) && Math.hypot(c.x - it.x, c.y - it.y) < Math.max(it.w, it.d) / 2 + 0.8);
      const sides: { side: "front" | "left" | "right" | "back"; rot: number }[] = [
        { side: "front", rot: 0 },
        { side: "back", rot: 180 },
        { side: "right", rot: 0 },
        { side: "left", rot: 0 },
      ];
      for (const s of sides) {
        const has = chairs.some((c) => {
          const lx = (c.x - it.x) * Math.cos(-it.rot * DEG) - (c.y - it.y) * Math.sin(-it.rot * DEG);
          const ly = (c.x - it.x) * Math.sin(-it.rot * DEG) + (c.y - it.y) * Math.cos(-it.rot * DEG);
          if (s.side === "front") return ly > it.d / 2 - 0.1 && Math.abs(lx) < it.w / 2;
          if (s.side === "back") return ly < -it.d / 2 + 0.1 && Math.abs(lx) < it.w / 2;
          if (s.side === "right") return lx > it.w / 2 - 0.1 && Math.abs(ly) < it.d / 2;
          return lx < -it.w / 2 + 0.1 && Math.abs(ly) < it.d / 2;
        });
        if (!has) continue;
        const ref = s.side === "back" ? { ...it, rot: it.rot + 180 } : it;
        const side = s.side === "back" ? "front" : s.side;
        const res = clearDepth(ctx, ref, side, [0.15, 0.85], (o) => SEATS.has(o.category) || o.category === "rug");
        report(it, DINING, res, zoneRect(ref, side, Math.min(res.depth, DINING.good / 100), [0.15, 0.85]));
      }
    }
    if (category === "sofa") {
      // Couchtisch: 30–50 cm Abstand zur Sitzkante
      const table = solid.find((t) => kindOf(t, cat).category === "coffeeTable" && Math.hypot(t.x - it.x, t.y - it.y) < it.d / 2 + 1.4);
      if (table) {
        const res = clearDepth(ctx, it, "front", [0.25, 0.75], (o) => o.id !== table.id);
        if (res.by === table.id && (res.depth < 0.28 || res.depth > 0.62)) {
          push({
            level: "hinweis",
            kind: "abstand",
            title: `Couchtisch ${res.depth < 0.28 ? "sehr nah" : "weit"} am Sofa: ${cm(res.depth)} cm`,
            detail: "Üblich sind 30–50 cm zwischen Sitzkante und Couchtisch.",
            itemIds: [it.id, table.id],
            at: [table.x, table.y],
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------- Türen und Fenster
  const outdoor = new Set(apt.rooms.filter((r) => r.outdoor).map((r) => r.id));
  const openingById = new Map(apt.openings.map((o) => [o.id, o]));
  for (const f of faces) {
    for (const sp of f.spans) {
      if (!sp.openingId || (sp.kind !== "door" && sp.kind !== "window")) continue;
      const o = openingById.get(sp.openingId);
      if (!o) continue;
      const p0: Vec2 = [f.a[0] + (f.b[0] - f.a[0]) * sp.t0, f.a[1] + (f.b[1] - f.a[1]) * sp.t0];
      const p1: Vec2 = [f.a[0] + (f.b[0] - f.a[0]) * sp.t1, f.a[1] + (f.b[1] - f.a[1]) * sp.t1];
      const w = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (w < 0.3) continue;
      const out = (p: Vec2, d: number): Vec2 => [p[0] + f.n[0] * d, p[1] + f.n[1] * d];
      if (o.type === "window") {
        if (outdoor.has(f.roomId)) continue;
        const balcony = !!o.balconyDoor || /Fenstertür/i.test(o.label);
        const depth = balcony ? 0.9 : 0.3;
        const zone: Vec2[] = [p0, p1, out(p1, depth), out(p0, depth)];
        for (const it of solid) {
          if (it.existing || (!balcony && it.h < 1.0)) continue; // Bestand und niedrige Möbel vor Fenstern sind unkritisch
          const fp = footprint(it, -0.01);
          if (!polygonsOverlap(fp, zone)) continue;
          zones.push({ poly: zone, state: balcony ? "zu" : "eng" });
          push({
            level: balcony ? "fehler" : "hinweis",
            kind: "fenster",
            title: balcony ? `Balkonzugang verstellt: ${nameOf(it, cat)}` : `${nameOf(it, cat)} verdeckt ${o.label}`,
            detail: balcony ? "Vor Fenstertüren 90 cm Bewegungsfläche freihalten." : "Hohe Möbel vor Fenstern nehmen Licht und behindern das Öffnen/Lüften.",
            itemIds: [it.id],
            at: [it.x, it.y],
          });
        }
        continue;
      }
      // Tür: Schwenkbereich auf der Aufschlagseite, sonst 60 cm Vorfläche
      const L = o.width;
      const u: Vec2 = [(o.b[0] - o.a[0]) / L, (o.b[1] - o.a[1]) / L];
      const sw = o.swing ?? 1;
      const nO: Vec2 = [-u[1] * sw, u[0] * sw];
      const swingSide = nO[0] * f.n[0] + nO[1] * f.n[1] > 0;
      let zone: Vec2[];
      if (swingSide) {
        const hingeWorld = o.hinge === "b" ? o.b : o.a;
        const d0 = Math.hypot(hingeWorld[0] - p0[0], hingeWorld[1] - p0[1]);
        const d1 = Math.hypot(hingeWorld[0] - p1[0], hingeWorld[1] - p1[1]);
        const [c, far] = d0 <= d1 ? [p0, p1] : [p1, p0];
        const r = Math.min(w, o.leafWidth ?? w);
        const along: Vec2 = [(far[0] - c[0]) / w, (far[1] - c[1]) / w];
        zone = [c];
        for (let k = 0; k <= 8; k++) {
          const th = (k / 8) * (Math.PI / 2);
          zone.push([c[0] + r * (Math.cos(th) * along[0] + Math.sin(th) * f.n[0]), c[1] + r * (Math.cos(th) * along[1] + Math.sin(th) * f.n[1])]);
        }
      } else {
        zone = [p0, p1, out(p1, 0.6), out(p0, 0.6)];
      }
      let hit = false;
      for (const it of solid) {
        if (it.existing || !polygonsOverlap(footprint(it, -0.01), zone)) continue;
        hit = true;
        push({
          level: swingSide ? "fehler" : "warnung",
          kind: "tuer",
          title: swingSide ? `${nameOf(it, cat)} im Schwenkbereich: ${o.label}` : `${nameOf(it, cat)} verstellt ${o.label}`,
          detail: swingSide ? "Die Tür lässt sich nicht vollständig öffnen." : "Vor Türen mindestens 60 cm frei lassen.",
          itemIds: [it.id],
          at: [it.x, it.y],
        });
      }
      zones.push({ poly: zone, state: hit ? "zu" : "ok" });
    }
  }

  // ---------------------------------------------------------------- Möbel in der Wand
  for (const it of solid) {
    const fp = footprint(it, -0.03);
    const inWall = apt.walls.some((w) => fp.some((p) => pointInPolygon(p[0], p[1], w)) || polygonEdgesCross(fp, w) || w.some((p) => pointInPolygon(p[0], p[1], fp)));
    if (inWall) push({ level: "fehler", kind: "wand", title: `${nameOf(it, cat)} ragt in die Wand`, detail: "Position oder Maße prüfen.", itemIds: [it.id], at: [it.x, it.y] });
  }

  // ---------------------------------------------------------------- Lieferweg
  const entrance = apt.openings.find((o) => o.id === "D-ENT") ?? apt.openings.find((o) => o.type === "entrance");
  const clearH = (entrance?.height ?? 2.01) - 0.06;
  const roomDoor = new Map<string, number>();
  for (const f of faces)
    for (const sp of f.spans) {
      const o = sp.openingId ? openingById.get(sp.openingId) : undefined;
      if (o && o.type !== "window") roomDoor.set(f.roomId, Math.max(roomDoor.get(f.roomId) ?? 0, o.width));
    }
  for (const it of items) {
    if (it.existing || it.hidden || it.mount !== "floor") continue;
    const c = cat(it.catalogId);
    if (!c || !BULKY.has(c.category) || FLATPACK_VENDORS.has(c.vendor)) continue;
    let raw = entrance?.width ?? 1.0;
    const rd = it.room ? roomDoor.get(it.room) : undefined;
    if (rd) raw = Math.min(raw, rd);
    const cw = clearDoorWidth(raw);
    if (!fitsThrough([it.w, it.d, it.h], cw, clearH)) {
      push({
        level: "hinweis",
        kind: "lieferung",
        title: `Lieferung prüfen: ${nameOf(it, cat)}`,
        detail: `${cm(it.w)} × ${cm(it.d)} × ${cm(it.h)} cm passt montiert nicht durch die Tür (lichte Breite ca. ${cm(cw)} cm). Zerlegbar oder Teillieferung?`,
        itemIds: [it.id],
        at: [it.x, it.y],
      });
    }
  }

  // ---------------------------------------------------------------- Raumkennzahlen
  const rooms: RoomStats[] = apt.rooms.map((r) => {
    const inRoom = solid.filter((i) => i.room === r.id || (!i.room && pointInPolygon(i.x, i.y, r.polygon)));
    const occupied = inRoom.reduce((a, i) => a + Math.abs(polygonArea(footprint(i))), 0);
    return { roomId: r.id, area: r.area, occupied, free: Math.max(0, r.area - occupied), items: items.filter((i) => i.room === r.id && !i.hidden).length };
  });

  const order: Record<CheckLevel, number> = { fehler: 0, warnung: 1, hinweis: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level]);
  return { findings, zones, rooms };
}
