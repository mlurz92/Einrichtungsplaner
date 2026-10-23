import { lazy, Suspense, useEffect } from "react";
import { Boxes, LayoutList, Palette, Sofa, Wallet } from "lucide-react";
import { useEditor } from "./store/project";
import { TopBar } from "./ui/TopBar";
import { HelpOverlay } from "./ui/Help";
import { CatalogPanel } from "./ui/CatalogPanel";
import { Inspector } from "./ui/Inspector";
import { BudgetPanel, ConceptsPanel, DesignPanel, ObjectsPanel } from "./ui/Panels";
import { Plan2D } from "./plan/Plan2D";
import { normAngle } from "./model/geometry";
import { openProject, saveProject } from "./ui/fileops";

const Scene3D = lazy(() => import("./three/Scene3D").then((m) => ({ default: m.Scene3D })));

const TABS = [
  { id: "katalog", label: "Katalog", icon: Sofa },
  { id: "gestaltung", label: "Gestaltung", icon: Palette },
  { id: "objekte", label: "Objekte", icon: LayoutList },
  { id: "konzepte", label: "Konzepte", icon: Boxes },
  { id: "budget", label: "Budget", icon: Wallet },
] as const;

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const st = useEditor.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? st.redo() : st.undo();
      } else if (ctrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
      } else if (ctrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveProject(e.shiftKey);
      } else if (ctrl && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openProject();
      } else if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        st.duplicateItems(st.selection);
      } else if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        st.select(st.project.items.filter((i) => !i.locked).map((i) => i.id));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        st.removeItems(st.selection);
      } else if (e.key === "F1" || e.key === "?") {
        e.preventDefault();
        st.set("helpOpen", !st.helpOpen);
      } else if ((e.key === "f" || e.key === "F") && !ctrl && st.selection.length && st.viewMode !== "plan") {
        const sel = st.project.items.filter((i) => st.selection.includes(i.id));
        st.requestFocus(sel.reduce((a, i) => a + i.x, 0) / sel.length, sel.reduce((a, i) => a + i.y, 0) / sel.length);
      } else if (e.key === "Escape") {
        st.set("helpOpen", false);
        st.set("placing", null);
        st.select([]);
        st.selectFace(null);
      } else if (st.selection.length && (e.key === "r" || e.key === "R")) {
        st.updateItems(st.selection, (it) => void (it.rot = normAngle(it.rot + (e.shiftKey ? -15 : 15))));
      } else if (st.selection.length && (e.key === "q" || e.key === "e")) {
        st.updateItems(st.selection, (it) => void (it.rot = normAngle(it.rot + (e.key === "q" ? -1 : 1))));
      } else if (st.selection.length && e.key.startsWith("Arrow") && st.camera3d !== "walk") {
        e.preventDefault();
        const s = e.shiftKey ? 0.1 : 0.01;
        const dx = e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0;
        const dy = e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0;
        st.updateItems(st.selection.filter((id) => !st.project.items.find((i) => i.id === id)?.locked), (it) => {
          it.x += dx;
          it.y += dy;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function App() {
  useShortcuts();
  const tab = useEditor((s) => s.leftTab);
  const setTab = (t: typeof tab) => useEditor.getState().set("leftTab", t);
  const viewMode = useEditor((s) => s.viewMode);
  const toast = useEditor((s) => s.toast);
  const dirty = useEditor((s) => s.dirty);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <HelpOverlay />
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
          <div className="min-h-0 flex-1">
            {tab === "katalog" && <CatalogPanel />}
            {tab === "gestaltung" && <DesignPanel />}
            {tab === "objekte" && <ObjectsPanel />}
            {tab === "konzepte" && <ConceptsPanel />}
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
      {toast && <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-900/90 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
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
