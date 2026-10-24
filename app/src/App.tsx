import { lazy, Suspense, useEffect } from "react";
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
import { interceptWindowClose, isTauri, setWindowTitle } from "./platform";

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
      if (ctrl && key === "k" && !st.closeAsk) {
        e.preventDefault();
        st.set("startOpen", false);
        st.set("paletteOpen", !st.paletteOpen);
        return;
      }
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      // Offene Dialoge: nur Esc wirkt global
      if (st.paletteOpen || st.startOpen || st.closeAsk || st.newDialogOpen) {
        if (e.key === "Escape") {
          st.set("paletteOpen", false);
          st.set("startOpen", false);
          st.set("closeAsk", false);
          st.set("newDialogOpen", false);
        }
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
      } else if (key === "f" && st.selection.length && st.viewMode !== "plan") {
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

export function App() {
  useShortcuts();
  useWindowState();
  const tab = useEditor((s) => s.leftTab);
  const setTab = (t: typeof tab) => useEditor.getState().set("leftTab", t);
  const viewMode = useEditor((s) => s.viewMode);
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <StartScreen />
      <HelpOverlay />
      <NewFurnishingDialog />
      <CommandPalette />
      <CloseDialog />
      <div className="flex min-h-0 flex-1">
        {/* Linke Leiste */}
        <aside className="flex w-[340px] shrink-0 flex-col border-r border-stone-200 bg-[#faf8f5]">
          <nav className="flex border-b border-stone-200">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium transition ${tab === t.id ? "border-b-2 border-[#2f5d50] text-[#2f5d50]" : "text-stone-500 hover:text-stone-800"}`}>
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="relative min-h-0 flex-1">
            <SwapOverlay />
            {tab === "katalog" && <CatalogPanel />}
            {tab === "gestaltung" && <DesignPanel />}
            {tab === "objekte" && <ObjectsPanel />}
            {tab === "konzepte" && <ConceptsPanel />}
            {tab === "planung" && <PlanningPanel />}
            {tab === "budget" && <BudgetPanel />}
          </div>
        </aside>
        {/* Ansichten */}
        <main className="flex min-w-0 flex-1">
          {viewMode !== "3d" && (
            <section id="viewport2d" className={`relative min-w-0 ${viewMode === "split" ? "w-1/2 border-r border-stone-200" : "flex-1"}`}>
              <Plan2D />
            </section>
          )}
          {viewMode !== "plan" && (
            <section id="viewport3d" className="relative min-w-0 flex-1 bg-[#e9e7e2]">
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-stone-500">3D-Ansicht wird geladen …</div>}>
                <Scene3D />
              </Suspense>
              <WalkHint />
            </section>
          )}
        </main>
        {/* Rechte Leiste */}
        <aside className="w-[320px] shrink-0 overflow-auto border-l border-stone-200 bg-[#faf8f5]">
          <Inspector />
        </aside>
      </div>
      <StatusBar />
      <ToastView />
    </div>
  );
}

function WalkHint() {
  const cam = useEditor((s) => s.camera3d);
  if (cam !== "walk") return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
      Rundgang: in die Ansicht klicken · Maus = umsehen · W A S D = gehen · Umschalt = schneller · Esc = Maus freigeben
    </div>
  );
}
