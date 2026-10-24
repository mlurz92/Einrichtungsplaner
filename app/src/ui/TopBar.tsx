import { Box, Camera, Clock, Columns2, DoorOpen, FileDown, FileImage, FilePlus, FolderOpen, Footprints, Home, Keyboard, Layers, Magnet, Moon, PanelLeft, PanelRight, Redo2, Rotate3d, Save, Search, Settings2, SlidersHorizontal, Square, Sun, Undo2, Upload } from "lucide-react";
import { useEditor, budgetSummary } from "../store/project";
import { concepts } from "../data";
import { fmtEuro } from "../model/geometry";
import { exportPlanPng, exportPlanSvg, exportScreenshot, exportShoppingList, importGlb, openProject, openRecent, printBudget, saveProject } from "./fileops";
import { fileName, useRecentFiles } from "./recent";
import { Menu, MenuItem, MenuLabel, MenuSep, Seg } from "./kit";
import { useUi } from "./prefs";

const fmtTime = (t: number) => `${Math.floor(t)}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;

const Divider = () => <div className="mx-0.5 h-5 w-px shrink-0 bg-stone-500/20" />;

export function TopBar() {
  const st = useEditor();
  const recent = useRecentFiles();
  const leftOpen = useUi((s) => s.leftOpen);
  const rightOpen = useUi((s) => s.rightOpen);
  const setPref = useUi((s) => s.setPref);
  const undoLabel = st.pastLabels[st.pastLabels.length - 1];
  const redoLabel = st.futureLabels[0];
  const total = budgetSummary(st.project).total;
  const limit = st.project.settings.budgetLimit || 40000;
  const over = total > limit;
  // Darstellungsschalter ohne Undo-Schritt
  const setSetting = (k: string, v: number | boolean) => useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, [k]: v } } }));
  const is3d = st.viewMode !== "plan";
  return (
    <header data-topbar className="glass relative z-40 flex h-12 shrink-0 items-center gap-1 rounded-xl px-1.5">
      <button className="btn-ghost h-8 w-8 shrink-0 p-0" data-on={leftOpen} title={leftOpen ? "Linke Leiste ausblenden (Strg+B)" : "Linke Leiste einblenden (Strg+B)"} onClick={() => setPref("leftOpen", !leftOpen)}>
        <PanelLeft size={16} className={leftOpen ? "" : "text-stone-400"} />
      </button>
      <div className="mr-1 flex w-52 min-w-24 shrink items-center gap-2 pl-0.5">
        <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="h-7 w-7 shrink-0 drop-shadow-sm" draggable={false} />
        <div className="min-w-0 flex-1 leading-tight">
          <input
            className="-mx-1 w-full rounded px-1 bg-transparent text-[13px] font-semibold outline-none hover:bg-stone-500/10 focus:bg-card focus:ring-2 focus:ring-accent/25"
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
      <Menu label="Datei">
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
        <MenuItem icon={<Camera size={15} />} onClick={exportScreenshot}>
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
      <Menu label={<span className="hidden min-[1760px]:inline">Konzepte</span>} title="Konzept laden" icon={<Layers size={15} />}>
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
      </Menu>
      <Divider />
      <button className="btn-ghost h-8 w-8 shrink-0 p-0" title={undoLabel ? `Rückgängig: ${undoLabel} (Strg+Z)` : "Rückgängig (Strg+Z)"} onClick={st.undo} disabled={!st.past.length}>
        <Undo2 size={16} />
      </button>
      <button className="btn-ghost h-8 w-8 shrink-0 p-0" title={redoLabel ? `Wiederholen: ${redoLabel} (Strg+Y)` : "Wiederholen (Strg+Y)"} onClick={st.redo} disabled={!st.future.length}>
        <Redo2 size={16} />
      </button>
      <Divider />
      <Seg
        label="Ansicht"
        value={st.viewMode}
        onChange={(v) => st.set("viewMode", v)}
        options={[
          { value: "plan", label: <Lbl icon={<Square size={13} />} text="2D" />, title: "2D-Plan (Taste 1)" },
          { value: "split", label: <Lbl icon={<Columns2 size={13} />} text="Geteilt" wide />, title: "2D und 3D nebeneinander (Taste 2)" },
          { value: "3d", label: <Lbl icon={<Box size={13} />} text="3D" />, title: "3D-Ansicht (Taste 3)" },
        ]}
      />
      {is3d && (
        <>
          <Seg
            label="Kamera"
            className="ml-1"
            value={st.camera3d}
            onChange={(v) => st.set("camera3d", v)}
            options={[
              { value: "orbit", label: <Lbl icon={<Rotate3d size={13} />} text="Modell" wide />, title: "Modellansicht: drehen, schwenken, zoomen" },
              { value: "top", label: <Lbl icon={<Square size={13} />} text="Oben" wide />, title: "Draufsicht" },
              { value: "walk", label: <Lbl icon={<Footprints size={13} />} text="Rundgang" wide />, title: "Rundgang (WASD, Maus; Esc beendet Mausfang)" },
            ]}
          />
          <Seg
            label="Wände"
            className="ml-1"
            value={st.wallMode}
            onChange={(v) => st.set("wallMode", v)}
            options={[
              { value: "auto", label: "Auto", title: "Wände automatisch kappen, wo sie den Blick verdecken (Taste W)" },
              { value: "full", label: "Voll", title: "Wände raumhoch" },
              { value: "cut", label: "Schnitt", title: "Wände bei 1,30 m geschnitten" },
              { value: "low", label: "Flach", title: "Nur Sockel" },
            ]}
          />
          <button className="btn-ghost ml-0.5 h-8 w-8 shrink-0 p-0" aria-pressed={st.night} title={st.night ? "Tageslicht" : "Abendlicht (Leuchten an)"} onClick={() => st.set("night", !st.night)}>
            {st.night ? <Moon size={16} className="text-amber-600" /> : <Sun size={16} />}
          </button>
          <Menu icon={<SlidersHorizontal size={16} />} title="Darstellung: Sonnenstand, Türen, Decke, Qualität" keepOpen className="btn-ghost h-8 px-1.5" chevron={false}>
            <div className="w-72 space-y-3 p-2.5 text-sm text-stone-700">
              <div className="panel-title">Darstellung 3D</div>
              <label className={`block ${st.night ? "opacity-40" : ""}`}>
                <span className="flex justify-between text-xs text-stone-500">
                  Sonnenstand <span className="tabular-nums text-stone-700">{fmtTime(st.project.settings.timeOfDay ?? 15)} Uhr</span>
                </span>
                <input type="range" min={7} max={19.5} step={0.25} disabled={st.night} value={st.project.settings.timeOfDay ?? 15} onChange={(e) => setSetting("timeOfDay", Number(e.target.value))} className="mt-1 w-full" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <DoorOpen size={15} className="text-stone-500" /> Türen geöffnet
                </span>
                <input type="checkbox" className="switch" checked={(st.project.settings.doorsOpen ?? 0) > 0.5} onChange={(e) => setSetting("doorsOpen", e.target.checked ? 0.9 : 0)} />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Decke anzeigen</span>
                <input type="checkbox" className="switch" checked={st.showCeiling} onChange={(e) => st.set("showCeiling", e.target.checked)} />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">Darstellungsqualität</span>
                <select className="field mt-1 text-sm" value={st.quality} onChange={(e) => st.set("quality", e.target.value as typeof st.quality)}>
                  <option value="hoch">Hoch (Umgebungsverdeckung, Glanz)</option>
                  <option value="mittel">Mittel</option>
                  <option value="niedrig">Schnell (schwächere Grafik)</option>
                </select>
              </label>
            </div>
          </Menu>
        </>
      )}
      <Divider />
      <button
        className="btn-ghost h-8 shrink-0 gap-1 px-1.5 text-xs"
        aria-pressed={st.project.settings.snap}
        title="Fang an Raster und Wänden – Alt hält ihn beim Ziehen an"
        onClick={() => setSetting("snap", !st.project.settings.snap)}
      >
        <Magnet size={15} className={st.project.settings.snap ? "text-accent-ink" : "text-stone-400"} />
        <span className="hidden min-[1840px]:inline">Fang</span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button className="group flex h-8 items-center gap-2 rounded-lg border border-line bg-card/50 pl-2 pr-1 text-xs text-stone-500 transition hover:border-stone-300 hover:bg-card hover:text-stone-800" title="Befehl, Raum, Objekt oder Produkt suchen (Strg+K)" onClick={() => st.set("paletteOpen", true)}>
          <Search size={14} />
          <span className="hidden w-20 text-left min-[1600px]:inline">Suchen …</span>
          <kbd className="hidden min-[1440px]:inline-flex">Strg K</kbd>
        </button>
        <button className="btn-ghost h-8 w-8 p-0 max-[1359px]:hidden!" title="Bedienung & Tastenkürzel (F1)" onClick={() => st.set("helpOpen", true)}>
          <Keyboard size={16} />
        </button>
        <button className="btn-ghost h-8 w-8 p-0" title="Einstellungen (Strg+,)" onClick={() => st.set("settingsOpen", true)}>
          <Settings2 size={16} />
        </button>
        <Divider />
        <button className="rounded-lg px-1.5 py-1 text-right transition hover:bg-stone-500/10" onClick={() => st.set("leftTab", "budget")} title={`Budget: ${fmtEuro(total)} von ${fmtEuro(limit)} – Budget öffnen`}>
          <div className={`text-[13px] font-semibold tabular-nums leading-tight ${over ? "text-red-700" : ""}`}>{fmtEuro(total)}</div>
          <div className="mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-stone-500/20 min-[1360px]:w-24">
            <div className={`h-full rounded-full transition-[width] duration-500 ${over ? "bg-red-600" : "bg-accent"}`} style={{ width: `${Math.min(100, (total / limit) * 100)}%` }} />
          </div>
        </button>
        <button className="btn-primary h-8 shrink-0" title="Speichern (Strg+S)" onClick={() => saveProject(false)}>
          <Save size={14} /> <span className="hidden min-[1680px]:inline">Speichern</span>
        </button>
        <button className="btn-ghost h-8 w-8 shrink-0 p-0" title={rightOpen ? "Rechte Leiste ausblenden (Strg+Umschalt+B)" : "Rechte Leiste einblenden (Strg+Umschalt+B)"} onClick={() => setPref("rightOpen", !rightOpen)}>
          <PanelRight size={16} className={rightOpen ? "" : "text-stone-400"} />
        </button>
      </div>
    </header>
  );
}

/** Beschriftung eines Segments: Symbol immer, Text ab ausreichender Breite (bei `wide` erst ab 1.440 px). */
function Lbl({ icon, text, wide }: { icon: React.ReactNode; text: string; wide?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      <span className={wide ? "hidden min-[1760px]:inline" : ""}>{text}</span>
    </span>
  );
}
