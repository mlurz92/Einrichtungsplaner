// Planungsvarianten: Momentaufnahmen des Projekts sichern, laden und vergleichen.

import type { PlacedItem, Project, ProjectVariant } from "../model/types";
export { makeVariant, withVariant } from "../model/variant";
import { budgetSummary, getCatalogItem } from "./project";

export interface VariantDiff {
  totalA: number;
  totalB: number;
  countA: number;
  countB: number;
  byRoom: { room: string; a: number; b: number }[];
  added: PlacedItem[];
  removed: PlacedItem[];
  swapped: { a: PlacedItem; b: PlacedItem }[];
  restyled: { a: PlacedItem; b: PlacedItem }[];
  moved: { a: PlacedItem; b: PlacedItem; dist: number }[];
  finishesChanged: string[];
}

const asProject = (base: Project, v: Pick<ProjectVariant, "items" | "budget">): Project => ({ ...base, items: v.items, budget: v.budget });

/** Unterschiede von Stand A (z. B. Variante) zu Stand B (z. B. aktuell). */
export function diffVariants(base: Project, a: Pick<ProjectVariant, "items" | "budget" | "rooms" | "walls">, b: Pick<ProjectVariant, "items" | "budget" | "rooms" | "walls">): VariantDiff {
  const ba = budgetSummary(asProject(base, a));
  const bb = budgetSummary(asProject(base, b));
  const rooms = new Set([...Object.keys(ba.byRoom), ...Object.keys(bb.byRoom)]);
  const byRoom = [...rooms].map((room) => ({ room, a: ba.byRoom[room] ?? 0, b: bb.byRoom[room] ?? 0 })).sort((x, y) => x.room.localeCompare(y.room));
  const mapA = new Map(a.items.map((i) => [i.id, i]));
  const mapB = new Map(b.items.map((i) => [i.id, i]));
  const added = b.items.filter((i) => !mapA.has(i.id) && !i.existing);
  const removed = a.items.filter((i) => !mapB.has(i.id) && !i.existing);
  const swapped: VariantDiff["swapped"] = [];
  const restyled: VariantDiff["restyled"] = [];
  const moved: VariantDiff["moved"] = [];
  for (const ia of a.items) {
    const ib = mapB.get(ia.id);
    if (!ib) continue;
    if (ia.catalogId !== ib.catalogId) swapped.push({ a: ia, b: ib });
    else if (ia.variant !== ib.variant || JSON.stringify(ia.slots) !== JSON.stringify(ib.slots)) restyled.push({ a: ia, b: ib });
    const d = Math.hypot(ia.x - ib.x, ia.y - ib.y);
    if (d > 0.05 || Math.abs(ia.rot - ib.rot) > 1 || Math.abs(ia.w - ib.w) > 0.01 || Math.abs(ia.d - ib.d) > 0.01) moved.push({ a: ia, b: ib, dist: d });
  }
  const finishesChanged = [...new Set([...Object.keys(a.rooms), ...Object.keys(b.rooms)])].filter((r) => JSON.stringify(a.rooms[r]) !== JSON.stringify(b.rooms[r]));
  const wallRooms = new Set([...Object.keys(a.walls), ...Object.keys(b.walls)].filter((k) => JSON.stringify(a.walls[k]) !== JSON.stringify(b.walls[k])).map((k) => k.split(":")[0]));
  for (const r of wallRooms) if (!finishesChanged.includes(r)) finishesChanged.push(r);
  const count = (items: PlacedItem[]) => items.filter((i) => !i.existing).length;
  return { totalA: ba.total, totalB: bb.total, countA: count(a.items), countB: count(b.items), byRoom, added, removed, swapped, restyled, moved, finishesChanged };
}

export function itemName(it: PlacedItem): string {
  return it.label ?? getCatalogItem(it.catalogId)?.name ?? "Objekt";
}
