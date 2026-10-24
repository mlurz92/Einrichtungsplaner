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
  Vec2,
  WallFinish,
} from "../model/types";
import { localToPlan, nearestFace, roomAt, rotationForFace } from "../model/geometry";
import type { SnapGuide } from "../model/snap";
import { applyPlacementSnap, setFrameMode } from "./placement";

export type ViewMode = "plan" | "3d" | "split";
export type Camera3D = "orbit" | "walk" | "top";
export type WallMode = "auto" | "full" | "cut" | "low";
export type LeftTab = "katalog" | "gestaltung" | "objekte" | "konzepte" | "budget";

export interface Toast {
  id: number;
  msg: string;
  kind: "info" | "error";
  /** Schaltfläche im Hinweis, z. B. „Rückgängig“. */
  action?: { label: string; run: () => void };
}

export interface ToastOptions {
  kind?: Toast["kind"];
  action?: Toast["action"];
  /** Anzeigedauer in ms (Standard 3,2 s, mit Aktion oder Fehler 7 s). */
  duration?: number;
}

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
  leftTab: LeftTab;
  placing: { catalogId: string; variant: number } | null;
  past: Project[];
  future: Project[];
  /** Bezeichnungen der Undo-/Redo-Schritte (parallel zu past/future). */
  pastLabels: string[];
  futureLabels: string[];
  dirty: boolean;
  filePath: string | null;
  toast: Toast | null;
  focusRequest: { x: number; y: number; t: number } | null;
  /** Hilfslinien des Wandfangs während des Ziehens. */
  snapGuides: SnapGuide[];
  helpOpen: boolean;
  newDialogOpen: boolean;
  /** Startseite (Konzept, leere Wohnung, Datei, zuletzt verwendet). */
  startOpen: boolean;
  /** Befehlssuche (Strg+K). */
  paletteOpen: boolean;
  /** Abfrage beim Schließen des Fensters mit ungespeicherten Änderungen. */
  closeAsk: boolean;

  // Aktionen
  setProject(p: Project, opts?: { keepHistory?: boolean; filePath?: string | null; label?: string }): void;
  loadConcept(id: string): void;
  newEmptyProject(): void;
  /**
   * Undo-Schritt anlegen. `coalesce`: aufeinanderfolgende Schritte mit gleichem Schlüssel
   * innerhalb von 1,2 s werden zu einem Schritt zusammengefasst (z. B. Pfeiltasten).
   */
  commit(label?: string, coalesce?: string): void;
  undo(): void;
  redo(): void;
  select(ids: string[], additive?: boolean): void;
  selectFace(id: string | null): void;
  selectRoom(id: string | null): void;
  setHover(id: string | null): void;
  set<K extends keyof EditorState>(k: K, v: EditorState[K]): void;
  addFromCatalog(catalogId: string, variant: number, x: number, y: number, rot?: number): string | null;
  updateItems(ids: string[], fn: (it: PlacedItem) => void, opts?: { commit?: boolean; label?: string; coalesce?: string }): void;
  removeItems(ids: string[]): void;
  duplicateItems(ids: string[]): void;
  copyItems(ids: string[]): number;
  cutItems(ids: string[]): void;
  /** Zwischenablage einfügen; `at` = Planposition für den Mittelpunkt der eingefügten Gruppe. */
  pasteItems(at?: Vec2 | null): void;
  replaceItem(id: string, catalogId: string, variant: number): void;
  applyVariant(id: string, variant: number): void;
  setSlot(id: string, slot: Slot, style: Partial<SlotStyle>): void;
  setWallFinish(faceIds: string[], finish: WallFinish | null): void;
  setRoomFinish(roomId: string, patch: Partial<RoomFinish>): void;
  updateBudget(lines: BudgetLine[]): void;
  addCustomCatalog(item: CatalogItem): void;
  showToast(msg: string, opts?: ToastOptions): void;
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
/** Dateipfad und Speicherzustand zur automatischen Sicherung (überlebt Neustart). */
const AUTOSAVE_META_KEY = "we13.autosave.meta.v1";
/** Ansichtseinstellungen (Ansicht, Seitenleiste, Wände, Qualität). */
const PREFS_KEY = "we13.prefs.v1";
const HISTORY_LIMIT = 120;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, v: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

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
const autosaved = urlConcept ? null : loadAutosave();
/** true, wenn beim Start der letzte Arbeitsstand wiederhergestellt wurde. */
export const restoredFromAutosave = !!autosaved;
const autosaveMeta = autosaved ? readJson<{ filePath?: string | null; dirty?: boolean }>(AUTOSAVE_META_KEY) : null;
const initial = urlConcept ? structuredClone(urlConcept.project) : autosaved ?? structuredClone(concepts[0].project);
rebuildCatalogIndex(initial);

