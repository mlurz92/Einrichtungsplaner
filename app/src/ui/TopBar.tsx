import {
  ArrowLeftRight,
  BookOpen,
  Camera,
  ClipboardCheck,
  ClipboardPaste,
  Clock,
  Copy,
  CopyPlus,
  Eye,
  FileDown,
  FileImage,
  FilePlus,
  FolderOpen,
  GitCompareArrows,
  Home,
  Info,
  Keyboard,
  Lock,
  Magnet,
  Maximize,
  Minimize2,
  PanelLeft,
  PanelRight,
  Redo2,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Settings2,
  SquareDashed,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { useEditor, budgetSummary } from "../store/project";
import { concepts } from "../data";
import { fmtEuro } from "../model/geometry";
import { exportPlanPng, exportPlanSvg, exportScreenshot, exportShoppingList, importGlb, openProject, openRecent, printBudget, saveProject } from "./fileops";
import { fileName, useRecentFiles } from "./recent";
import { Menu, MenuBar, MenuItem, MenuLabel, MenuSep } from "./kit";
import { useUi } from "./prefs";
import { pasteHere, toggleHidden, toggleLock, toggleSwap } from "./commands";
import { openExternal, toggleFullscreen } from "../platform";
import { useView3D } from "../three/viewStore";
import { matchingView, useLayout, VIEW_PRESETS } from "./layout";
import { LayoutMenuItems, LayoutPicker } from "./Viewports";

export const DOCS_URL = "https://github.com/mlurz92/Einrichtungsplaner/blob/main/docs/Programmbeschreibung.md";
export const RELEASES_URL = "https://github.com/mlurz92/Einrichtungsplaner/releases";

const Divider = () => <div className="mx-1 h-5 w-px shrink-0 bg-stone-500/20" />;

/**
 * Kopfleiste im Stil klassischer Windows-Programme: Menüleiste (Datei, Bearbeiten, Ansicht, Konzepte, Hilfe),
 * daneben nur die häufigsten Befehle. Alles Ansichtsbezogene sitzt in der Kopfzeile des jeweiligen Fensters.
 */
export function TopBar() {
  const st = useEditor();
  const leftOpen = useUi((s) => s.leftOpen);
  const rightOpen = useUi((s) => s.rightOpen);
  const setPref = useUi((s) => s.setPref);
  const undoLabel = st.pastLabels[st.pastLabels.length - 1];
  const redoLabel = st.futureLabels[0];
  const total = budgetSummary(st.project).total;
  const limit = st.project.settings.budgetLimit || 40000;
  const over = total > limit;
  const snap = st.project.settings.snap;
  const setSnap = () => useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, snap: !snap } } }));
  return (
    <header data-topbar className="glass relative z-40 flex h-12 shrink-0 items-center gap-1 rounded-xl px-1.5">
      <div className="flex w-48 min-w-28 shrink items-center gap-2 pl-1 min-[1440px]:w-56">
        <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="h-7 w-7 shrink-0" draggable={false} />
        <div className="min-w-0 flex-1 leading-tight">
          <input
            className="-mx-1 w-full rounded bg-transparent px-1 text-[13px] font-semibold outline-none hover:bg-stone-500/10 focus:bg-card focus:ring-2 focus:ring-accent/25"
            title="Projektname (anklicken zum Umbenennen)"
            aria-label="Projektname"
            value={st.project.name}
            onChange={(e) => useEditor.setState((s) => ({ project: { ...s.project, name: e.target.value }, dirty: true }))}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <div className="truncate text-[10.5px] text-stone-500">
            WE 13 · 91,80 m²{st.dirty && <span className="text-amber-800"> · ungespeichert</span>}
          </div>
        </div>
      </div>
      <MenuBar label="Hauptmenü" className="gap-0">
        <FileMenu />
        <EditMenu />
        <ViewMenu />
        <ConceptMenu />
        <HelpMenu />
      </MenuBar>
      <Divider />
      <button className="btn-ghost h-8 w-8 shrink-0 p-0" title={undoLabel ? `Rückgängig: ${undoLabel} (Strg+Z)` : "Rückgängig (Strg+Z)"} onClick={st.undo} disabled={!st.past.length}>
        <Undo2 size={16} />
      </button>
      <button className="btn-ghost h-8 w-8 shrink-0 p-0" title={redoLabel ? `Wiederholen: ${redoLabel} (Strg+Y)` : "Wiederholen (Strg+Y)"} onClick={st.redo} disabled={!st.future.length}>
        <Redo2 size={16} />
      </button>
      <Divider />
      <LayoutPicker />
      <button className="btn-ghost h-8 w-8 shrink-0 p-0" aria-pressed={snap} title={snap ? "Fang an Raster und Wänden: an (Alt hält ihn beim Ziehen an)" : "Fang an Raster und Wänden: aus"} onClick={setSnap}>
        <Magnet size={16} className={snap ? "text-accent-ink" : "text-stone-400"} />
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button className="group flex h-8 items-center gap-2 rounded-lg border border-line bg-card/50 pl-2 pr-1 text-xs text-stone-500 transition hover:border-stone-300 hover:bg-card hover:text-stone-800" title="Befehl, Raum, Objekt oder Produkt suchen (Strg+K)" onClick={() => st.set("paletteOpen", true)}>
          <Search size={14} />
          <span className="hidden w-24 text-left min-[1440px]:inline">Suchen …</span>
          <kbd className="hidden min-[1360px]:inline-flex">Strg K</kbd>
        </button>
        <Divider />
        <button className="rounded-lg px-1.5 py-1 text-right transition hover:bg-stone-500/10" onClick={() => st.set("leftTab", "budget")} title={`Budget: ${fmtEuro(total)} von ${fmtEuro(limit)} – Budget öffnen`}>
          <div className={`text-[13px] font-semibold tabular-nums leading-tight ${over ? "text-red-700" : ""}`}>{fmtEuro(total)}</div>
          <div className="mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-stone-500/20 min-[1360px]:w-24">
            <div className={`h-full rounded-full transition-[width] duration-500 ${over ? "bg-red-600" : "bg-accent"}`} style={{ width: `${Math.min(100, (total / limit) * 100)}%` }} />
          </div>
        </button>
        <button className="btn-primary h-8 shrink-0" title="Speichern (Strg+S)" onClick={() => saveProject(false)}>
          <Save size={14} /> <span className="hidden min-[1520px]:inline">Speichern</span>
        </button>
        <Divider />
        <div className="flex items-center" role="group" aria-label="Seitenleisten">
          <button className="btn-ghost h-8 w-8 shrink-0 p-0" aria-pressed={leftOpen} title={leftOpen ? "Linke Leiste ausblenden (Strg+B)" : "Linke Leiste einblenden (Strg+B)"} onClick={() => setPref("leftOpen", !leftOpen)}>
            <PanelLeft size={16} className={leftOpen ? "text-accent-ink" : "text-stone-400"} />
          </button>
          <button className="btn-ghost h-8 w-8 shrink-0 p-0" aria-pressed={rightOpen} title={rightOpen ? "Rechte Leiste ausblenden (Strg+Umschalt+B)" : "Rechte Leiste einblenden (Strg+Umschalt+B)"} onClick={() => setPref("rightOpen", !rightOpen)}>
            <PanelRight size={16} className={rightOpen ? "text-accent-ink" : "text-stone-400"} />
          </button>
        </div>
      </div>
    </header>
  );
}

