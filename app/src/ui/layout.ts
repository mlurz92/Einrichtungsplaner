// Ansichtsaufteilung wie in CAD-Programmen: bis zu vier Fenster, jedes wahlweise 2D-Plan oder 3D-Ansicht
// mit eigener Kamera und Wanddarstellung; Teiler verschiebbar, Fenster maximierbar. Wird lokal gespeichert.
import { create } from "zustand";

export type PaneKind = "plan" | "3d";
export type Camera3D = "orbit" | "walk" | "top";
export type WallMode = "auto" | "full" | "cut" | "low";
export type LayoutId = "single" | "cols" | "rows" | "left3" | "top3" | "quad";

export interface PaneConf {
  kind: PaneKind;
  camera: Camera3D;
  walls: WallMode;
  /** Ansichtsleiste (Sonne, Licht, Kamera, Raumfotos, Foto) in diesem 3D-Fenster eingeblendet. */
  panel: boolean;
}

export interface LayoutPrefs {
  layout: LayoutId;
  panes: PaneConf[];
  /** Lage der Teiler (Anteil von Breite bzw. Höhe). */
  split: { x: number; y: number };
  /** Bei „Ein Fenster“ angezeigtes Fenster. */
  solo: number;
  /** Maximiertes Fenster (überdeckt die übrigen, Aufteilung bleibt erhalten). */
  maximized: number | null;
  /** Zuletzt benutztes Fenster: Ziel für Tastenkürzel, Menübefehle und Befehlssuche. */
  active: number;
}

export interface Rect {
  l: number;
  t: number;
  w: number;
  h: number;
}

/** Teiler: senkrecht (`x`, verschiebt links/rechts) oder waagerecht (`y`); `from`/`to` begrenzen seine Länge. */
export interface Divider {
  axis: "x" | "y";
  from: number;
  to: number;
}

export const SPLIT_LIMITS = [0.12, 0.88] as const;

export const LAYOUTS: Record<LayoutId, { label: string; short: string; kbd?: string; count: number }> = {
  single: { label: "Ein Fenster", short: "1", count: 1 },
  cols: { label: "Zwei nebeneinander", short: "2 |", count: 2 },
  rows: { label: "Zwei übereinander", short: "2 —", count: 2 },
  left3: { label: "Drei: groß links, zwei rechts", short: "3 ◧", count: 3 },
  top3: { label: "Drei: groß oben, zwei unten", short: "3 ⬒", count: 3 },
  quad: { label: "Vier Fenster", short: "4", count: 4 },
};
export const LAYOUT_ORDER: LayoutId[] = ["single", "cols", "rows", "left3", "top3", "quad"];

export const PANE_DEFAULTS: PaneConf[] = [
  { kind: "plan", camera: "orbit", walls: "auto", panel: true },
  { kind: "3d", camera: "orbit", walls: "auto", panel: true },
  { kind: "3d", camera: "walk", walls: "full", panel: false },
  { kind: "plan", camera: "top", walls: "low", panel: false },
];

export const LAYOUT_DEFAULTS: LayoutPrefs = { layout: "cols", panes: PANE_DEFAULTS, split: { x: 0.5, y: 0.5 }, solo: 0, maximized: null, active: 0 };

/** Sichtbare Fenster (Index in `panes`) der Aufteilung. */
export function visiblePanes(p: Pick<LayoutPrefs, "layout" | "solo">): number[] {
  const n = LAYOUTS[p.layout].count;
  return n === 1 ? [p.solo] : [0, 1, 2, 3].slice(0, n);
}

/** Lage der sichtbaren Fenster (Anteile 0–1), in der Reihenfolge von `visiblePanes`. */
export function paneRects(layout: LayoutId, { x, y }: { x: number; y: number }): Rect[] {
  switch (layout) {
    case "single":
      return [{ l: 0, t: 0, w: 1, h: 1 }];
    case "cols":
      return [{ l: 0, t: 0, w: x, h: 1 }, { l: x, t: 0, w: 1 - x, h: 1 }];
    case "rows":
      return [{ l: 0, t: 0, w: 1, h: y }, { l: 0, t: y, w: 1, h: 1 - y }];
    case "left3":
      return [{ l: 0, t: 0, w: x, h: 1 }, { l: x, t: 0, w: 1 - x, h: y }, { l: x, t: y, w: 1 - x, h: 1 - y }];
    case "top3":
      return [{ l: 0, t: 0, w: 1, h: y }, { l: 0, t: y, w: x, h: 1 - y }, { l: x, t: y, w: 1 - x, h: 1 - y }];
    case "quad":
      return [{ l: 0, t: 0, w: x, h: y }, { l: x, t: 0, w: 1 - x, h: y }, { l: 0, t: y, w: x, h: 1 - y }, { l: x, t: y, w: 1 - x, h: 1 - y }];
  }
}