interface Prefs {
  viewMode?: ViewMode;
  leftTab?: LeftTab;
  wallMode?: WallMode;
  quality?: EditorState["quality"];
  showCeiling?: boolean;
}
const prefs = readJson<Prefs>(PREFS_KEY) ?? {};
const firstStart = !urlConcept && !autosaved && !urlParams.has("view");

let lastCommit: { key: string; t: number } | null = null;
let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let clipboard: PlacedItem[] = [];
let pasteCount = 0;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: initial,
  selection: [],
  selectedFace: null,
  selectedRoom: null,
  hoverId: null,
  viewMode: (urlParams.get("view") as ViewMode) || prefs.viewMode || "split",
  camera3d: (urlParams.get("cam") as Camera3D) || "orbit",
  wallMode: (urlParams.get("walls") as WallMode) || prefs.wallMode || "auto",
  showCeiling: prefs.showCeiling ?? false,
  night: urlParams.get("night") === "1",
  quality: (urlParams.get("q") as EditorState["quality"]) || prefs.quality || "hoch",
  leftTab: prefs.leftTab || "katalog",
  placing: null,
  past: [],
  future: [],
  pastLabels: [],
  futureLabels: [],
  dirty: autosaveMeta?.dirty ?? false,
  filePath: autosaveMeta?.filePath ?? null,
  toast: null,
  focusRequest: null,
  snapGuides: [],
  helpOpen: false,
  newDialogOpen: false,
  startOpen: firstStart,
  paletteOpen: false,
  closeAsk: false,

  setProject(p, opts) {
    p = migrateProject(p);
    rebuildCatalogIndex(p);
    lastCommit = null;
    const keep = !!opts?.keepHistory;
    set({
      project: p,
      selection: [],
      selectedFace: null,
      selectedRoom: null,
      past: keep ? [...get().past, get().project].slice(-HISTORY_LIMIT) : [],
      pastLabels: keep ? [...get().pastLabels, opts?.label ?? "Projekt wechseln"].slice(-HISTORY_LIMIT) : [],
      future: [],
      futureLabels: [],
      dirty: false,
      filePath: opts?.filePath ?? null,
    });
  },
  loadConcept(id) {
    const c = concepts.find((x) => x.id === id);
    if (!c) return;
    const p = structuredClone(c.project);
    p.updatedAt = new Date().toISOString();
    get().setProject(p, { keepHistory: true, label: `${c.subtitle} laden` });
    get().showToast(`${c.subtitle} geladen: ${c.title}`, { action: { label: "Rückgängig", run: () => get().undo() } });
  },
  newEmptyProject() {
    get().setProject(emptyProject(), { keepHistory: true, label: "Leere Wohnung" });
    get().showToast("Leere Wohnung (nur Bestand)", { action: { label: "Rückgängig", run: () => get().undo() } });
  },
  commit(label, coalesce) {
    const now = Date.now();
    if (coalesce && lastCommit?.key === coalesce && now - lastCommit.t < 1200 && get().past.length) {
      lastCommit.t = now;
      set({ future: [], futureLabels: [], dirty: true });
      return;
    }
    lastCommit = coalesce ? { key: coalesce, t: now } : null;
    const { project, past, pastLabels } = get();
    set({
      past: [...past, cloneProject(project)].slice(-HISTORY_LIMIT),
      pastLabels: [...pastLabels, label ?? "Bearbeiten"].slice(-HISTORY_LIMIT),
      future: [],
      futureLabels: [],
      dirty: true,
    });
  },
  undo() {
    const { past, pastLabels, project, future, futureLabels, selection } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    const label = pastLabels[pastLabels.length - 1] ?? "Bearbeiten";
    rebuildCatalogIndex(prev);
    lastCommit = null;
    const ids = new Set(prev.items.map((i) => i.id));
    set({
      project: prev,
      past: past.slice(0, -1),
      pastLabels: pastLabels.slice(0, -1),
      future: [cloneProject(project), ...future].slice(0, HISTORY_LIMIT),
      futureLabels: [label, ...futureLabels].slice(0, HISTORY_LIMIT),
      selection: selection.filter((id) => ids.has(id)),
      dirty: true,
    });
    get().showToast(`Rückgängig: ${label}`);
  },
  redo() {
    const { past, pastLabels, project, future, futureLabels, selection } = get();
    if (!future.length) return;
    const next = future[0];
    const label = futureLabels[0] ?? "Bearbeiten";
    rebuildCatalogIndex(next);
    lastCommit = null;
    const ids = new Set(next.items.map((i) => i.id));
    set({
      project: next,
      future: future.slice(1),
      futureLabels: futureLabels.slice(1),
      past: [...past, cloneProject(project)].slice(-HISTORY_LIMIT),
      pastLabels: [...pastLabels, label].slice(-HISTORY_LIMIT),
      selection: selection.filter((id) => ids.has(id)),
      dirty: true,
    });
    get().showToast(`Wiederholt: ${label}`);
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
    get().commit(`${c.name} platzieren`);
    set((s) => ({ project: { ...s.project, items: [...s.project.items, it], updatedAt: new Date().toISOString() }, selection: [it.id] }));
    return it.id;
  },
  updateItems(ids, fn, opts) {
    if (opts?.commit !== false) get().commit(opts?.label, opts?.coalesce);
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
    const idset = new Set(ids);
    const hit = get().project.items.filter((i) => idset.has(i.id));
    const locked = hit.filter((i) => i.locked).length;
    const n = hit.length - locked;
    if (!n) {
      if (locked) get().showToast(`${plural(locked, "Objekt ist gesperrt", "Objekte sind gesperrt")} – zum Löschen erst entsperren`);
      return;
    }
    get().commit(n === 1 ? `${hit.find((i) => !i.locked)?.label ?? "Objekt"} löschen` : `${n} Objekte löschen`);
    set((s) => ({ project: { ...s.project, items: s.project.items.filter((i) => !idset.has(i.id) || i.locked) }, selection: [] }));
    get().showToast(`${plural(n, "Objekt", "Objekte")} gelöscht${locked ? ` (${locked} gesperrt, bleiben)` : ""}`, { action: { label: "Rückgängig", run: () => get().undo() } });
  },
  duplicateItems(ids) {
    if (!ids.length) return;
    get().commit(ids.length === 1 ? "Duplizieren" : `${ids.length} Objekte duplizieren`);
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
  copyItems(ids) {
    const items = get().project.items.filter((i) => ids.includes(i.id));
    if (!items.length) return 0;
    clipboard = structuredClone(items);
    pasteCount = 0;
    get().showToast(`${plural(items.length, "Objekt", "Objekte")} kopiert – Strg+V fügt an der Mausposition ein`);
    return items.length;
  },
  cutItems(ids) {
    const movable = get().project.items.filter((i) => ids.includes(i.id) && !i.locked).map((i) => i.id);
    if (!movable.length) return;
    get().copyItems(movable);
    get().removeItems(movable);
  },
  pasteItems(at) {
    if (!clipboard.length) {
      get().showToast("Zwischenablage ist leer – erst Objekte mit Strg+C kopieren");
      return;
    }
    const cx = clipboard.reduce((a, i) => a + i.x, 0) / clipboard.length;
    const cy = clipboard.reduce((a, i) => a + i.y, 0) / clipboard.length;
    pasteCount++;
    const [dx, dy] = at ? [at[0] - cx, at[1] - cy] : [0.25 * pasteCount, 0.25 * pasteCount];
    const known = clipboard.filter((i) => getCatalogItem(i.catalogId));
    if (!known.length) {
      get().showToast("Kopierte Objekte stammen aus einem anderen Projekt und sind hier nicht im Katalog", { kind: "error" });
      return;
    }
    const copies = known.map((i) => {
      const c = structuredClone(i);
      c.id = uid();
      c.locked = false;
      c.existing = false;
      c.pos = undefined;
      c.x += dx;
      c.y += dy;
      c.room = roomAt(apartment, c.x, c.y) ?? c.room;
      return c;
    });
    get().commit(copies.length === 1 ? `${copies[0].label ?? "Objekt"} einfügen` : `${copies.length} Objekte einfügen`);
    set((s) => ({ project: { ...s.project, items: [...s.project.items, ...copies], updatedAt: new Date().toISOString() }, selection: copies.map((c) => c.id) }));
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
    get().commit(`Tauschen gegen ${c.name}`);
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
    }, { label: `Variante „${v.name}“` });
  },
  setSlot(id, slot, style) {
    get().updateItems([id], (x) => {
      const cur = x.slots[slot] ?? { color: "#cccccc", material: "matte" };
      x.slots[slot] = { ...cur, ...style };
      x.variant = "Individuell";
    }, { label: "Farbe/Material", coalesce: `slot:${id}:${slot}` });
  },
  setWallFinish(faceIds, finish) {
    get().commit("Wandgestaltung", `wall:${faceIds.join(",")}`);
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
    get().commit(roomIds.length === 1 ? "Raumausbau" : `Ausbau für ${roomIds.length} Räume`);
    set((s) => {
      const rooms = { ...s.project.rooms };
      for (const id of roomIds) if (rooms[id]) rooms[id] = fn(structuredClone(rooms[id]), id);
      return { project: { ...s.project, rooms }, dirty: true };
    });
  },
  setSettings(patch) {
    get().commit("Einstellungen", `settings:${Object.keys(patch).join(",")}`);
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
    get().setProject(p, { keepHistory: true, label: "Neue Einrichtung" });
  },
  setRoomFinish(roomId, patch) {
    get().commit("Raumausbau", `room:${roomId}:${Object.keys(patch).join(",")}`);
    set((s) => ({
      project: { ...s.project, rooms: { ...s.project.rooms, [roomId]: { ...s.project.rooms[roomId], ...structuredClone(patch) } } },
      dirty: true,
    }));
  },
  updateBudget(lines) {
    get().commit("Budget", "budget");
    set((s) => ({ project: { ...s.project, budget: lines } }));
  },
  addCustomCatalog(item) {
    get().commit(`${item.name} importieren`);
    set((s) => {
      const p = { ...s.project, customCatalog: [...(s.project.customCatalog ?? []), item] };
      rebuildCatalogIndex(p);
      return { project: p };
    });
  },
  showToast(msg, opts) {
    const t: Toast = { id: ++toastSeq, msg, kind: opts?.kind ?? "info", action: opts?.action };
    set({ toast: t });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (get().toast?.id === t.id) set({ toast: null });
    }, opts?.duration ?? (t.action || t.kind === "error" ? 7000 : 3200));
  },
  setFrameStand(id, stand) {
    const items = get().project.items;
    get().updateItems([id], (it) => setFrameMode(it, stand, items), { label: stand ? "The Frame: Standfuß" : "The Frame: Wandmontage" });
  },
  requestFocus(x, y) {
    set({ focusRequest: { x, y, t: Date.now() } });
  },
}));