const MENU_BTN = "btn-ghost h-8 px-2 text-[13px] data-[open=true]:bg-stone-500/14 data-[open=true]:text-stone-900";

function FileMenu() {
  const st = useEditor.getState();
  const recent = useRecentFiles();
  return (
    <Menu label="Datei" chevron={false} className={MENU_BTN}>
      <MenuItem icon={<Home size={15} />} onClick={() => st.set("startOpen", true)}>
        Startseite …
      </MenuItem>
      <MenuItem icon={<FilePlus size={15} />} onClick={() => st.set("newDialogOpen", true)} kbd="Strg+N">
        Neue Einrichtung …
      </MenuItem>
      <MenuItem icon={<FolderOpen size={15} />} onClick={openProject} kbd="Strg+O">
        Öffnen …
      </MenuItem>
      {recent.length > 0 && (
        <>
          <MenuLabel>Zuletzt verwendet</MenuLabel>
          {recent.slice(0, 5).map((r) => (
            <MenuItem key={r.path} icon={<Clock size={14} />} title={r.path} onClick={() => void openRecent(r.path)}>
              {fileName(r.path)}
            </MenuItem>
          ))}
        </>
      )}
      <MenuSep />
      <MenuItem icon={<Save size={15} />} onClick={() => saveProject(false)} kbd="Strg+S">
        Speichern
      </MenuItem>
      <MenuItem icon={<Save size={15} />} onClick={() => saveProject(true)} kbd="Strg+Umschalt+S">
        Speichern unter …
      </MenuItem>
      <MenuSep />
      <MenuLabel>Exportieren</MenuLabel>
      <MenuItem icon={<Camera size={15} />} onClick={() => void exportScreenshot()}>
        3D-Ansicht als Bild (PNG)
      </MenuItem>
      <MenuItem icon={<FileImage size={15} />} onClick={exportPlanPng}>
        Grundriss als Bild (PNG)
      </MenuItem>
      <MenuItem icon={<FileDown size={15} />} onClick={exportPlanSvg}>
        Grundriss als Vektorgrafik (SVG)
      </MenuItem>
      <MenuItem icon={<FileDown size={15} />} onClick={exportShoppingList}>
        Einkaufsliste (CSV/Excel)
      </MenuItem>
      <MenuItem icon={<FileDown size={15} />} onClick={printBudget}>
        Einkaufsliste drucken / PDF
      </MenuItem>
      <MenuSep />
      <MenuItem icon={<Upload size={15} />} onClick={importGlb}>
        Eigenes 3D-Modell (GLB) importieren …
      </MenuItem>
      <MenuSep />
      <MenuItem icon={<Settings2 size={15} />} onClick={() => st.set("settingsOpen", true)} kbd="Strg+,">
        Einstellungen …
      </MenuItem>
    </Menu>
  );
}