/** Verschiebbare Teiler der Aufteilung. */
export function dividers(layout: LayoutId, { x, y }: { x: number; y: number }): Divider[] {
  switch (layout) {
    case "single":
      return [];
    case "cols":
      return [{ axis: "x", from: 0, to: 1 }];
    case "rows":
      return [{ axis: "y", from: 0, to: 1 }];
    case "left3":
      return [{ axis: "x", from: 0, to: 1 }, { axis: "y", from: x, to: 1 }];
    case "top3":
      return [{ axis: "y", from: 0, to: 1 }, { axis: "x", from: y, to: 1 }];
    case "quad":
      return [{ axis: "x", from: 0, to: 1 }, { axis: "y", from: 0, to: 1 }];
  }
}

const clampSplit = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(SPLIT_LIMITS[1], Math.max(SPLIT_LIMITS[0], v)) : 0.5);
const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);

export function sanitizeLayout(raw: Partial<LayoutPrefs> | null | undefined): LayoutPrefs {
  const r = raw ?? {};
  const panes = PANE_DEFAULTS.map((d, i) => {
    const p = (Array.isArray(r.panes) ? r.panes[i] : null) as Partial<PaneConf> | null;
    return {
      kind: pick(p?.kind, ["plan", "3d"] as const, d.kind),
      camera: pick(p?.camera, ["orbit", "walk", "top"] as const, d.camera),
      walls: pick(p?.walls, ["auto", "full", "cut", "low"] as const, d.walls),
      panel: typeof p?.panel === "boolean" ? p.panel : d.panel,
    };
  });
  const layout = pick(r.layout, LAYOUT_ORDER, LAYOUT_DEFAULTS.layout);
  const idx = (v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 4 ? (v as number) : d);
  const solo = idx(r.solo, 0);
  const vis = visiblePanes({ layout, solo });
  const max = r.maximized == null ? null : idx(r.maximized, -1);
  const active = idx(r.active, 0);
  return {
    layout,
    panes,
    split: { x: clampSplit(r.split?.x), y: clampSplit(r.split?.y) },
    solo,
    maximized: max != null && vis.includes(max) && vis.length > 1 ? max : null,
    active: vis.includes(active) ? active : vis[0],
  };
}

const KEY = "we13.layout.v1";

function initial(): LayoutPrefs {
  let stored: Partial<LayoutPrefs> | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!stored) {
      // Ansicht aus Version 2.3 und älter übernehmen
      const old = JSON.parse(localStorage.getItem("we13.prefs.v1") ?? "null") as { viewMode?: string; wallMode?: WallMode } | null;
      if (old?.viewMode) stored = presetState(LAYOUT_DEFAULTS, old.viewMode as Preset);
      if (old?.wallMode && stored) stored.panes = stored.panes!.map((p) => ({ ...p, walls: p.kind === "3d" && p.camera === "orbit" ? old.wallMode! : p.walls }));
    }
  } catch {
    stored = null;
  }
  let s = sanitizeLayout(stored);
  // Aufruf mit ?view=plan|split|3d (Skripte, Prüfungen) bzw. ?cam= und ?walls=
  if (typeof location !== "undefined") {
    const q = new URLSearchParams(location.search);
    const v = q.get("view");
    if (v === "plan" || v === "split" || v === "3d") s = { ...s, ...presetState(s, v) };
    const cam = q.get("cam");
    const walls = q.get("walls");
    if (cam || walls)
      s = {
        ...s,
        panes: s.panes.map((p, i) => (i === 1 ? { ...p, camera: pick(cam, ["orbit", "walk", "top"] as const, p.camera), walls: pick(walls, ["auto", "full", "cut", "low"] as const, p.walls) } : p)),
      };
  }
  return s;
}

/** Klassische Ansichten (Tasten 1, 2, 3): nur Plan, Plan | 3D nebeneinander, nur 3D. */
export type Preset = "plan" | "split" | "3d";