// Zugriff für automatisierte Tests/Diagnose
(globalThis as unknown as Record<string, unknown>).__we13store = useEditor;

// Autosave (entprellt) samt Dateipfad/Speicherzustand; einmaliger Hinweis, wenn der Speicher nicht reicht
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let autosaveWarned = false;
/** Zeitpunkt der letzten erfolgreichen automatischen Sicherung. */
export let lastAutosave: Date | null = null;
useEditor.subscribe((s, prev) => {
  if (s.filePath !== prev.filePath || s.dirty !== prev.dirty) writeJson(AUTOSAVE_META_KEY, { filePath: s.filePath, dirty: s.dirty });
  if (s.project === prev.project) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (writeJson(AUTOSAVE_KEY, s.project)) {
      lastAutosave = new Date();
      autosaveWarned = false;
    } else if (!autosaveWarned) {
      autosaveWarned = true;
      useEditor.getState().showToast("Automatische Sicherung nicht möglich (Projekt zu groß, z. B. durch importierte Modelle) – bitte mit Strg+S speichern", { kind: "error", duration: 10000 });
    }
  }, 700);
});

// Ansichtseinstellungen merken
useEditor.subscribe((s, prev) => {
  if (s.viewMode === prev.viewMode && s.leftTab === prev.leftTab && s.wallMode === prev.wallMode && s.quality === prev.quality && s.showCeiling === prev.showCeiling) return;
  writeJson(PREFS_KEY, { viewMode: s.viewMode, leftTab: s.leftTab, wallMode: s.wallMode, quality: s.quality, showCeiling: s.showCeiling } satisfies Prefs);
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
