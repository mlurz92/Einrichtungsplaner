// Oberflächen-Einstellungen (nicht im Projekt gespeichert): Design, Transparenz, Größe, Seitenleisten, Merkliste.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { applyNativeTheme, nativeBackdrop, setUiZoom } from "../platform";

export type ThemePref = "system" | "light" | "dark";

export interface UiPrefs {
  theme: ThemePref;
  /** Halbtransparente Glasflächen (aus = deckende Flächen, schneller auf schwacher Grafik). */
  transparency: boolean;
  /** Animationen (zusätzlich zur Windows-Einstellung „Animationen anzeigen“). */
  motion: boolean;
  /** Oberflächengröße in Prozent (90–125). */
  scale: number;
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  catalogView: "list" | "grid";
  /** Merkliste: Katalog-IDs. */
  favorites: string[];
  /** Zuletzt platzierte Produkte (neueste zuerst). */
  recentPlaced: string[];
  /** Beim Start nach einer neuen Version auf GitHub schauen. */
  updateCheck: boolean;
  /** Version, deren Hinweis weggeklickt wurde. */
  dismissedUpdate: string | null;
  /** Zuletzt benutzte Befehle der Befehlssuche. */
  recentCommands: string[];
}

const KEY = "we13.ui.v1";

export const UI_DEFAULTS: UiPrefs = {
  theme: "system",
  transparency: true,
  motion: true,
  scale: 100,
  leftOpen: true,
  rightOpen: true,
  leftWidth: 340,
  rightWidth: 320,
  catalogView: "list",
  favorites: [],
  recentPlaced: [],
  updateCheck: true,
  dismissedUpdate: null,
  recentCommands: [],
};

export const SIDEBAR_LIMITS = { left: [280, 520], right: [280, 480] } as const;

function load(): UiPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<UiPrefs>;
    return sanitize({ ...UI_DEFAULTS, ...raw });
  } catch {
    return { ...UI_DEFAULTS };
  }
}

export function sanitize(p: UiPrefs): UiPrefs {
  const clamp = (v: number, [a, b]: readonly [number, number], d: number) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
  return {
    ...p,
    theme: ["system", "light", "dark"].includes(p.theme) ? p.theme : "system",
    scale: clamp(p.scale, [80, 150], 100),
    leftWidth: clamp(p.leftWidth, SIDEBAR_LIMITS.left, UI_DEFAULTS.leftWidth),
    rightWidth: clamp(p.rightWidth, SIDEBAR_LIMITS.right, UI_DEFAULTS.rightWidth),
    favorites: Array.isArray(p.favorites) ? p.favorites.filter((x) => typeof x === "string").slice(0, 500) : [],
    recentPlaced: Array.isArray(p.recentPlaced) ? p.recentPlaced.filter((x) => typeof x === "string").slice(0, 24) : [],
    recentCommands: Array.isArray(p.recentCommands) ? p.recentCommands.filter((x) => typeof x === "string").slice(0, 8) : [],
  };
}

interface UiStore extends UiPrefs {
  setPref<K extends keyof UiPrefs>(k: K, v: UiPrefs[K]): void;
  toggleFavorite(id: string): void;
  notePlaced(id: string): void;
  noteCommand(id: string): void;
  reset(): void;
}

export const useUi = create<UiStore>((set, get) => ({
  ...load(),
  setPref: (k, v) => set({ [k]: v } as Partial<UiPrefs>),
  toggleFavorite(id) {
    const f = get().favorites;
    set({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [id, ...f] });
  },
  notePlaced(id) {
    set({ recentPlaced: [id, ...get().recentPlaced.filter((x) => x !== id)].slice(0, 24) });
  },
  noteCommand(id) {
    set({ recentCommands: [id, ...get().recentCommands.filter((x) => x !== id)].slice(0, 8) });
  },
  reset() {
    set({ ...UI_DEFAULTS, favorites: get().favorites, recentPlaced: get().recentPlaced });
  },
}));

useUi.subscribe((s) => {
  const out: Partial<UiPrefs> = {};
  for (const k of Object.keys(UI_DEFAULTS) as (keyof UiPrefs)[]) (out as Record<string, unknown>)[k] = s[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* ignorieren */
  }
});

// ---------------------------------------------------------------- Anwenden auf das Dokument

const darkQuery = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;
const reducedTransparency = typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-transparency: reduce)") : null;

export function resolvedTheme(pref: ThemePref = useUi.getState().theme): "light" | "dark" {
  if (pref === "system") return darkQuery?.matches ? "dark" : "light";
  return pref;
}

/** Aktuelles Farbschema als Hook (für Plan- und 3D-Farben). */
export function useResolvedTheme(): "light" | "dark" {
  const pref = useUi((s) => s.theme);
  const sysDark = useSyncExternalStore(onSystemThemeChange, () => darkQuery?.matches ?? false);
  return pref === "system" ? (sysDark ? "dark" : "light") : pref;
}

let lowQuality = false;
/** Darstellungsqualität „schnell“: Glas ohne Unschärfe. */
export function setLowQualityUi(v: boolean) {
  lowQuality = v;
  apply();
}

function apply() {
  const s = useUi.getState();
  const root = document.documentElement;
  const theme = resolvedTheme(s.theme);
  root.dataset.theme = theme;
  root.dataset.transparency = s.transparency && !lowQuality && !reducedTransparency?.matches ? "on" : "off";
  root.dataset.motion = s.motion ? "on" : "off";
  void applyNativeTheme(s.theme === "system" ? null : theme);
  void setUiZoom(s.scale / 100);
}

let started = false;
/** Einstellungen anwenden und auf Änderungen (auch der Windows-Einstellungen) reagieren. */
export function startUiPrefs() {
  if (started || typeof document === "undefined") return;
  started = true;
  apply();
  useUi.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.transparency !== prev.transparency || s.motion !== prev.motion || s.scale !== prev.scale) apply();
  });
  darkQuery?.addEventListener("change", () => {
    apply();
    themeListeners.forEach((l) => l());
  });
  reducedTransparency?.addEventListener("change", apply);
  // Mica (Windows 11): Fensterhintergrund vom System, sonst eigener Verlauf
  void nativeBackdrop().then((kind) => {
    if (kind) document.documentElement.dataset.backdrop = kind;
  });
}

const themeListeners = new Set<() => void>();
/** Benachrichtigung bei Wechsel des Systemdesigns (für Hooks, die resolvedTheme lesen). */
export function onSystemThemeChange(l: () => void) {
  themeListeners.add(l);
  return () => void themeListeners.delete(l);
}