function presetState(s: LayoutPrefs, v: Preset): LayoutPrefs {
  const panes = s.panes.map((p) => ({ ...p }));
  if (v === "split") {
    panes[0].kind = "plan";
    panes[1].kind = "3d";
    return { ...s, panes, layout: "cols", maximized: null, active: s.active < 2 ? s.active : 0 };
  }
  // Ein Fenster: vorhandenes Fenster dieser Art zeigen (bleibt geladen), sonst Fenster 1 bzw. 2 umstellen
  const want: PaneKind = v === "plan" ? "plan" : "3d";
  const vis = visiblePanes(s);
  let solo = [s.active, ...vis].find((i) => panes[i].kind === want);
  if (solo === undefined) {
    solo = want === "plan" ? 0 : 1;
    panes[solo].kind = want;
  }
  return { ...s, panes, layout: "single", solo, maximized: null, active: solo };
}

/** Vorgefertigte Ansichten: Aufteilung samt Belegung der Fenster (Art und Kamera) in einem Klick. */
export type ViewSlot = { kind: PaneKind; camera?: Camera3D };
export interface ViewPreset {
  id: string;
  label: string;
  hint: string;
  layout: LayoutId;
  split?: { x: number; y: number };
  slots: ViewSlot[];
  kbd?: string;
}
const P: ViewSlot = { kind: "plan" };
const M: ViewSlot = { kind: "3d", camera: "orbit" };
const T: ViewSlot = { kind: "3d", camera: "top" };
const R: ViewSlot = { kind: "3d", camera: "walk" };
export const VIEW_PRESETS: ViewPreset[] = [
  { id: "plan", label: "2D-Plan", hint: "Nur der Grundriss", layout: "single", slots: [P], kbd: "1" },
  { id: "plan-3d", label: "2D | 3D", hint: "Plan links, 3D-Modell rechts", layout: "cols", split: { x: 0.5, y: 0.5 }, slots: [P, M], kbd: "2" },
  { id: "3d", label: "3D-Modell", hint: "Nur die 3D-Ansicht", layout: "single", slots: [M], kbd: "3" },
  { id: "plan-walk", label: "2D | Rundgang", hint: "Plan links, Rundgang auf Augenhöhe rechts", layout: "cols", split: { x: 0.5, y: 0.5 }, slots: [P, R] },
  { id: "plan-plan", label: "2D | 2D", hint: "Zwei Pläne, z. B. Übersicht und Detail", layout: "cols", split: { x: 0.5, y: 0.5 }, slots: [P, P] },
  { id: "3d-walk", label: "3D | Rundgang", hint: "Modell und Rundgang nebeneinander", layout: "cols", split: { x: 0.5, y: 0.5 }, slots: [M, R] },
  { id: "plan-over-3d", label: "2D über 3D", hint: "Plan oben, 3D-Modell unten", layout: "rows", split: { x: 0.5, y: 0.5 }, slots: [P, M] },
  { id: "studio", label: "Planen", hint: "Großer Plan, rechts 3D-Modell und Rundgang", layout: "left3", split: { x: 0.6, y: 0.5 }, slots: [P, M, R] },
  { id: "present", label: "Präsentieren", hint: "Großes 3D-Modell, unten Plan und Rundgang", layout: "top3", split: { x: 0.5, y: 0.62 }, slots: [M, P, R] },
  { id: "quad", label: "Vier Ansichten", hint: "Plan, 3D-Modell, Draufsicht und Rundgang", layout: "quad", split: { x: 0.5, y: 0.5 }, slots: [P, M, T, R] },
];

/** Welche vorgefertigte Ansicht entspricht dem aktuellen Stand (für das Häkchen)? */
export function matchingView(s: LayoutPrefs): string | null {
  const vis = visiblePanes(s);
  for (const v of VIEW_PRESETS) {
    if (v.layout !== s.layout || v.slots.length !== vis.length) continue;
    if (v.slots.every((slot, k) => s.panes[vis[k]].kind === slot.kind && (slot.kind === "plan" || s.panes[vis[k]].camera === slot.camera))) return v.id;
  }
  return null;
}

function viewState(s: LayoutPrefs, v: ViewPreset): LayoutPrefs {
  const panes = s.panes.map((p) => ({ ...p }));
  if (v.layout === "single") {
    // vorhandenes Fenster passender Art weiterverwenden (behält Kamera, Zoom und Ladezustand)
    const want = v.slots[0];
    let solo = [s.active, ...visiblePanes(s), 0, 1, 2, 3].find((i) => panes[i].kind === want.kind && (want.kind === "plan" || panes[i].camera !== "walk"));
    if (solo === undefined) {
      solo = want.kind === "plan" ? 0 : 1;
      panes[solo].kind = want.kind;
    }
    if (want.camera) panes[solo].camera = want.camera;
    return { ...s, panes, layout: "single", solo, maximized: null, active: solo };
  }
  v.slots.forEach((slot, i) => {
    panes[i].kind = slot.kind;
    if (slot.camera) {
      panes[i].camera = slot.camera;
      if (slot.camera === "walk") panes[i].panel = false;
    }
  });
  return { ...s, panes, layout: v.layout, split: v.split ?? s.split, maximized: null, active: 0 };
}

