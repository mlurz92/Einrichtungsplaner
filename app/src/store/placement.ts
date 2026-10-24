import { apartment, wallFaces } from "../data";
import { pointInPolygon, footprint, polygonCentroid, roomAt } from "../model/geometry";
import { snapFloorItem, snapWallItem, WALL_BACKED, type SnapGuide } from "../model/snap";
import type { PlacedItem } from "../model/types";
import { getCatalogItem } from "./project";

/** Möbel mit nutzbarer Oberseite (Ablage für Leuchten, Deko, TV auf Standfuß). */
const SURFACES = new Set([
  "sideboard", "lowboard", "console", "dresser", "nightstand", "tableRect", "tableRound", "tableOval", "tablePedestal",
  "coffeeDuo", "coffeeBlock", "coffeeRound", "sideRound", "sideContainer", "desk", "deskStanding", "shelfOpen", "bookcase",
  "vitrine", "kitchenRun", "kitchenAlno", "kitchenAlnoSide", "washer", "outdoorTable", "tylkoStorage",
]);
/** Objekte, die auf Möbeln abgestellt werden können. */
const PLACEABLE = new Set([
  "lampTableMushroom", "lampTableGlobe", "lampTableShade", "lampTableLayered", "lampTask", "vase", "books", "tray", "bowl", "candles",
  "plantPot", "glb", "box",
]);

/** Tische, über denen Pendelleuchten ausgerichtet werden. */
const TABLES = new Set(["tableRect", "tableRound", "tableOval", "tablePedestal", "outdoorTable", "desk", "kitchenRun", "coffeeDuo", "coffeeBlock", "coffeeRound"]);
/** Empfohlener Abstand Unterkante Pendelleuchte → Tischplatte (DIN EN 12464-1 / Praxis: 60–70 cm). */
export const PENDANT_CLEARANCE = 0.65;
const CEIL_CAPTURE = 0.3;

const arch = (it: PlacedItem) => getCatalogItem(it.catalogId)?.archetype ?? "box";

/** Höhe der nutzbaren Oberseite (Küchenzeilen: Arbeitsplatte statt Oberkante der Hochschränke). */
export function surfaceTop(s: PlacedItem): number {
  const a = arch(s);
  if (a === "kitchenAlno") return s.elev + 0.968;
  if (a === "kitchenRun") return s.elev + 0.9;
  return s.elev + s.h;
}

export function isPlaceable(it: PlacedItem): boolean {
  if (it.mount !== "floor") return false;
  const a = arch(it);
  return PLACEABLE.has(a) || (a === "tvFrame" && !!it.params?.stand);
}

/** Oberste Ablagefläche unter der Objektmitte (oder null = Boden). */
export function supportUnder(it: PlacedItem, items: PlacedItem[]): PlacedItem | null {
  let best: PlacedItem | null = null;
  for (const s of items) {
    if (s.id === it.id || s.hidden || s.mount !== "floor" || !SURFACES.has(arch(s))) continue;
    if (!pointInPolygon(it.x, it.y, footprint(s))) continue;
    if (!best || surfaceTop(s) > surfaceTop(best)) best = s;
  }
  return best;
}

/** Objekte, die auf `s` stehen (werden beim Verschieben mitgenommen). */
export function ridersOf(s: PlacedItem, items: PlacedItem[]): PlacedItem[] {
  if (s.mount !== "floor" || !SURFACES.has(arch(s))) return [];
  const top = surfaceTop(s);
  return items.filter((it) => it.id !== s.id && isPlaceable(it) && Math.abs(it.elev - top) < 0.03 && pointInPolygon(it.x, it.y, footprint(s)));
}

/**
 * Fang für ein einzeln bewegtes oder neu platziertes Objekt (mutiert `it`).
 * - Wandobjekte docken an die nächste Wandfläche an.
 * - Abstellbare Objekte (Leuchten, Deko, The Frame auf Standfuß) stehen auf dem Möbel darunter;
 *   der TV übernimmt dabei die Ausrichtung des Möbels.
 * - Übrige Bodenobjekte: Wandfang (Rückseite an die Wand drehen, Seiten bündig, Ecken).
 */
