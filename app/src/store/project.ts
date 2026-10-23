import { create } from "zustand";
import { apartment, baseCatalog, concepts, wallFaces } from "../data";
import type {
  FloorFinish,
  BudgetLine,
  CatalogItem,
  ItemPart,
  PlacedItem,
  Project,
  RoomFinish,
  Slot,
  SlotStyle,
  WallFinish,
} from "../model/types";
import { localToPlan, nearestFace, roomAt, rotationForFace } from "../model/geometry";
import type { SnapGuide } from "../model/snap";
import { applyPlacementSnap, setFrameMode } from "./placement";

export type ViewMode = "plan" | "3d" | "split";
export type Camera3D = "orbit" | "walk" | "top";
export type WallMode = "auto" | "full" | "cut" | "low";

export interface EditorState {
  project: Project;
  selection: string[];
  selectedFace: string | null;
  selectedRoom: string | null;
  hoverId: string | null;
  viewMode: ViewMode;
  camera3d: Camera3D;
  wallMode: WallMode;
  showCeiling: boolean;
  night: boolean;
  quality: "hoch" | "mittel" | "niedrig";
  leftTab: "katalog" | "gestaltung" | "objekte" | "konzepte" | "budget";
  placing: { catalogId: string; variant: number } | null;
  past: Project[];
  future: Project[];
  dirty: boolean;
  filePath: string | null;
  toast: string | null;
  focusRequest: { x: number; y: number; t: number } | null;
  /** Hilfslinien des Wandfangs während des Ziehens. */
  snapGuides: SnapGuide[];
  helpOpen: boolean;
  newDialogOpen: boolean;

  // Aktionen
  setProject(p: Project, opts?: { keepHistory?: boolean; filePath?: string | null }): void;
  loadConcept(id: string): void;
  newEmptyProject(): void;
  commit(): void;
  undo(): void;
  redo(): void;
  select(ids: string[], additive?: boolean): void;
  selectFace(id: string | null): void;
  selectRoom(id: string | null): void;
  setHover(id: string | null): void;
  set<K extends keyof EditorState>(k: K, v: EditorState[K]): void;
  addFromCatalog(catalogId: string, variant: number, x: number, y: number, rot?: number): string | null;
  updateItems(ids: string[], fn: (it: PlacedItem) => void, opts?: { commit?: boolean }): void;
  removeItems(ids: string[]): void;
  duplicateItems(ids: string[]): void;
  replaceItem(id: string, catalogId: string, variant: number): void;
  applyVariant(id: string, variant: number): void;
  setSlot(id: string, slot: Slot, style: Partial<SlotStyle>): void;
  setWallFinish(faceIds: string[], finish: WallFinish | null): void;
  setRoomFinish(roomId: string, patch: Partial<RoomFinish>): void;
  updateBudget(lines: BudgetLine[]): void;
  addCustomCatalog(item: CatalogItem): void;
  showToast(msg: string): void;
  requestFocus(x: number, y: number): void;
  setFrameStand(id: string, stand: boolean): void;
  /** Ausbau auf mehrere Räume anwenden (ein Undo-Schritt). */
  applyToRooms(roomIds: string[], fn: (r: RoomFinish, id: string) => RoomFinish): void;
  setSettings(patch: Partial<Project["settings"]>): void;
  /** Neue Einrichtung „von Grund auf“: leere Wohnung mit gewähltem Bestand und Grundausbau. */
  newFurnishing(opts: NewFurnishingOptions): void;
}

export interface NewFurnishingOptions {
  name: string;
  keepKitchen: boolean;
  keepSanitary: boolean;
  keepWasher: boolean;
  wallColor: string;
  wallProduct: string;
  ceilingColor: string;
  /** Bodenvorlage für Wohnräume (null = Bestand Eichendielen). */
  floor: Omit<FloorFinish, "angle"> | null;
}

const AUTOSAVE_KEY = "we13.autosave.v1";