function EditMenu() {
  const st = useEditor();
  const sel = st.selection.length > 0;
  const snap = st.project.settings.snap;
  return (
    <Menu label="Bearbeiten" chevron={false} className={MENU_BTN}>
      <MenuItem icon={<Undo2 size={15} />} kbd="Strg+Z" disabled={!st.past.length} onClick={st.undo}>
        Rückgängig{st.pastLabels.length ? `: ${st.pastLabels[st.pastLabels.length - 1]}` : ""}
      </MenuItem>
      <MenuItem icon={<Redo2 size={15} />} kbd="Strg+Y" disabled={!st.future.length} onClick={st.redo}>
        Wiederholen{st.futureLabels.length ? `: ${st.futureLabels[0]}` : ""}
      </MenuItem>
      <MenuSep />
      <MenuItem icon={<Scissors size={15} />} kbd="Strg+X" disabled={!sel} onClick={() => st.cutItems(st.selection)}>
        Ausschneiden
      </MenuItem>
      <MenuItem icon={<Copy size={15} />} kbd="Strg+C" disabled={!sel} onClick={() => st.copyItems(st.selection)}>
        Kopieren
      </MenuItem>
      <MenuItem icon={<ClipboardPaste size={15} />} kbd="Strg+V" onClick={pasteHere}>
        Einfügen
      </MenuItem>
      <MenuItem icon={<CopyPlus size={15} />} kbd="Strg+D" disabled={!sel} onClick={() => st.duplicateItems(st.selection)}>
        Duplizieren
      </MenuItem>
      <MenuItem icon={<Trash2 size={15} />} kbd="Entf" danger disabled={!sel} onClick={() => st.removeItems(st.selection)}>
        Löschen
      </MenuItem>
      <MenuSep />
      <MenuItem icon={<SquareDashed size={15} />} kbd="Strg+A" onClick={() => st.select(st.project.items.filter((i) => !i.locked).map((i) => i.id))}>
        Alles auswählen
      </MenuItem>
      <MenuSep />
      <MenuItem icon={<ArrowLeftRight size={15} />} kbd="T" disabled={!sel} onClick={toggleSwap}>
        Tauschen (Alternativen mit Vorschau) …
      </MenuItem>
      <MenuItem icon={<Lock size={15} />} kbd="L" disabled={!sel} onClick={toggleLock}>
        Sperren / Entsperren
      </MenuItem>
      <MenuItem icon={<Eye size={15} />} kbd="H" disabled={!sel} onClick={toggleHidden}>
        Ausblenden / Einblenden
      </MenuItem>
      <MenuSep />
      <MenuItem
        checked={snap}
        icon={<Magnet size={15} />}
        onClick={() => useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, snap: !snap } } }))}
        title="Raster- und Wandfang beim Ziehen; Alt hält ihn vorübergehend an"
      >
        Fang an Raster und Wänden
      </MenuItem>
    </Menu>
  );
}

