// Momentaufnahmen eines Projekts (Planungsvarianten).

import type { Project, ProjectVariant } from "./types";

export function makeVariant(p: Project, name: string, id = `v-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`): ProjectVariant {
  return structuredClone({ id, name, createdAt: new Date().toISOString(), items: p.items, budget: p.budget, rooms: p.rooms, walls: p.walls, settings: p.settings });
}

/** Projekt mit dem Stand einer Variante (Varianten selbst und Projektname bleiben erhalten). */
export function withVariant(p: Project, v: ProjectVariant): Project {
  const s = structuredClone(v);
  return { ...p, items: s.items, budget: s.budget, rooms: s.rooms, walls: s.walls, settings: s.settings, updatedAt: new Date().toISOString() };
}
