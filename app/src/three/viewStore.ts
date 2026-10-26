import { create } from "zustand";

// Reiner Ansichtszustand der 3D-Ansicht (wird nicht im Projekt gespeichert).

export interface View3DState {
  /** Tagesverlauf läuft (Uhrzeit wird animiert, ohne das Projekt zu ändern). */
  sunPlaying: boolean;
  /** Animierte Uhrzeit während des Abspielens. */
  animTime: number | null;
  /** Decke und volle Wandhöhe werfen immer Schatten → Sonne fällt nur durch Fenster. */
  realDaylight: boolean;
  /** Leuchten auch bei Tageslicht eingeschaltet (Kunstlicht am trüben Nachmittag, Dämmerung). */
  lampsDay: boolean;
  /** Augenhöhe im Rundgang (m). */
  eyeHeight: number;
  /** Vertikaler Bildwinkel je 3D-Fenster und Kameraart (Grad), Schlüssel `<Fenster>:orbit|walk`. */
  fov: Record<string, number>;
  /** Je 3D-Fenster: Kamera steht unterhalb der Decke (Innenansicht) → kein automatischer Wandschnitt, Decke sichtbar. */
  interior: Record<number, boolean>;
  panelSection: "sun" | "lamp" | "camera" | "shots" | "photo" | null;
  /** Kamerafahrt eines 3D-Fensters zu einer Ansicht (Position, Ziel, Bildwinkel). */
  goto: { pane: number; pos: [number, number, number]; target: [number, number, number]; fov?: number; t: number } | null;
  /** Je 3D-Fenster von der Szene bereitgestellt: aktuelle Kamera und Fotoaufnahme. */
  apis: Record<number, Scene3DApi>;
  set<K extends keyof View3DState>(k: K, v: View3DState[K]): void;
}

export interface Scene3DApi {
  getView(): { pos: [number, number, number]; target: [number, number, number]; fov: number } | null;
  capture(width: number): Promise<string | null>;
  canvas(): HTMLCanvasElement;
}

export const useView3D = create<View3DState>((set) => ({
  sunPlaying: false,
  animTime: null,
  realDaylight: true,
  lampsDay: false,
  eyeHeight: 1.62,
  fov: {},
  interior: {},
  panelSection: "sun",
  goto: null,
  apis: {},
  set: (k, v) => set({ [k]: v } as Partial<View3DState>),
}));

/** Kamerafahrt im 3D-Fenster `pane` anstoßen. */
export function gotoView(pane: number, v: { pos: [number, number, number]; target: [number, number, number]; fov?: number }) {
  useView3D.getState().set("goto", { ...v, pane, t: performance.now() });
}

export const FOV_DEFAULT = { orbit: 42, walk: 70 } as const;

/** Bildwinkel eines 3D-Fensters (Rundgang bzw. Modell-/Draufsicht). */
export function paneFov(fov: Record<string, number>, pane: number, walk: boolean): number {
  return fov[`${pane}:${walk ? "walk" : "orbit"}`] ?? FOV_DEFAULT[walk ? "walk" : "orbit"];
}

export function setPaneFov(pane: number, walk: boolean, v: number) {
  const s = useView3D.getState();
  s.set("fov", { ...s.fov, [`${pane}:${walk ? "walk" : "orbit"}`]: v });
}

/** Brennweite (Kleinbild, mm) ↔ vertikaler Bildwinkel (Grad). */
export const fovToMm = (fov: number) => 12 / Math.tan((fov * Math.PI) / 360);
export const mmToFov = (mm: number) => (2 * Math.atan(12 / mm) * 180) / Math.PI;

// Zugriff für automatisierte Tests/Diagnose
(globalThis as unknown as Record<string, unknown>).__we13view = useView3D;
