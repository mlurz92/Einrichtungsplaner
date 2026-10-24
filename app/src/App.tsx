import { lazy, Suspense, useEffect, useRef } from "react";
import { Boxes, ClipboardCheck, LayoutList, Palette, Sofa, Wallet } from "lucide-react";
import { restoredFromAutosave, useEditor } from "./store/project";
import { TopBar } from "./ui/TopBar";
import { HelpOverlay } from "./ui/Help";
import { NewFurnishingDialog } from "./ui/NewFurnishing";
import { CatalogPanel } from "./ui/CatalogPanel";
import { SwapPanel } from "./ui/SwapPanel";
import { Inspector } from "./ui/Inspector";
import { BudgetPanel, ConceptsPanel, DesignPanel, ObjectsPanel } from "./ui/Panels";
import { PlanningPanel } from "./ui/PlanningPanel";
import { Plan2D } from "./plan/Plan2D";
import { normAngle } from "./model/geometry";
import { openProject, saveProject } from "./ui/fileops";
import { StartScreen } from "./ui/StartScreen";
import { CommandPalette } from "./ui/CommandPalette";
import { CloseDialog, StatusBar, ToastView } from "./ui/StatusBar";
import { focusSelection, pasteHere, toggleHidden, toggleLock, toggleSwap } from "./ui/commands";
import { fileName } from "./ui/recent";
import { interceptWindowClose, isTauri, onOpenFileRequest, readTextPath, setWindowTitle, takeStartupFile, toggleFullscreen } from "./platform";
import { ContextMenuLayer, TooltipLayer } from "./ui/kit";
import { SettingsDialog } from "./ui/Settings";
import { SIDEBAR_LIMITS, useUi } from "./ui/prefs";
import { loadProjectText } from "./ui/fileops";
import { UpdateBanner } from "./ui/update";

const Scene3D = lazy(() => import("./three/Scene3D").then((m) => ({ default: m.Scene3D })));

const TABS = [
  { id: "katalog", label: "Katalog", icon: Sofa },
  { id: "gestaltung", label: "Gestaltung", icon: Palette },
  { id: "objekte", label: "Objekte", icon: LayoutList },
  { id: "konzepte", label: "Konzepte", icon: Boxes },
  { id: "planung", label: "Planung", icon: ClipboardCheck },
  { id: "budget", label: "Budget", icon: Wallet },
] as const;