export function applyPlacementSnap(it: PlacedItem, items: PlacedItem[], baseRot: number, snapOn: boolean): SnapGuide[] {
  const a = arch(it);
  if (it.mount === "wall") {
    const r = snapWallItem(it, wallFaces);
    if (r) Object.assign(it, { x: r.x, y: r.y, rot: r.rot });
    return r?.guides ?? [];
  }
  if (it.mount === "ceiling") return snapCeilingItem(it, items, a, snapOn);
  if (it.mount !== "floor") return [];
  if (isPlaceable(it)) {
    const s = supportUnder(it, items);
    it.elev = s ? surfaceTop(s) : 0;
    if (s && a === "tvFrame") {
      const diff = Math.abs(((baseRot - s.rot + 540) % 360) - 180);
      if (diff <= 50 || diff >= 130) it.rot = s.rot;
    }
    if (s) return [];
  }
  if (!snapOn) return [];
  const r = snapFloorItem({ ...it, rot: baseRot }, wallFaces, WALL_BACKED.has(a));
  it.x = r.x;
  it.y = r.y;
  it.rot = r.rot;
  return r.guides;
}

/**
 * Deckenleuchten: Pendel über Tischen → Tischmitte bzw. Tischlängsachse, Höhe 65 cm über der Platte,
 * Drehung wie der Tisch; sonst Fang auf die Raummitte (≤ 30 cm).
 */
function snapCeilingItem(it: PlacedItem, items: PlacedItem[], a: string, snapOn: boolean): SnapGuide[] {
  const ceil = apartment.ceilingHeight;
  const pendant = a.startsWith("pendant");
  if (pendant) {
    const t = items.find((s) => s.id !== it.id && !s.hidden && TABLES.has(arch(s)) && pointInPolygon(it.x, it.y, footprint(s, 0.1)));
    if (t) {
      const top = t.elev + t.h;
      it.elev = Math.min(ceil - it.h - 0.05, top + PENDANT_CLEARANCE);
      if (!snapOn) return [];
      // Lage in Tischachsen
      const r = (t.rot * Math.PI) / 180;
      const ux = Math.cos(r), uy = Math.sin(r);
      const lx = (it.x - t.x) * ux + (it.y - t.y) * uy;
      const ly = -(it.x - t.x) * uy + (it.y - t.y) * ux;
      const ax = Math.abs(lx) < CEIL_CAPTURE ? 0 : lx;
      const ay = Math.abs(ly) < CEIL_CAPTURE ? 0 : ly;
      it.x = t.x + ax * ux - ay * uy;
      it.y = t.y + ax * uy + ay * ux;
      const long = t.w >= t.d;
      it.rot = a === "pendantLinear" && !long ? (t.rot + 90) % 360 : t.rot;
      const half = (long ? t.w : t.d) / 2;
      const dir: [number, number] = long ? [ux, uy] : [-uy, ux];
      return [{ a: [t.x - dir[0] * half, t.y - dir[1] * half], b: [t.x + dir[0] * half, t.y + dir[1] * half] }];
    }
  }
  // Pendel außerhalb von Tischen: Durchgangshöhe ≥ 2,00 m
  if (pendant && it.elev < 1.95) it.elev = Math.min(ceil - it.h - 0.05, 2.0);
  if (!snapOn) return [];
  const rid = roomAt(apartment, it.x, it.y);
  const room = apartment.rooms.find((r) => r.id === rid);
  if (!room) return [];
  const [cx, cy] = polygonCentroid(room.polygon);
  if (Math.hypot(it.x - cx, it.y - cy) < CEIL_CAPTURE) {
    it.x = cx;
    it.y = cy;
    return [{ a: [cx - 0.4, cy], b: [cx + 0.4, cy] }, { a: [cx, cy - 0.4], b: [cx, cy + 0.4] }];
  }
  return [];
}

