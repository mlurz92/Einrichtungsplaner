import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, Clock, DoorOpen, FileDown, FilePlus, FolderOpen, Home, Keyboard, Layers, Moon, Redo2, Save, Search, SlidersHorizontal, Sun, Undo2, Upload } from "lucide-react";
import { useEditor, budgetSummary } from "../store/project";
import { concepts } from "../data";
import { fmtEuro } from "../model/geometry";
import { exportPlanSvg, exportScreenshot, exportShoppingList, importGlb, openProject, openRecent, printBudget, saveProject } from "./fileops";
import { fileName, useRecentFiles } from "./recent";

function Menu({ label, icon, title, keepOpen, children }: { label?: React.ReactNode; icon?: React.ReactNode; title?: string; keepOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", f);
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("mousedown", f);
      window.removeEventListener("keydown", k);
    };
  }, []);
  return (
    <div ref={ref} className="relative">
      <button className="btn-ghost" title={title} onClick={() => setOpen((o) => !o)}>
        {icon}
        {label}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-56 rounded-lg border border-stone-200 bg-white p-1 shadow-xl" onClick={() => !keepOpen && setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

const Item = ({ onClick, children, kbd }: { onClick: () => void; children: React.ReactNode; kbd?: string }) => (
  <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100" onClick={onClick}>
    {children}
    {kbd && <span className="ml-auto text-[11px] text-stone-400">{kbd}</span>}
  </button>
);

const fmtTime = (t: number) => `${Math.floor(t)}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;

export function TopBar() {
  const st = useEditor();
  const recent = useRecentFiles();
  const undoLabel = st.pastLabels[st.pastLabels.length - 1];
  const redoLabel = st.futureLabels[0];
  const total = budgetSummary(st.project).total;
  const limit = st.project.settings.budgetLimit || 40000;
  const setSetting = (k: string, v: number | boolean) => useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, [k]: v } } }));
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-stone-200 bg-[#faf8f5] px-2">
      <div className="mr-2 flex w-60 min-w-32 shrink items-center gap-2 pl-1">
        <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="h-8 w-8 shrink-0" draggable={false} />
        <div className="min-w-0 flex-1 leading-tight">
          <input className="w-full bg-transparent text-sm font-semibold outline-none" title="Projektname (anklicken zum Umbenennen)" value={st.project.name} onChange={(e) => useEditor.setState((s) => ({ project: { ...s.project, name: e.target.value }, dirty: true }))} />
          <div className="truncate text-[10px] text-stone-500">Wohnung WE 13 · 91,80 m² · 2,56 m{st.dirty ? " · ungespeichert" : ""}</div>
        </div>
      </div>
      <Menu label="Datei">
        <Item onClick={() => st.set("startOpen", true)}>
          <Home size={15} /> Startseite …
        </Item>
        <Item onClick={() => st.set("newDialogOpen", true)} kbd="Strg+N">
          <FilePlus size={15} /> Neue Einrichtung (leere Wohnung) …
        </Item>
        <Item onClick={openProject} kbd="Strg+O">
          <FolderOpen size={15} /> Öffnen …
        </Item>
        {recent.length > 0 && (
          <>
            <div className="px-2.5 pb-0.5 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-stone-400">Zuletzt verwendet</div>
            {recent.slice(0, 5).map((r) => (
              <Item key={r.path} onClick={() => void openRecent(r.path)}>
                <Clock size={14} className="text-stone-400" />
                <span className="max-w-64 truncate" title={r.path}>
                  {fileName(r.path)}
                </span>
              </Item>
            ))}
            <div className="my-1 border-t border-stone-100" />
          </>
        )}
        <Item onClick={() => saveProject(false)} kbd="Strg+S">
          <Save size={15} /> Speichern
        </Item>
        <Item onClick={() => saveProject(true)} kbd="Strg+Umschalt+S">
          <Save size={15} /> Speichern unter …
        </Item>
        <div className="my-1 border-t border-stone-100" />
        <Item onClick={exportScreenshot}>
          <Camera size={15} /> 3D-Ansicht als PNG
        </Item>
        <Item onClick={exportPlanSvg}>
          <FileDown size={15} /> Grundriss als SVG
        </Item>
        <Item onClick={exportShoppingList}>
          <FileDown size={15} /> Einkaufsliste (CSV/Excel)
        </Item>
        <Item onClick={printBudget}>
          <FileDown size={15} /> Einkaufsliste drucken / PDF
        </Item>
        <div className="my-1 border-t border-stone-100" />
        <Item onClick={importGlb}>
          <Upload size={15} /> Eigenes 3D-Modell (GLB) importieren
        </Item>
      </Menu>
      <Menu label={<span className="hidden 2xl:inline">Konzepte</span>} title="Konzepte laden" icon={<Layers size={15} />}>
        {concepts.map((c) => (
          <Item key={c.id} onClick={() => st.loadConcept(c.id)}>
            <span className="flex h-3 w-12 overflow-hidden rounded-sm">
              {c.palette.map((p) => (
                <span key={p} className="flex-1" style={{ background: p }} />
              ))}
            </span>
            {c.subtitle}: {c.title}
          </Item>
        ))}
      </Menu>
      <div className="mx-1 h-6 w-px bg-stone-200" />
      <button className="btn-ghost" title={undoLabel ? `Rückgängig: ${undoLabel} (Strg+Z)` : "Rückgängig (Strg+Z)"} onClick={st.undo} disabled={!st.past.length}>
        <Undo2 size={16} />
      </button>
      <button className="btn-ghost" title={redoLabel ? `Wiederholen: ${redoLabel} (Strg+Y)` : "Wiederholen (Strg+Y)"} onClick={st.redo} disabled={!st.future.length}>
        <Redo2 size={16} />
      </button>
      <div className="mx-1 h-6 w-px bg-stone-200" />
      <div className="seg whitespace-nowrap">
        <button data-on={st.viewMode === "plan"} onClick={() => st.set("viewMode", "plan")} title="2D-Plan (Taste 1)">
          2D
        </button>
        <button data-on={st.viewMode === "split"} onClick={() => st.set("viewMode", "split")} title="2D und 3D (Taste 2)">
          2D | 3D
        </button>
        <button data-on={st.viewMode === "3d"} onClick={() => st.set("viewMode", "3d")} title="3D (Taste 3)">
          3D
        </button>
      </div>
      {st.viewMode !== "plan" && (
        <>
          <div className="seg ml-1 whitespace-nowrap">
            <button data-on={st.camera3d === "orbit"} onClick={() => st.set("camera3d", "orbit")} title="Modellansicht">
              Modell
            </button>
            <button data-on={st.camera3d === "top"} onClick={() => st.set("camera3d", "top")} title="Draufsicht">
              Oben
            </button>
            <button data-on={st.camera3d === "walk"} onClick={() => st.set("camera3d", "walk")} title="Rundgang (WASD, Maus; Esc beendet Mausfang)">
              Rundgang
            </button>
          </div>
          <div className="seg ml-1 whitespace-nowrap" title="Wanddarstellung">
            <button data-on={st.wallMode === "auto"} onClick={() => st.set("wallMode", "auto")} title="Automatisch: Wände, die Teile der Wohnung verdecken, werden auf 15 cm gekappt (wie bei Die Sims). Taste W wechselt.">
              Auto
            </button>
            <button data-on={st.wallMode === "full"} onClick={() => st.set("wallMode", "full")} title="Wände raumhoch">
              Voll
            </button>
            <button data-on={st.wallMode === "cut"} onClick={() => st.set("wallMode", "cut")} title="Wände bei 1,30 m geschnitten">
              Schnitt
            </button>
            <button data-on={st.wallMode === "low"} onClick={() => st.set("wallMode", "low")} title="Nur Sockel">
              Flach
            </button>
          </div>
          <button className="btn-ghost ml-1" title={st.night ? "Tageslicht" : "Abendlicht (Leuchten an)"} onClick={() => st.set("night", !st.night)}>
            {st.night ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <Menu icon={<SlidersHorizontal size={16} />} title="Darstellung: Sonnenstand, Türen, Decke, Qualität" keepOpen>
            <div className="w-64 space-y-2.5 p-2 text-sm text-stone-700">
              <label className={`block ${st.night ? "opacity-40" : ""}`}>
                <span className="flex justify-between text-xs text-stone-500">
                  Sonnenstand <span className="tabular-nums">{fmtTime(st.project.settings.timeOfDay ?? 15)} Uhr</span>
                </span>
                <input type="range" min={7} max={19.5} step={0.25} disabled={st.night} value={st.project.settings.timeOfDay ?? 15} onChange={(e) => setSetting("timeOfDay", Number(e.target.value))} className="w-full accent-amber-600" />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="" checked={(st.project.settings.doorsOpen ?? 0) > 0.5} onChange={(e) => setSetting("doorsOpen", e.target.checked ? 0.9 : 0)} />
                <DoorOpen size={15} className="text-stone-500" /> Türen geöffnet
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="" checked={st.showCeiling} onChange={(e) => st.set("showCeiling", e.target.checked)} /> Decke anzeigen
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">Darstellungsqualität</span>
                <select className="field mt-0.5 text-sm" value={st.quality} onChange={(e) => st.set("quality", e.target.value as typeof st.quality)}>
                  <option value="hoch">hoch</option>
                  <option value="mittel">mittel</option>
                  <option value="niedrig">schnell (schwächere Grafik)</option>
                </select>
              </label>
            </div>
          </Menu>
        </>
      )}
      <label className="ml-2 flex items-center gap-1 text-xs text-stone-600" title="Fang (Raster und Wände), Alt hält ihn temporär an">
        <input type="checkbox" className="" checked={st.project.settings.snap} onChange={(e) => setSetting("snap", e.target.checked)} /> Fang
      </label>
      <button className="btn-ghost ml-1" title="Bedienung & Tastenkürzel (F1)" onClick={() => st.set("helpOpen", true)}>
        <Keyboard size={16} />
      </button>
      <button className="btn-ghost" title="Befehl, Raum, Objekt oder Produkt suchen (Strg+K)" onClick={() => st.set("paletteOpen", true)}>
        <Search size={16} />
      </button>
      <div className="ml-auto flex items-center gap-2">
        <button className="text-right" onClick={() => st.set("leftTab", "budget")} title="Budget öffnen">
          <div className={`text-sm font-semibold tabular-nums ${total > limit ? "text-red-700" : ""}`}>{fmtEuro(total)}</div>
          <div className="h-1 w-16 overflow-hidden rounded-full bg-stone-200 min-[1360px]:w-28">
            <div className={`h-full ${total > limit ? "bg-red-600" : "bg-accent"}`} style={{ width: `${Math.min(100, (total / limit) * 100)}%` }} />
          </div>
        </button>
        <button className="btn-primary shrink-0" title="Speichern (Strg+S)" onClick={() => saveProject(false)}>
          <Save size={14} /> <span className="hidden min-[1360px]:inline">Speichern</span>
        </button>
      </div>
    </div>
  );
}
