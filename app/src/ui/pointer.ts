import type { Vec2 } from "../model/types";

/** Letzte Mausposition im Plan (für Einfügen an der Mausposition), ohne Neuzeichnen. */
export const pointer: { plan: Vec2 | null; over: "plan" | null } = { plan: null, over: null };
