// Befehle für die Befehlssuche (Strg+K) – eine Liste, damit Menü, Kürzel und Suche dieselben Aktionen nutzen.
import { apartment, concepts, roomNames } from "../data";
import { polygonCentroid } from "../model/geometry";
import { useEditor, type LeftTab, type WallMode } from "../store/project";
import { pointer } from "./pointer";
import { exportPlanSvg, exportScreenshot, exportShoppingList, importGlb, openProject, openRecent, printBudget, saveProject } from "./fileops";
import { fileName, recentFiles } from "./recent";

export interface Command {
  id: string;
  group: string;
  label: string;
  kbd?: string;
  /** Zusätzliche Suchbegriffe. */
  keywords?: string;
  enabled?: () => boolean;
  run: () => void;
}

const st = () => useEditor.getState();
const hasSel = () => st().selection.length > 0;
/** Darstellungseinstellung ohne Undo-Schritt (wie die Schalter in der Kopfleiste). */
const viewSetting = (patch: Partial<ReturnType<typeof st>["project"]["settings"]>) =>
  useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, ...patch } } }));

const WALL_LABELS: Record<WallMode, string> = { auto: "Automatisch (verdeckende Wände gekappt)", full: "Raumhoch", cut: "Schnitt 1,30 m", low: "Flach" };
/** Umgangssprachliche Raumnamen für die Suche. */
const ROOM_SYNONYMS: Record<string, string> = {
  "13.01": "wohnzimmer esszimmer diele",
  "13.02": "küche",
  "13.03": "schlafzimmer",
  "13.04": "büro arbeitszimmer gästezimmer kinderzimmer",
  "13.05": "badezimmer badewanne",
  "13.06": "wc toilette",
  "13.07": "hauswirtschaftsraum abstellraum waschmaschine",
  "13.08": "terrasse loggia",
  "13.09": "terrasse loggia",
};
const TAB_LABELS: Record<LeftTab, string> = { katalog: "Katalog", gestaltung: "Gestaltung", objekte: "Objekte", konzepte: "Konzepte", planung: "Planung", budget: "Budget" };

/** Mittelpunkt der Auswahl im Plan. */
export function selectionCenter(): [number, number] | null {
  const s = st();
  const sel = s.project.items.filter((i) => s.selection.includes(i.id));
  if (!sel.length) return null;
  return [sel.reduce((a, i) => a + i.x, 0) / sel.length, sel.reduce((a, i) => a + i.y, 0) / sel.length];
}

export function pasteHere() {
  st().pasteItems(pointer.over === "plan" ? pointer.plan : null);
}