const WALL_TOAST = { auto: "Automatisch (verdeckende Wände gekappt)", cut: "Schnitt 1,30 m", low: "Flach", full: "Raumhoch" } as const;

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // Befehlssuche auch aus Eingabefeldern heraus
      if (e.key === "F11") {
        e.preventDefault();
        void toggleFullscreen();
        return;
      }
      if (ctrl && e.key === "," && !st.closeAsk) {
        e.preventDefault();
        st.set("settingsOpen", !st.settingsOpen);
        return;
      }
      if (ctrl && key === "k" && !st.closeAsk) {
        e.preventDefault();
        st.set("startOpen", false);
        st.set("paletteOpen", !st.paletteOpen);
        return;
      }
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      // Offene Dialoge: nur Esc wirkt global
      if (st.paletteOpen || st.startOpen || st.closeAsk || st.newDialogOpen || st.settingsOpen || st.helpOpen) {
        if (e.key === "Escape" || (e.key === "F1" && st.helpOpen)) {
          e.preventDefault();
          st.set("paletteOpen", false);
          st.set("startOpen", false);
          st.set("closeAsk", false);
          st.set("newDialogOpen", false);
          st.set("settingsOpen", false);
          st.set("helpOpen", false);
        }
        return;
      }
      if (ctrl && key === "b") {
        e.preventDefault();
        const ui = useUi.getState();
        if (e.shiftKey) ui.setPref("rightOpen", !ui.rightOpen);
        else ui.setPref("leftOpen", !ui.leftOpen);
        return;
      }
      if (ctrl && key === "z") {
        e.preventDefault();
        e.shiftKey ? st.redo() : st.undo();
      } else if (ctrl && key === "y") {
        e.preventDefault();
        st.redo();
      } else if (ctrl && key === "s") {
        e.preventDefault();
        void saveProject(e.shiftKey);
      } else if (ctrl && key === "o") {
        e.preventDefault();
        void openProject();
      } else if (ctrl && key === "n") {
        e.preventDefault();
        st.set("newDialogOpen", true);
      } else if (ctrl && key === "d") {
        e.preventDefault();
        st.duplicateItems(st.selection);
      } else if (ctrl && key === "c") {
        if (st.selection.length) st.copyItems(st.selection);
      } else if (ctrl && key === "x") {
        e.preventDefault();
        st.cutItems(st.selection);
      } else if (ctrl && key === "v") {
        e.preventDefault();
        pasteHere();
      } else if (ctrl && key === "a") {
        e.preventDefault();
        st.select(st.project.items.filter((i) => !i.locked).map((i) => i.id));
      } else if (ctrl || e.altKey) {
        return;
      } else if (e.key === "Delete" || e.key === "Backspace") {
        st.removeItems(st.selection);
      } else if (e.key === "F1" || e.key === "?") {
        e.preventDefault();
        st.set("helpOpen", !st.helpOpen);
      } else if (e.key === "Escape") {
        if (st.helpOpen) return st.set("helpOpen", false);
        if (st.placing) return st.set("placing", null);
        if (st.swapFor) return st.set("swapFor", null);
        st.select([]);
        st.selectFace(null);
      } else if (st.camera3d === "walk" && st.viewMode !== "plan" && ["w", "a", "s", "d"].includes(key)) {
        return; // Rundgang
      } else if (e.key === "1" || e.key === "2" || e.key === "3") {
        st.set("viewMode", e.key === "1" ? "plan" : e.key === "2" ? "split" : "3d");
      } else if (key === "f" && st.selection.length) {
        focusSelection();
      } else if (key === "w" && st.viewMode !== "plan") {
        const order = ["auto", "cut", "low", "full"] as const;
        const next = order[(order.indexOf(st.wallMode) + 1) % order.length];
        st.set("wallMode", next);
        st.showToast(`Wände: ${WALL_TOAST[next]}`);
      } else if (key === "t" && st.selection.length === 1) {
        toggleSwap();
      } else if (key === "l" && st.selection.length) {
        toggleLock();
      } else if (key === "h" && st.selection.length) {
        toggleHidden();
      } else if (st.selection.length && key === "r") {
        st.updateItems(movableSelection(), (it) => void (it.rot = normAngle(it.rot + (e.shiftKey ? -15 : 15))), { label: "Drehen", coalesce: "rotate" });
      } else if (st.selection.length && (key === "q" || key === "e")) {
        st.updateItems(movableSelection(), (it) => void (it.rot = normAngle(it.rot + (key === "q" ? -1 : 1))), { label: "Feindrehen", coalesce: "rotate" });
      } else if (st.selection.length && e.key.startsWith("Arrow") && st.camera3d !== "walk") {
        e.preventDefault();
        const s = e.shiftKey ? 0.1 : 0.01;
        const dx = e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0;
        const dy = e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0;
        st.updateItems(
          movableSelection(),
          (it) => {
            it.x += dx;
            it.y += dy;
          },
          { label: "Verschieben (Pfeiltasten)", coalesce: "nudge" },
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Tauschliste über der linken Leiste; folgt der Auswahl, solange sie offen ist. */
function SwapOverlay() {
  const swapFor = useEditor((s) => s.swapFor);
  const selection = useEditor((s) => s.selection);
  const it = useEditor((s) => (s.swapFor ? s.project.items.find((i) => i.id === s.swapFor) : undefined));
  useEffect(() => {
    const st = useEditor.getState();
    if (!st.swapFor || selection[0] === st.swapFor) return;
    const next = selection.length === 1 ? st.project.items.find((i) => i.id === selection[0]) : undefined;
    st.set("swapFor", next && !next.existing ? next.id : null);
  }, [selection]);
  if (!swapFor || !it) return null;
  return (
    <div className="absolute inset-0 z-30 shadow-xl">
      <SwapPanel key={swapFor} it={it} onClose={() => useEditor.getState().set("swapFor", null)} />
    </div>
  );
}

function movableSelection() {
  const st = useEditor.getState();
  const locked = new Set(st.project.items.filter((i) => i.locked).map((i) => i.id));
  return st.selection.filter((id) => !locked.has(id));
}

/** Fenstertitel mit Projekt, Datei und Speicherzustand; Schließen-Abfrage bei ungespeicherten Änderungen. */
function useWindowState() {
  const name = useEditor((s) => s.project.name);
  const filePath = useEditor((s) => s.filePath);
  const dirty = useEditor((s) => s.dirty);
  useEffect(() => {
    void setWindowTitle(`${dirty ? "● " : ""}${name}${filePath ? ` – ${fileName(filePath)}` : ""} – Einrichtungsplaner WE 13`);
  }, [name, filePath, dirty]);
  useEffect(() => {
    if (isTauri) {
      let off: (() => void) | undefined;
      let alive = true;
      interceptWindowClose(() => {
        const st = useEditor.getState();
        if (!st.dirty) return true;
        st.set("closeAsk", true);
        return false;
      }).then((u) => (alive ? (off = u) : u()));
      return () => {
        alive = false;
        off?.();
      };
    }
    const f = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, []);
  useEffect(() => {
    if (restoredFromAutosave && !useEditor.getState().startOpen) {
      useEditor.getState().showToast("Letzter Arbeitsstand wiederhergestellt", { action: { label: "Startseite", run: () => useEditor.getState().set("startOpen", true) } });
    }
  }, []);
}

/** .we13 per Doppelklick (Programmstart oder zweite Instanz) und per Ziehen ins Fenster öffnen. */
function useFileOpening() {
  useEffect(() => {
    const open = async (path: string) => {
      try {
        loadProjectText(await readTextPath(path), path);
      } catch (e) {
        useEditor.getState().showToast(`Datei konnte nicht geöffnet werden: ${e instanceof Error ? e.message : String(e)}`, { kind: "error" });
      }
    };
    void takeStartupFile().then((p) => {
      if (p) void open(p);
    });
    let off: (() => void) | undefined;
    let alive = true;
    onOpenFileRequest((p) => void open(p)).then((u) => (alive ? (off = u) : u()));
    // Projektdatei aus dem Explorer ins Fenster ziehen (Browser-Variante; in Tauri über den Drop-Handler)
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const drop = async (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f || !/\.(we13|json)$/i.test(f.name)) return;
      e.preventDefault();
      try {
        loadProjectText(await f.text(), f.name);
      } catch (err) {
        useEditor.getState().showToast(`Datei konnte nicht geöffnet werden: ${err instanceof Error ? err.message : String(err)}`, { kind: "error" });
      }
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      alive = false;
      off?.();
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);
}

/** Ziehgriff zum Verstellen der Seitenleistenbreite (Doppelklick = Standardbreite). */
function Resizer({ side }: { side: "left" | "right" }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const key = side === "left" ? "leftWidth" : "rightWidth";
  const [min, max] = SIDEBAR_LIMITS[side];
  const set = (w: number) => useUi.getState().setPref(key, Math.round(Math.min(max, Math.max(min, w))));
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Breite der linken Leiste" : "Breite der rechten Leiste"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={useUi((s) => s[key])}
      tabIndex={0}
      title="Ziehen: Breite ändern · Doppelklick: Standardbreite"
      className="group relative z-10 -mx-1.5 w-3 shrink-0 cursor-col-resize outline-none"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: useUi.getState()[key] };
        document.documentElement.style.cursor = "col-resize";
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        set(s.w + (side === "left" ? 1 : -1) * (e.clientX - s.x));
      }}
      onPointerUp={() => {
        start.current = null;
        document.documentElement.style.cursor = "";
      }}
      onDoubleClick={() => set(side === "left" ? 340 : 320)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const d = (e.key === "ArrowRight" ? 1 : -1) * (side === "left" ? 1 : -1) * (e.shiftKey ? 40 : 10);
        set(useUi.getState()[key] + d);
      }}
    >
      <div className="absolute inset-y-6 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-100 group-active:opacity-100" />
    </div>
  );
}