export function cloneProject(p: Project): Project {
  return structuredClone(p);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

let catalogIndex = new Map<string, CatalogItem>(baseCatalog.map((c) => [c.id, c]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return catalogIndex.get(id);
}

export function allCatalog(): CatalogItem[] {
  return [...catalogIndex.values()];
}

function rebuildCatalogIndex(p: Project) {
  catalogIndex = new Map<string, CatalogItem>(baseCatalog.map((c) => [c.id, c]));
  for (const c of p.customCatalog ?? []) catalogIndex.set(c.id, c);
}

export function itemPrice(it: PlacedItem): number {
  if (it.existing) return 0;
  if (it.parts && it.parts.length) return it.parts.reduce((a, p) => a + p.qty * p.unit, 0);
  return it.price ?? getCatalogItem(it.catalogId)?.price ?? 0;
}

export function newItemFromCatalog(c: CatalogItem, variantIdx: number, x: number, y: number, rot = 0): PlacedItem {
  const v = c.variants[variantIdx] ?? c.variants[0];
  const price = v?.price ?? c.price;
  const parts: ItemPart[] = [
    { name: c.name, variant: v?.name, vendor: c.vendor, qty: 1, unit: price, url: v?.url ?? c.url ?? null, dims: `${c.w} × ${c.d} × ${c.h} cm` },
  ];
  return {
    id: uid(),
    catalogId: c.id,
    label: c.name,
    x,
    y,
    rot,
    elev: c.mount === "floor" ? 0 : c.elev ?? (c.mount === "ceiling" ? apartment.ceilingHeight - c.h / 100 : 1.0),
    w: c.w / 100,
    d: Math.max(c.d / 100, 0.005),
    h: c.h / 100,
    variant: v?.name,
    slots: structuredClone(v?.slots ?? {}),
    params: structuredClone(c.params ?? {}),
    mount: c.mount,
    room: roomAt(apartment, x, y),
    parts: c.price > 0 || (v?.price ?? 0) > 0 ? parts : [],
  };
}

function emptyProject(): Project {
  const base = structuredClone(concepts[0].project);
  return {
    ...base,
    name: "Neues Projekt",
    subtitle: "Leere Wohnung WE 13 (Bestand: Küche, Sanitär)",
    conceptId: undefined,
    items: base.items.filter((i) => i.existing && !i.catalogId.startsWith("bestand-tv")),
    budget: [],
    walls: {},
    rooms: Object.fromEntries(
      Object.entries(base.rooms).map(([k, r]) => [k, { ...r, wall: k.startsWith("13.05") || k.startsWith("13.06") ? r.wall : { base: { kind: "paint", color: "#f3f0e8", productName: "Warmweiß matt" } } }]),
    ),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Project;
}

/** Ältere Projektstände an den Bestand anpassen (Fliesen HWR/Bäder: Feinsteinzeug 60 × 60 „Iron“). */
export function migrateProject(p: Project): Project {
  for (const rid of ["13.05", "13.06", "13.07"]) {
    const f = p.rooms?.[rid]?.floor;
    if (f && f.kind === "tiles" && f.productName === "Feinsteinzeug 60 × 60 (Bestand)") {
      p.rooms[rid] = { ...p.rooms[rid], floor: { ...f, color: "#5e5b57", color2: "#46443f", tileSize: 0.6, productName: "Feinsteinzeug 60 × 60 cm, Farbe Iron (Bestand)" } };
    }
  }
  return p;
}

function loadAutosave(): Project | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Project;
    if (p && p.version === 1 && Array.isArray(p.items)) return migrateProject(p);
  } catch {
    /* ignorieren */
  }
  return null;
}

const urlParams = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const urlConcept = concepts.find((c) => c.id === urlParams.get("concept"));
const initial = urlConcept ? structuredClone(urlConcept.project) : loadAutosave() ?? structuredClone(concepts[0].project);
rebuildCatalogIndex(initial);

export const useEditor = create<EditorState>((set, get) => ({
  project: initial,
  selection: [],
  selectedFace: null,
  selectedRoom: null,
  hoverId: null,
  viewMode: (urlParams.get("view") as ViewMode) || "split",
  camera3d: (urlParams.get("cam") as Camera3D) || "orbit",
  wallMode: (urlParams.get("walls") as WallMode) || "auto",
  showCeiling: false,
  night: urlParams.get("night") === "1",
  quality: (urlParams.get("q") as EditorState["quality"]) || "hoch",
  leftTab: "katalog",
  placing: null,
  past: [],
  future: [],
  dirty: false,
  filePath: null,
  toast: null,
  focusRequest: null,
  snapGuides: [],
  helpOpen: false,
  newDialogOpen: false,

  setProject(p, opts) {
    p = migrateProject(p);
    rebuildCatalogIndex(p);
    set({
      project: p,
      selection: [],
      selectedFace: null,
      selectedRoom: null,
      past: opts?.keepHistory ? [...get().past, get().project].slice(-100) : [],
      future: [],
      dirty: false,
      filePath: opts?.filePath ?? null,
    });
  },
  loadConcept(id) {
    const c = concepts.find((x) => x.id === id);
    if (!c) return;
    const p = structuredClone(c.project);
    p.updatedAt = new Date().toISOString();
    get().setProject(p, { keepHistory: true });
    get().showToast(`${c.subtitle} geladen: ${c.title}`);
  },
  newEmptyProject() {
    get().setProject(emptyProject(), { keepHistory: true });
  },
  commit() {
    const { project, past } = get();
    set({ past: [...past, cloneProject(project)].slice(-120), future: [], dirty: true });
  },
  undo() {
    const { past, project, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    rebuildCatalogIndex(prev);
    set({ project: prev, past: past.slice(0, -1), future: [cloneProject(project), ...future].slice(0, 120), dirty: true });
  },
  redo() {
    const { past, project, future } = get();
    if (!future.length) return;
    const next = future[0];
    rebuildCatalogIndex(next);
    set({ project: next, future: future.slice(1), past: [...past, cloneProject(project)], dirty: true });
  },
  select(ids, additive) {
    const cur = get().selection;
    if (additive) {
      const s = new Set(cur);
      for (const id of ids) s.has(id) ? s.delete(id) : s.add(id);
      set({ selection: [...s], selectedFace: null });
    } else set({ selection: ids, selectedFace: ids.length ? null : get().selectedFace });
  },
  selectFace(id) {
    set({ selectedFace: id, selection: id ? [] : get().selection });
  },
  selectRoom(id) {
    set({ selectedRoom: id });
  },
  setHover(id) {
    if (get().hoverId !== id) set({ hoverId: id });
  },
  set(k, v) {
    set({ [k]: v } as Partial<EditorState>);
  },
  addFromCatalog(catalogId, variant, x, y, rot) {
    const c = getCatalogItem(catalogId);
    if (!c) return null;
    const it = newItemFromCatalog(c, variant, x, y, rot ?? 0);
    if (c.mount === "floor" && rot === undefined) {
      // Möbel an der Wand: Rückseite zur nächsten Wand drehen, wenn nah genug
      const nf = nearestFace(wallFaces, x, y, Math.max(it.d, 0.5));
      if (nf) it.rot = rotationForFace(nf.face);
      else it.rot = roomAt(apartment, x, y) && ["13.01", "13.02", "13.03", "13.07", "13.09"].includes(roomAt(apartment, x, y)!) ? 8 : 0;
    }
    applyPlacementSnap(it, get().project.items, it.rot, get().project.settings.snap);
    get().commit();
    set((s) => ({ project: { ...s.project, items: [...s.project.items, it], updatedAt: new Date().toISOString() }, selection: [it.id] }));
    return it.id;
  },
  updateItems(ids, fn, opts) {
    if (opts?.commit !== false) get().commit();
    const idset = new Set(ids);
    set((s) => ({
      project: {
        ...s.project,
        items: s.project.items.map((it) => {
          if (!idset.has(it.id)) return it;
          const c = structuredClone(it);
          fn(c);
          c.room = roomAt(apartment, c.x, c.y) ?? c.room;
          return c;
        }),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    }));
  },
  removeItems(ids) {
    if (!ids.length) return;
    get().commit();
    const idset = new Set(ids);
    set((s) => ({ project: { ...s.project, items: s.project.items.filter((i) => !idset.has(i.id) || i.locked) }, selection: [] }));
  },
  duplicateItems(ids) {
    if (!ids.length) return;
    get().commit();
    const items = get().project.items.filter((i) => ids.includes(i.id));
    const copies = items.map((i) => {
      const c = structuredClone(i);
      c.id = uid();
      c.locked = false;
      c.existing = false;
      const p = localToPlan(i, 0.25, 0.25);
      c.x = p[0];
      c.y = p[1];
      c.pos = undefined;
      return c;
    });
    set((s) => ({ project: { ...s.project, items: [...s.project.items, ...copies] }, selection: copies.map((c) => c.id) }));
  },
  replaceItem(id, catalogId, variant) {
    const c = getCatalogItem(catalogId);
    const old = get().project.items.find((i) => i.id === id);
    if (!c || !old) return;
    const n = newItemFromCatalog(c, variant, old.x, old.y, old.rot);
    n.id = old.id;
    n.pos = old.pos;
    n.opening = old.opening;
    if (c.mount === old.mount || (c.mount !== "floor" && old.mount !== "floor")) n.elev = c.mount === "floor" ? old.elev : n.elev;
    // Rückseite bleibt an derselben Stelle (z. B. an der Wand)
    const back = localToPlan(old, 0, -old.d / 2);
    const front = localToPlan(old, 0, 1);
    const fx = front[0] - old.x;
    const fy = front[1] - old.y;
    n.x = back[0] + fx * (n.d / 2);
    n.y = back[1] + fy * (n.d / 2);
    get().commit();
    set((s) => ({ project: { ...s.project, items: s.project.items.map((i) => (i.id === id ? n : i)) } }));
    get().showToast(`Getauscht: ${c.name}`);
  },
  applyVariant(id, variant) {
    const it = get().project.items.find((i) => i.id === id);
    const c = it && getCatalogItem(it.catalogId);
    if (!it || !c) return;
    const v = c.variants[variant];
    get().updateItems([id], (x) => {
      x.variant = v.name;
      x.slots = structuredClone(v.slots);
      if (x.parts?.length === 1) x.parts[0] = { ...x.parts[0], unit: v.price ?? x.parts[0].unit, variant: v.name, url: v.url ?? x.parts[0].url };
    });
  },
  setSlot(id, slot, style) {
    get().updateItems([id], (x) => {
      const cur = x.slots[slot] ?? { color: "#cccccc", material: "matte" };
      x.slots[slot] = { ...cur, ...style };
      x.variant = "Individuell";
    });
  },
  setWallFinish(faceIds, finish) {
    get().commit();
    set((s) => {
      const walls = { ...s.project.walls };
      for (const f of faceIds) {
        if (finish) walls[f] = structuredClone(finish);
        else delete walls[f];
      }
      return { project: { ...s.project, walls }, dirty: true };
    });
  },
  applyToRooms(roomIds, fn) {
    get().commit();
    set((s) => {
      const rooms = { ...s.project.rooms };
      for (const id of roomIds) if (rooms[id]) rooms[id] = fn(structuredClone(rooms[id]), id);
      return { project: { ...s.project, rooms }, dirty: true };
    });
  },
  setSettings(patch) {
    get().commit();
    set((s) => ({ project: { ...s.project, settings: { ...s.project.settings, ...patch } }, dirty: true }));
  },
  newFurnishing(o) {
    const p = emptyProject();
    p.name = o.name || "Neue Einrichtung";
    p.subtitle = "Eigene Einrichtung WE 13";
    p.items = p.items.filter((i) => {
      const a = getCatalogItem(i.catalogId)?.archetype ?? "";
      if (a === "kitchenRun") return o.keepKitchen;
      if (a === "washer") return o.keepWasher;
      if (["bathtub", "toilet", "washbasin", "shower"].includes(a)) return o.keepSanitary;
      return false;
    });
    for (const r of apartment.rooms) {
      const f = p.rooms[r.id];
      if (!f || r.outdoor) continue;
      const wet = ["13.05", "13.06"].includes(r.id);
      f.ceiling = o.ceilingColor;
      f.wall = wet ? { ...f.wall, base: { kind: "paint", color: o.wallColor, productName: o.wallProduct } } : { base: { kind: "paint", color: o.wallColor, productName: o.wallProduct } };
      if (o.floor && r.floor === "parkett") f.floor = { ...o.floor, angle: f.floor.angle };
    }
    get().setProject(p, { keepHistory: true });
  },
  setRoomFinish(roomId, patch) {
    get().commit();
    set((s) => ({
      project: { ...s.project, rooms: { ...s.project.rooms, [roomId]: { ...s.project.rooms[roomId], ...structuredClone(patch) } } },
      dirty: true,
    }));
  },
  updateBudget(lines) {
    get().commit();
    set((s) => ({ project: { ...s.project, budget: lines } }));
  },
  addCustomCatalog(item) {
    get().commit();
    set((s) => {
      const p = { ...s.project, customCatalog: [...(s.project.customCatalog ?? []), item] };
      rebuildCatalogIndex(p);
      return { project: p };
    });
  },
  showToast(msg) {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 3200);
  },
  setFrameStand(id, stand) {
    const items = get().project.items;
    get().updateItems([id], (it) => setFrameMode(it, stand, items));
  },
  requestFocus(x, y) {
    set({ focusRequest: { x, y, t: Date.now() } });
  },
}));

// Zugriff für automatisierte Tests/Diagnose
(globalThis as unknown as Record<string, unknown>).__we13store = useEditor;

// Autosave (entprellt)
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useEditor.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(s.project));
    } catch {
      /* Speicher voll – ignorieren */
    }
  }, 700);
});