interface LayoutStore extends LayoutPrefs {
  applyView(id: string): void;
  evenSplit(): void;
  setLayout(l: LayoutId): void;
  preset(v: Preset): void;
  setSplit(axis: "x" | "y", v: number): void;
  setPane(i: number, patch: Partial<PaneConf>): void;
  activate(i: number): void;
  toggleMaximize(i?: number): void;
  reset(): void;
}

export const useLayout = create<LayoutStore>((set, get) => ({
  ...initial(),
  setLayout(layout) {
    const s = get();
    // Von „Ein Fenster“ kommend: das gezeigte Fenster wird zum ersten der Aufteilung, wenn es sonst verschwände
    let panes = s.panes;
    if (s.layout === "single" && s.solo >= LAYOUTS[layout].count) {
      panes = s.panes.map((p) => ({ ...p }));
      [panes[0], panes[s.solo]] = [panes[s.solo], panes[0]];
    }
    const solo = layout === "single" ? (visiblePanes(s).includes(s.active) ? s.active : visiblePanes(s)[0]) : s.solo;
    set(sanitizeLayout({ ...s, panes, layout, solo, maximized: null, active: s.active }));
  },
  preset(v) {
    set(presetState(get(), v));
  },
  evenSplit() {
    set({ split: { x: 0.5, y: 0.5 } });
  },
  applyView(id) {
    const v = VIEW_PRESETS.find((x) => x.id === id);
    if (v) set(viewState(get(), v));
  },
  setSplit(axis, v) {
    set({ split: { ...get().split, [axis]: clampSplit(v) } });
  },
  setPane(i, patch) {
    set({ panes: get().panes.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  },
  activate(i) {
    if (get().active !== i) set({ active: i });
  },
  toggleMaximize(i = get().active) {
    const s = get();
    if (visiblePanes(s).length < 2) return;
    set({ maximized: s.maximized === i ? null : i, active: i });
  },
  reset() {
    set({ ...LAYOUT_DEFAULTS, panes: PANE_DEFAULTS.map((p) => ({ ...p })) });
  },
}));

useLayout.subscribe((s) => {
  const out: LayoutPrefs = { layout: s.layout, panes: s.panes, split: s.split, solo: s.solo, maximized: s.maximized, active: s.active };
  try {
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* ignorieren */
  }
});

// ---------------------------------------------------------------- Abfragen für Befehle und Tastenkürzel

/** Tatsächlich angezeigte Fenster (beim Maximieren nur das maximierte). */
export function shownPanes(s: LayoutPrefs = useLayout.getState()): number[] {
  return s.maximized != null ? [s.maximized] : visiblePanes(s);
}

/** Zielfenster einer Art: das aktive, wenn es passt, sonst das erste angezeigte dieser Art. */
export function targetPane(kind: PaneKind, s: LayoutPrefs = useLayout.getState()): number | null {
  const shown = shownPanes(s);
  if (shown.includes(s.active) && s.panes[s.active].kind === kind) return s.active;
  return shown.find((i) => s.panes[i].kind === kind) ?? null;
}

/** Zielfenster für 3D-Befehle; ohne sichtbare 3D-Ansicht wird eine eingeblendet. */
export function ensure3d(): number {
  const t = targetPane("3d");
  if (t != null) return t;
  const s = useLayout.getState();
  if (s.maximized != null) {
    const other = visiblePanes(s).find((i) => s.panes[i].kind === "3d");
    if (other != null) {
      useLayout.setState({ maximized: other, active: other });
      return other;
    }
  }
  if (s.layout === "single") s.preset("split");
  else s.setPane(s.active, { kind: "3d" });
  return targetPane("3d") ?? 1;
}

/** Ist dieses Fenster Ziel der Tastenkürzel seiner Art (z. B. M, +/−, W)? */
export function isKeyTarget(i: number, kind: PaneKind): boolean {
  return targetPane(kind) === i;
}

/** Wird gerade ein Fenster dieser Art angezeigt? */
export function hasShown(kind: PaneKind, s: LayoutPrefs = useLayout.getState()): boolean {
  return shownPanes(s).some((i) => s.panes[i].kind === kind);
}

// Zugriff für automatisierte Tests/Diagnose
(globalThis as unknown as Record<string, unknown>).__we13layout = useLayout;
