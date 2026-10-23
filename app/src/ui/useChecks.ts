import { useMemo } from "react";
import { apartment, wallFaces } from "../data";
import { getCatalogItem, useEditor } from "../store/project";
import { runChecks } from "../model/check";

/** Planungs-Check des aktuellen Projekts (neu berechnet bei jeder Änderung der Objekte). */
export function useChecks() {
  const items = useEditor((s) => s.project.items);
  return useMemo(() => runChecks(items, apartment, wallFaces, getCatalogItem), [items]);
}
