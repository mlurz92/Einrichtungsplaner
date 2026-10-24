import { ArrowRight, Clock, FilePlus, FolderOpen, X } from "lucide-react";
import { concepts } from "../data";
import { budgetSummary, restoredFromAutosave, useEditor } from "../store/project";
import { fmtEuro } from "../model/geometry";
import { openProject, openRecent } from "./fileops";
import { fileName, useRecentFiles } from "./recent";

const TIPS: [string, string][] = [
  ["Strg+K", "Befehl, Raum, Objekt oder Produkt suchen – Enter führt aus bzw. platziert"],
  ["Ziehen aus dem Katalog", "Möbel landen mit Rückseite an der Wand, Ecken und Ablagen fangen automatisch"],
  ["Strg+Z", "jeder Schritt ist benannt und rückgängig zu machen – auch Konzept laden oder Löschen"],
  ["1 / 2 / 3", "nur Plan · Plan und 3D · nur 3D"],
];

/** Startseite: beim ersten Start und über Datei → Startseite. */
export function StartScreen() {
  const open = useEditor((s) => s.startOpen);
  const project = useEditor((s) => s.project);
  const recent = useRecentFiles();
  if (!open) return null;
  const st = useEditor.getState();
  const close = () => st.set("startOpen", false);
  const hasWork = restoredFromAutosave || st.past.length > 0 || st.dirty || !!st.filePath;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4" onClick={close}>
      <div className="max-h-full w-full max-w-4xl overflow-auto rounded-2xl bg-[#faf8f5] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-stone-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="h-11 w-11" draggable={false} />
            <div>
              <h2 className="text-lg font-semibold">Einrichtungsplaner WE 13</h2>
              <p className="text-sm text-stone-600">Womit möchtest du beginnen?</p>
            </div>
          </div>
          <button className="btn-ghost" onClick={close} title="Schließen (Esc)">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            {hasWork && (
              <button className="flex w-full items-center gap-3 rounded-xl border border-emerald-800/30 bg-white p-3 text-left shadow-sm hover:border-emerald-800" onClick={close}>
                <ArrowRight size={18} className="text-emerald-800" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-emerald-900">Weiterarbeiten: {project.name}</div>
                  <div className="truncate text-xs text-stone-500">{st.filePath ? fileName(st.filePath) : "letzter Stand (automatisch gesichert)"}</div>
                </div>
              </button>
            )}
            <div className="panel-title">Mit einem Konzept beginnen</div>
            <div className="grid grid-cols-2 gap-2">
              {concepts.map((c) => (
                <button
                  key={c.id}
                  className="overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-sm transition hover:border-emerald-800 hover:shadow"
                  onClick={() => {
                    st.loadConcept(c.id);
                    close();
                  }}
                >
                  <span className="flex h-6">
                    {c.palette.map((p) => (
                      <span key={p} className="flex-1" style={{ background: p }} />
                    ))}
                  </span>
                  <span className="block p-2.5">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">{c.subtitle}</span>
                    <span className="block text-sm font-semibold">{c.title}</span>
                    <span className="block text-xs text-stone-500">{fmtEuro(budgetSummary(c.project).total)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="flex items-center gap-2 rounded-xl border-2 border-dashed border-emerald-800/40 bg-white p-3 text-left hover:border-emerald-800"
                onClick={() => {
                  close();
                  st.set("newDialogOpen", true);
                }}
              >
                <FilePlus size={18} className="shrink-0 text-emerald-800" />
                <span>
                  <span className="block text-sm font-semibold text-emerald-900">Leere Wohnung</span>
                  <span className="block text-xs text-stone-600">von Grund auf einrichten</span>
                </span>
              </button>
              <button className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-3 text-left hover:border-stone-400" onClick={() => void openProject()}>
                <FolderOpen size={18} className="shrink-0 text-stone-600" />
                <span>
                  <span className="block text-sm font-semibold">Datei öffnen …</span>
                  <span className="block text-xs text-stone-600">Projektdatei .we13</span>
                </span>
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {recent.length > 0 && (
              <div>
                <div className="panel-title mb-1.5">Zuletzt verwendet</div>
                <div className="space-y-0.5">
                  {recent.map((r) => (
                    <button key={r.path} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white" title={r.path} onClick={() => void openRecent(r.path)}>
                      <Clock size={13} className="shrink-0 text-stone-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{r.name || fileName(r.path)}</span>
                        <span className="block truncate text-[11px] text-stone-500">{fileName(r.path)} · {new Date(r.at).toLocaleDateString("de-DE")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="panel-title mb-1.5">Schnell zum Ziel</div>
              <table className="w-full text-xs">
                <tbody>
                  {TIPS.map(([k, v]) => (
                    <tr key={k} className="border-t border-stone-200/70">
                      <td className="whitespace-nowrap py-1.5 pr-3 align-top font-semibold text-stone-800">{k}</td>
                      <td className="py-1.5 text-stone-600">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="mt-2 text-xs font-medium text-emerald-800 hover:underline" onClick={() => st.set("helpOpen", true)}>
                Alle Tastenkürzel (F1)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