/** The Frame zwischen Wandmontage und Standfuß umschalten (mutiert `it`). */
export function setFrameMode(it: PlacedItem, stand: boolean, items: PlacedItem[]): void {
  const p = it.params ?? {};
  const panelH = Number(p.panelH) || it.h;
  const panelD = Number(p.panelD) || 0.025;
  if (stand) {
    if (it.mount === "wall") {
      // von der Wand ins Raumes-Innere: Rückseite bleibt an der Wand
      const a = (it.rot * Math.PI) / 180;
      const off = (Number(p.standD) || 0.25) / 2 - it.d / 2 + 0.03;
      it.x += -Math.sin(a) * off;
      it.y += Math.cos(a) * off;
    }
    it.params = { ...p, stand: true };
    it.mount = "floor";
    it.d = Number(p.standD) || 0.25;
    it.h = panelH + (Number(p.feetH) || 0.034);
    const s = supportUnder(it, items);
    it.elev = s ? surfaceTop(s) : 0;
  } else {
    it.params = { ...p, stand: false };
    it.mount = "wall";
    it.d = Math.max(0.03, panelD + 0.005);
    it.h = panelH;
    it.elev = Math.max(0.3, Math.round((1.05 - panelH / 2) * 100) / 100);
    const r = snapWallItem(it, wallFaces, 2);
    if (r) Object.assign(it, { x: r.x, y: r.y, rot: r.rot });
  }
}

export interface DragStart {
  ids: string[];
  /** Mitbewegte Objekte (stehen auf einem der gezogenen Möbel). */
  riders: string[];
  start: Map<string, { x: number; y: number; rot: number; elev: number }>;
}

export function beginDrag(ids: string[], items: PlacedItem[]): DragStart {
  const sel = items.filter((i) => ids.includes(i.id) && !i.locked);
  const riders = new Set<string>();
  for (const s of sel) for (const r of ridersOf(s, items)) if (!ids.includes(r.id) && !r.locked) riders.add(r.id);
  const all = [...sel.map((i) => i.id), ...riders];
  const start = new Map(items.filter((i) => all.includes(i.id)).map((i) => [i.id, { x: i.x, y: i.y, rot: i.rot, elev: i.elev }]));
  return { ids: sel.map((i) => i.id), riders: [...riders], start };
}

/**
 * Neue Lage aller gezogenen Objekte für die Verschiebung (dx, dy).
 * Ein einzelnes Objekt wird gefangen (Wand, Ablage); Mitfahrer folgen Verschiebung und Drehung.
 */
export function dragUpdate(ds: DragStart, dx: number, dy: number, snapOn: boolean, items: PlacedItem[]): { ids: string[]; apply: (it: PlacedItem) => void; guides: SnapGuide[] } {
  const ids = [...ds.ids, ...ds.riders];
  if (ds.ids.length !== 1) {
    return {
      ids,
      guides: [],
      apply: (it) => {
        const s0 = ds.start.get(it.id)!;
        it.x = s0.x + dx;
        it.y = s0.y + dy;
      },
    };
  }
  const pid = ds.ids[0];
  const p0 = ds.start.get(pid)!;
  const orig = items.find((i) => i.id === pid)!;
  const p: PlacedItem = { ...orig, x: p0.x + dx, y: p0.y + dy, rot: p0.rot, elev: p0.elev };
  const others = items.filter((i) => !ds.riders.includes(i.id));
  const guides = applyPlacementSnap(p, others, p0.rot, snapOn);
  const dr = ((p.rot - p0.rot) * Math.PI) / 180;
  const c = Math.cos(dr), s = Math.sin(dr);
  return {
    ids,
    guides,
    apply: (it) => {
      const s0 = ds.start.get(it.id)!;
      if (it.id === pid) {
        Object.assign(it, { x: p.x, y: p.y, rot: p.rot, elev: p.elev });
        return;
      }
      const rx = s0.x - p0.x, ry = s0.y - p0.y;
      it.x = p.x + rx * c - ry * s;
      it.y = p.y + rx * s + ry * c;
      it.rot = (((s0.rot + (p.rot - p0.rot)) % 360) + 360) % 360;
      it.elev = s0.elev + (p.elev - p0.elev);
    },
  };
}

/** Teppiche u. Ä.: flach und großflächig, liegen unter anderen Möbeln – erst nach Auswahl verschiebbar. */
export function isFlatFloorItem(it: PlacedItem) {
  return it.mount === "floor" && it.h < 0.05 && it.w * it.d > 0.6;
}