/** Neu platzierte Produkte für „Zuletzt“ im Katalog merken (Konzept laden zählt nicht). */
function useRecentPlaced() {
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        const a = s.project.items;
        const b = prev.project.items;
        if (a === b || a.length <= b.length || a.length - b.length > 4) return;
        const old = new Set(b.map((i) => i.id));
        for (const it of a) if (!old.has(it.id) && !it.existing) useUi.getState().notePlaced(it.catalogId);
      }),
    [],
  );
}

export function App() {
  useShortcuts();
  useRecentPlaced();
  useWindowState();
  useFileOpening();
  const tab = useEditor((s) => s.leftTab);
  const setTab = (t: typeof tab) => useEditor.getState().set("leftTab", t);
  const viewMode = useEditor((s) => s.viewMode);
  const leftOpen = useUi((s) => s.leftOpen);
  const rightOpen = useUi((s) => s.rightOpen);
  const leftWidth = useUi((s) => s.leftWidth);
  const rightWidth = useUi((s) => s.rightWidth);
  return (
    <div className="flex h-full flex-col gap-1.5 p-1.5 pb-0">
      <TopBar />
      <StartScreen />
      <HelpOverlay />
      <NewFurnishingDialog />
      <CommandPalette />
      <CloseDialog />
      <SettingsDialog />
      <div className="flex min-h-0 flex-1 gap-1.5">
        {/* Linke Leiste */}
        {leftOpen && (
          <>
            <aside className="glass slide-in-left flex shrink-0 flex-col overflow-hidden rounded-xl" style={{ width: leftWidth }} aria-label="Katalog und Werkzeuge">
              <nav className="flex shrink-0 gap-0.5 border-b border-line p-1" role="tablist" aria-label="Bereiche">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium tracking-tight transition ${tab === t.id ? "bg-card text-accent-ink shadow-sm" : "text-stone-500 hover:bg-stone-500/10 hover:text-stone-800"}`}
                  >
                    <t.icon size={16} strokeWidth={tab === t.id ? 2.2 : 1.8} />
                    <span className="max-w-full truncate">{t.label}</span>
                  </button>
                ))}
              </nav>
              <div className="relative min-h-0 flex-1" role="tabpanel">
                <SwapOverlay />
                {tab === "katalog" && <CatalogPanel />}
                {tab === "gestaltung" && <DesignPanel />}
                {tab === "objekte" && <ObjectsPanel />}
                {tab === "konzepte" && <ConceptsPanel />}
                {tab === "planung" && <PlanningPanel />}
                {tab === "budget" && <BudgetPanel />}
              </div>
            </aside>
            <Resizer side="left" />
          </>
        )}
        {/* Ansichten */}
        <main className="glass flex min-w-0 flex-1 overflow-hidden rounded-xl p-0" aria-label="Plan und 3D-Ansicht">
          {viewMode !== "3d" && (
            <section id="viewport2d" aria-label="2D-Plan" className={`relative min-w-0 ${viewMode === "split" ? "w-1/2 border-r border-line" : "flex-1"}`}>
              <Plan2D />
            </section>
          )}
          {viewMode !== "plan" && (
            <section id="viewport3d" aria-label="3D-Ansicht" className="relative min-w-0 flex-1" style={{ background: "var(--scene-bg)" }}>
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-stone-500">3D-Ansicht wird geladen …</div>}>
                <Scene3D />
              </Suspense>
              <WalkHint />
            </section>
          )}
        </main>
        {/* Rechte Leiste */}
        {rightOpen && (
          <>
            <Resizer side="right" />
            <aside className="glass slide-in-right shrink-0 overflow-auto rounded-xl" style={{ width: rightWidth }} aria-label="Eigenschaften">
              <Inspector />
            </aside>
          </>
        )}
      </div>
      <StatusBar />
      <UpdateBanner />
      <ToastView />
      <ContextMenuLayer />
      <TooltipLayer />
    </div>
  );
}

function WalkHint() {
  const cam = useEditor((s) => s.camera3d);
  if (cam !== "walk") return null;
  return (
    <div className="glass-strong pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs text-stone-700">
      Rundgang: in die Ansicht klicken · Maus = umsehen · W A S D = gehen · Umschalt = schneller · Esc = Maus freigeben
    </div>
  );
}
