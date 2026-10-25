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
  /** Vertikaler Bildwinkel je Kameraart (Grad). */
  fovOrbit: number;
  fovWalk: number;
  /** Kamera steht unterhalb der Decke (Innenansicht) → kein automatischer Wandschnitt, Decke sichtbar. */
  interior: boolean;
  panelOpen: boolean;
  panelSection: "sun" | "lamp" | "camera" | "shots" | "photo" | null;
  /** Kamerafahrt zu einer Ansicht (Position, Ziel, Bildwinkel). */
  goto: { pos: [number, number, number]; target: [number, number, number]; fov?: number; t: number } | null;
  /** Von der Szene bereitgestellt: aktuelle Kamera und Fotoaufnahme. */
  api: {
    getView(): { pos: [number, number, number]; target: [number, number, number]; fov: number } | null;
    capture(width: number): Promise<string | null>;
  } | null;
  set<K extends keyof View3DState>(k: K, v: View3DState[K]): void;
}

export const useView3D = create<View3DState>((set) => ({
  sunPlaying: false,
  animTime: null,
  realDaylight: true,
  lampsDay: false,
  eyeHeight: 1.62,
  fovOrbit: 42,
  fovWalk: 70,
  interior: false,
  panelOpen: true,
  panelSection: "sun",
  goto: null,
  api: null,
  set: (k, v) => set({ [k]: v } as Partial<View3DState>),
}));

/** Brennweite (Kleinbild, mm) ↔ vertikaler Bildwinkel (Grad). */
export const fovToMm = (fov: number) => 12 / Math.tan((fov * Math.PI) / 360);
export const mmToFov = (mm: number) => (2 * Math.atan(12 / mm) * 180) / Math.PI;

// Zugriff für automatisierte Tests/Diagnose
(globalThis as unknown as Record<string, unknown>).__we13view = useView3D;