export function budgetSummary(p: Project) {
  const lines: { room: string; vendor: string; category: string; name: string; pos?: string; qty: number; unit: number; total: number; url?: string | null; itemId?: string }[] = [];
  const merged = new Map<string, (typeof lines)[number]>();
  for (const it of p.items) {
    if (it.existing) continue;
    const c = getCatalogItem(it.catalogId);
    const parts = it.parts?.length ? it.parts : [{ name: c?.name ?? it.label ?? "Objekt", vendor: c?.vendor ?? "Fachhandel", qty: 1, unit: it.price ?? c?.price ?? 0, url: c?.url, pos: it.pos }];
    for (const pt of parts) {
      const key = `${pt.pos ?? ""}|${pt.name}|${pt.unit}|${it.room}`;
      const ex = merged.get(key);
      if (ex) {
        ex.qty += pt.qty;
        ex.total += pt.qty * pt.unit;
      } else {
        const l = { room: it.room ?? "–", vendor: pt.vendor, category: c?.category ?? "", name: pt.name, pos: pt.pos ?? it.pos, qty: pt.qty, unit: pt.unit, total: pt.qty * pt.unit, url: pt.url, itemId: it.id };
        merged.set(key, l);
        lines.push(l);
      }
    }
  }
  for (const b of p.budget) {
    lines.push({ room: b.room, vendor: b.vendor, category: b.category ?? "Zubehör", name: b.name, pos: b.pos, qty: b.qty, unit: b.unit, total: b.qty * b.unit, url: b.url });
  }
  const total = lines.reduce((a, l) => a + l.total, 0);
  const byVendor: Record<string, number> = {};
  const byRoom: Record<string, number> = {};
  for (const l of lines) {
    byVendor[l.vendor] = (byVendor[l.vendor] ?? 0) + l.total;
    byRoom[l.room] = (byRoom[l.room] ?? 0) + l.total;
  }
  return { lines, total, byVendor, byRoom };
}
