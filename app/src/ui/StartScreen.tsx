import { ArrowRight, Clock, FilePlus, FolderOpen, X } from "lucide-react";
import { Dialog } from "./kit";
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
  const st = useEditor.getState();
  const close = () => st.set("startOpen", false);
  const hasWork = restoredFromAutosave || st.past.length > 0 || st.dirty || !!st.filePath;
  return (
    <Dialog open={open} onClose={close} bare width="max-w-4xl">
      <div>
        <div className="relative flex items-start justify-between overflow-hidden border-b border-line px-6 py-6">
          <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(600px 200px at 0% 0%, var(--ui-accent-soft), transparent 70%), radial-gradient(500px 220px at 100% 0%, rgb(200 140 90 / 0.14), transparent 70%)" }} />
          <div className="relative flex items-center gap-4">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="h-14 w-14 drop-shadow-md" draggable={false} />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Einrichtungsplaner WE 13</h2>
              <p className="text-sm text-stone-600">Womit möchtest du beginnen?</p>
            </div>
          </div>
          <button data-close className="btn-ghost relative h-8 w-8 p-0" onClick={close} title="Schließen (Esc)">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            {hasWork && (
              <button className="flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft p-3 text-left shadow-sm transition hover:border-accent hover:shadow" data-autofocus onClick={close}>
                <ArrowRight size={18} className="text-accent-ink" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-accent-ink">Weiterarbeiten: {project.name}</div>
                  <div className="truncate text-xs text-stone-500">{st.filePath ? fileName(st.filePath) : "letzter Stand (automatisch gesichert)"}</div>
                </div>
              </button>
            )}
            <div className="panel-title">Mit einem Konzept beginnen</div>
            <div className="grid grid-cols-2 gap-2">
              {concepts.map((c) => (
                <button
                  key={c.id}
                  className="group overflow-hidden rounded-xl border border-line bg-card text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
                  onClick={() => {
                    st.loadConcept(c.id);
                    close();
                  }}
                >
                  <span className="flex h-10 transition-[height] duration-300 group-hover:h-12">
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
                className="flex items-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-card/60 p-3 text-left transition hover:border-accent hover:bg-card"
                onClick={() => {
                  close();
                  st.set("newDialogOpen", true);
                }}
              >
                <FilePlus size={18} className="shrink-0 text-accent-ink" />
                <span>
                  <span className="block text-sm font-semibold text-accent-ink">Leere Wohnung</span>
                  <span className="block text-xs text-stone-600">von Grund auf einrichten</span>
                </span>
              </button>
              <button className="flex items-center gap-2 rounded-xl border border-line bg-card p-3 text-left transition hover:border-stone-400 hover:shadow" onClick={() => void openProject()}>
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
                    <button key={r.path} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-stone-500/10" title={r.path} onClick={() => void openRecent(r.path)}>
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
                    <tr key={k} className="border-t border-line">
                      <td className="whitespace-nowrap py-1.5 pr-3 align-top font-semibold text-stone-800">{k}</td>
                      <td className="py-1.5 text-stone-600">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="mt-2 text-xs font-medium text-accent-ink hover:underline" onClick={() => st.set("helpOpen", true)}>
                Alle Tastenkürzel (F1)
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