export function staticCommands(): Command[] {
  const cmds: Command[] = [
    { id: "start", group: "Datei", label: "Startseite anzeigen", keywords: "willkommen beginnen", run: () => st().set("startOpen", true) },
    { id: "new", group: "Datei", label: "Neue Einrichtung (leere Wohnung) …", kbd: "Strg+N", run: () => st().set("newDialogOpen", true) },
    { id: "open", group: "Datei", label: "Öffnen …", kbd: "Strg+O", run: () => void openProject() },
    { id: "save", group: "Datei", label: "Speichern", kbd: "Strg+S", run: () => void saveProject(false) },
    { id: "saveas", group: "Datei", label: "Speichern unter …", kbd: "Strg+Umschalt+S", run: () => void saveProject(true) },
    { id: "png", group: "Export", label: "3D-Ansicht als PNG", keywords: "bild screenshot", run: () => void exportScreenshot() },
    { id: "svg", group: "Export", label: "Grundriss als SVG", keywords: "plan zeichnung", run: () => void exportPlanSvg() },
    { id: "csv", group: "Export", label: "Einkaufsliste (CSV/Excel)", keywords: "budget liste", run: () => void exportShoppingList() },
    { id: "print", group: "Export", label: "Einkaufsliste drucken / PDF", keywords: "budget", run: () => printBudget() },
    { id: "glb", group: "Datei", label: "Eigenes 3D-Modell (GLB) importieren", run: () => void importGlb() },
    { id: "undo", group: "Bearbeiten", label: "Rückgängig", kbd: "Strg+Z", enabled: () => st().past.length > 0, run: () => st().undo() },
    { id: "redo", group: "Bearbeiten", label: "Wiederholen", kbd: "Strg+Y", enabled: () => st().future.length > 0, run: () => st().redo() },
    { id: "copy", group: "Bearbeiten", label: "Auswahl kopieren", kbd: "Strg+C", enabled: hasSel, run: () => void st().copyItems(st().selection) },
    { id: "cut", group: "Bearbeiten", label: "Auswahl ausschneiden", kbd: "Strg+X", enabled: hasSel, run: () => st().cutItems(st().selection) },
    { id: "paste", group: "Bearbeiten", label: "Einfügen", kbd: "Strg+V", run: pasteHere },
    { id: "dup", group: "Bearbeiten", label: "Auswahl duplizieren", kbd: "Strg+D", enabled: hasSel, run: () => st().duplicateItems(st().selection) },
    { id: "del", group: "Bearbeiten", label: "Auswahl löschen", kbd: "Entf", enabled: hasSel, run: () => st().removeItems(st().selection) },
    { id: "all", group: "Bearbeiten", label: "Alles auswählen", kbd: "Strg+A", run: () => st().select(st().project.items.filter((i) => !i.locked).map((i) => i.id)) },
    { id: "lock", group: "Bearbeiten", label: "Auswahl sperren / entsperren", kbd: "L", enabled: hasSel, run: toggleLock },
    { id: "hide", group: "Bearbeiten", label: "Auswahl ein-/ausblenden", kbd: "H", enabled: hasSel, run: toggleHidden },
    { id: "focus", group: "Ansicht", label: "Kamera auf Auswahl", kbd: "F", enabled: hasSel, run: focusSelection },
    { id: "v2d", group: "Ansicht", label: "Ansicht: nur 2D-Plan", kbd: "1", run: () => st().set("viewMode", "plan") },
    { id: "vsplit", group: "Ansicht", label: "Ansicht: 2D und 3D nebeneinander", kbd: "2", run: () => st().set("viewMode", "split") },
    { id: "v3d", group: "Ansicht", label: "Ansicht: nur 3D", kbd: "3", run: () => st().set("viewMode", "3d") },
    { id: "orbit", group: "Ansicht", label: "3D: Modellansicht", run: () => st().set("camera3d", "orbit") },
    { id: "top", group: "Ansicht", label: "3D: Draufsicht", run: () => st().set("camera3d", "top") },
    { id: "walk", group: "Ansicht", label: "3D: Rundgang (WASD)", keywords: "begehen laufen", run: () => st().set("camera3d", "walk") },
    { id: "night", group: "Ansicht", label: "Abendlicht ein/aus", keywords: "nacht licht leuchten", run: () => st().set("night", !st().night) },
    { id: "ceiling", group: "Ansicht", label: "Decke anzeigen ein/aus", run: () => st().set("showCeiling", !st().showCeiling) },
    { id: "doors", group: "Ansicht", label: "Türen öffnen/schließen", run: () => viewSetting({ doorsOpen: (st().project.settings.doorsOpen ?? 0) > 0.5 ? 0 : 0.9 }) },
    { id: "snap", group: "Ansicht", label: "Fang (Raster und Wände) ein/aus", run: () => viewSetting({ snap: !st().project.settings.snap }) },
    { id: "clearance", group: "Planung", label: "Freiflächen (Bewegungsflächen, Türen) im Plan ein/aus", keywords: "planungs-check abstand durchgang din", run: () => st().set("showClearance", !st().showClearance) },
    { id: "check", group: "Planung", label: "Planungs-Check öffnen", keywords: "prüfen konflikte bewegungsfläche lieferung", run: () => useEditor.setState({ leftTab: "planung", showClearance: true }) },
    { id: "variant-save", group: "Planung", label: "Aktuellen Stand als Variante sichern", keywords: "variante snapshot vergleichen", run: () => st().saveVariant(`Variante ${(st().project.variants?.length ?? 0) + 1}`) },
    { id: "help", group: "Hilfe", label: "Bedienung & Tastenkürzel", kbd: "F1", run: () => st().set("helpOpen", true) },
  ];
  for (const m of Object.keys(WALL_LABELS) as WallMode[]) cmds.push({ id: `wall-${m}`, group: "Ansicht", label: `Wände: ${WALL_LABELS[m]}`, kbd: m === "auto" ? "W" : undefined, run: () => st().set("wallMode", m) });
  for (const t of Object.keys(TAB_LABELS) as LeftTab[]) cmds.push({ id: `tab-${t}`, group: "Seitenleiste", label: `Seitenleiste: ${TAB_LABELS[t]}`, run: () => st().set("leftTab", t) });
  for (const c of concepts) cmds.push({ id: `concept-${c.id}`, group: "Konzepte", label: `${c.subtitle} laden: ${c.title}`, run: () => st().loadConcept(c.id) });
  for (const r of apartment.rooms) {
    cmds.push({
      id: `room-${r.id}`,
      group: "Räume",
      label: `Gehe zu ${roomNames[r.id]} (${r.id})`,
      keywords: `raum zimmer ${ROOM_SYNONYMS[r.id] ?? ""}`,
      run: () => {
        const c = polygonCentroid(r.polygon);
        st().select([]);
        st().selectFace(null);
        st().selectRoom(r.id);
        st().requestFocus(c[0], c[1]);
      },
    });
  }
  for (const f of recentFiles()) cmds.push({ id: `recent-${f.path}`, group: "Zuletzt verwendet", label: `Öffnen: ${fileName(f.path)}`, keywords: f.path, run: () => void openRecent(f.path) });
  return cmds;
}

export function toggleLock() {
  const s = st();
  const sel = s.project.items.filter((i) => s.selection.includes(i.id));
  if (!sel.length) return;
  const lock = sel.some((i) => !i.locked);
  s.updateItems(s.selection, (it) => void (it.locked = lock), { label: lock ? "Sperren" : "Entsperren" });
  s.showToast(lock ? `${sel.length === 1 ? "Objekt" : `${sel.length} Objekte`} gesperrt – L entsperrt` : "Entsperrt");
}

export function toggleHidden() {
  const s = st();
  const sel = s.project.items.filter((i) => s.selection.includes(i.id));
  if (!sel.length) return;
  const hide = sel.some((i) => !i.hidden);
  s.updateItems(s.selection, (it) => void (it.hidden = hide), { label: hide ? "Ausblenden" : "Einblenden" });
}

export function focusSelection() {
  const c = selectionCenter();
  if (c) st().requestFocus(c[0], c[1]);
}

/** Einfache Suche: alle Wörter müssen vorkommen (ohne Groß-/Kleinschreibung und Umlaut-Varianten). */
export function norm(s: string) {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

export function matches(hay: string, q: string) {
  const h = norm(hay);
  return norm(q).split(/\s+/).filter(Boolean).every((w) => h.includes(w));
}