function ViewMenu() {
  const lay = useLayout();
  const ui = useUi();
  const night = useEditor((s) => s.night);
  const showCeiling = useEditor((s) => s.showCeiling);
  const doors = useEditor((s) => (s.project.settings.doorsOpen ?? 0) > 0.5);
  const lampsDay = useView3D((s) => s.lampsDay);
  const single = lay.layout === "single";
  const current = matchingView(lay);
  return (
    <Menu label="Ansicht" chevron={false} className={MENU_BTN}>
      <MenuLabel>Vorgefertigte Ansichten</MenuLabel>
      {VIEW_PRESETS.map((v) => (
        <MenuItem key={v.id} checked={current === v.id} kbd={v.kbd} title={v.hint} onClick={() => lay.applyView(v.id)}>
          {v.label} – {v.hint}
        </MenuItem>
      ))}
      <MenuLabel>Aufteilung</MenuLabel>
      <LayoutMenuItems />
      <MenuSep />
      <MenuItem icon={lay.maximized != null ? <Minimize2 size={15} /> : <Maximize size={15} />} kbd="Strg+Leertaste" disabled={single} onClick={() => lay.toggleMaximize()}>
        {lay.maximized != null ? "Aufteilung wiederherstellen" : "Aktives Fenster maximieren"}
      </MenuItem>
      <MenuItem icon={<RotateCcw size={15} />} onClick={() => lay.reset()} title="Zwei Fenster nebeneinander: 2D-Plan links, 3D rechts">
        Aufteilung zurücksetzen
      </MenuItem>
      <MenuSep />
      <MenuItem checked={ui.leftOpen} kbd="Strg+B" onClick={() => ui.setPref("leftOpen", !ui.leftOpen)}>
        Linke Leiste (Katalog und Werkzeuge)
      </MenuItem>
      <MenuItem checked={ui.rightOpen} kbd="Strg+Umschalt+B" onClick={() => ui.setPref("rightOpen", !ui.rightOpen)}>
        Rechte Leiste (Eigenschaften)
      </MenuItem>
      <MenuItem icon={<Maximize size={15} />} kbd="F11" onClick={() => void toggleFullscreen()}>
        Vollbild
      </MenuItem>
      <MenuSep />
      <MenuLabel>3D-Darstellung</MenuLabel>
      <MenuItem checked={night} onClick={() => useEditor.getState().set("night", !night)}>
        Abendlicht (Leuchten an)
      </MenuItem>
      <MenuItem checked={lampsDay} onClick={() => useView3D.getState().set("lampsDay", !lampsDay)}>
        Leuchten auch tagsüber
      </MenuItem>
      <MenuItem checked={showCeiling} onClick={() => useEditor.getState().set("showCeiling", !showCeiling)}>
        Decke anzeigen
      </MenuItem>
      <MenuItem checked={doors} onClick={() => useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, doorsOpen: doors ? 0 : 0.9 } } }))}>
        Türen geöffnet
      </MenuItem>
      <MenuSep />
      <MenuLabel>Design</MenuLabel>
      <MenuItem checked={ui.theme === "light"} onClick={() => ui.setPref("theme", "light")}>
        Hell
      </MenuItem>
      <MenuItem checked={ui.theme === "dark"} onClick={() => ui.setPref("theme", "dark")}>
        Dunkel
      </MenuItem>
      <MenuItem checked={ui.theme === "system"} onClick={() => ui.setPref("theme", "system")}>
        Wie Windows
      </MenuItem>
    </Menu>
  );
}

function ConceptMenu() {
  const st = useEditor.getState();
  return (
    <Menu label="Konzepte" chevron={false} className={MENU_BTN}>
      <MenuLabel>Konzept laden (ersetzt die Möblierung)</MenuLabel>
      {concepts.map((c) => (
        <MenuItem
          key={c.id}
          icon={
            <span className="flex h-3.5 w-3.5 overflow-hidden rounded-full ring-1 ring-black/10">
              {c.palette.slice(0, 3).map((p) => (
                <span key={p} className="flex-1" style={{ background: p }} />
              ))}
            </span>
          }
          onClick={() => st.loadConcept(c.id)}
        >
          <span className="text-stone-500">{c.subtitle}:</span> {c.title}
        </MenuItem>
      ))}
      <MenuSep />
      <MenuItem icon={<GitCompareArrows size={15} />} onClick={() => st.set("leftTab", "konzepte")}>
        Varianten sichern und vergleichen …
      </MenuItem>
      <MenuItem icon={<ClipboardCheck size={15} />} onClick={() => useEditor.setState({ leftTab: "planung", showClearance: true })}>
        Planungs-Check …
      </MenuItem>
    </Menu>
  );
}

function HelpMenu() {
  const st = useEditor.getState();
  return (
    <Menu label="Hilfe" chevron={false} className={MENU_BTN}>
      <MenuItem icon={<Keyboard size={15} />} kbd="F1" onClick={() => st.set("helpOpen", true)}>
        Bedienung und Tastenkürzel
      </MenuItem>
      <MenuItem icon={<Search size={15} />} kbd="Strg+K" onClick={() => st.set("paletteOpen", true)}>
        Befehlssuche
      </MenuItem>
      <MenuItem icon={<BookOpen size={15} />} onClick={() => void openExternal(DOCS_URL)}>
        Programmbeschreibung (online)
      </MenuItem>
      <MenuItem icon={<FileDown size={15} />} onClick={() => void openExternal(RELEASES_URL)}>
        Versionshinweise
      </MenuItem>
      <MenuSep />
      <MenuItem icon={<Info size={15} />} onClick={() => st.set("aboutOpen", true)}>
        Über den Einrichtungsplaner …
      </MenuItem>
    </Menu>
  );
}
