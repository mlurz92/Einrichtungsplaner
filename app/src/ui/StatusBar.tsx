import { useEffect, useState } from "react";
import { AlertTriangle, Check, CircleDot, X } from "lucide-react";
import { getCatalogItem, lastAutosave, pauseToast, useEditor } from "../store/project";
import { Dialog } from "./kit";
import { targetPane, useLayout } from "./layout";
import { closeWindowNow } from "../platform";
import { saveProject } from "./fileops";
import { fileName } from "./recent";

/** Hinweis passend zur aktuellen Tätigkeit. */
function useContextHint(): string {
  const placing = useEditor((s) => s.placing);
  const selection = useEditor((s) => s.selection);
  const walking = useLayout((s) => {
    const t = targetPane("3d", s);
    return t != null && s.panes[t].camera === "walk";
  });
  const face = useEditor((s) => s.selectedFace);
  const items = useEditor((s) => s.project.items);
  if (placing) {
    const c = getCatalogItem(placing.catalogId);
    return `${c?.name ?? "Objekt"} platzieren: in Plan oder 3D klicken · Umschalt+Klick: mehrere · Esc: abbrechen`;
  }
  if (walking) return "Rundgang: in die Ansicht klicken · Maus = umsehen · W A S D = gehen · Umschalt = schneller · Esc = Maus freigeben";
  if (selection.length === 1) {
    const it = items.find((i) => i.id === selection[0]);
    if (it?.locked) return `${it.label ?? "Objekt"} ist gesperrt · L: entsperren`;
    return "Ziehen: verschieben (Alt ohne Fang) · Pfeile: 1 cm (Umschalt 10 cm) · R/Q/E: drehen · Strg+C/V: kopieren · Entf: löschen · L: sperren";
  }
  if (selection.length > 1) return `${selection.length} Objekte · gemeinsam ziehen, ausrichten (rechts) · T: gleiche tauschen · Strg+D: duplizieren · Entf: löschen`;
  if (face) return "Wand gewählt: rechts Farbe, Tapete oder Paneele festlegen";
  return "Strg+K: Befehl oder Produkt suchen · Katalog in Plan/3D ziehen · Umschalt+Ziehen: Auswahlrahmen · F1: Hilfe";
}

function SaveState() {
  const dirty = useEditor((s) => s.dirty);
  const filePath = useEditor((s) => s.filePath);
  const project = useEditor((s) => s.project);
  const [, tick] = useState(0);
  // Autosave-Zeitpunkt aktualisieren (läuft entprellt nach Änderungen)
  useEffect(() => {
    const t = setTimeout(() => tick((n) => n + 1), 1000);
    return () => clearTimeout(t);
  }, [project]);
  const file = filePath ? fileName(filePath) : null;
  const auto = lastAutosave ? ` · gesichert ${lastAutosave.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "";
  if (!dirty)
    return (
      <span className="flex items-center gap-1 text-stone-500" title={filePath ?? undefined}>
        <Check size={12} className="text-accent-ink" /> {file ? `Gespeichert in ${file}` : "Keine ungespeicherten Änderungen"}
      </span>
    );
  return (
    <button className="flex items-center gap-1 text-amber-800 hover:underline" title={`${filePath ?? "Noch keine Projektdatei"} – Strg+S speichert`} onClick={() => void saveProject(false)}>
      <CircleDot size={12} /> {file ? `Ungespeichert (${file})` : "Noch nicht als Datei gespeichert"}
      <span className="text-stone-500">{auto}</span>
    </button>
  );
}

export function StatusBar() {
  const hint = useContextHint();
  const undoLabel = useEditor((s) => s.pastLabels[s.pastLabels.length - 1]);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 px-2 text-[11px] text-stone-600">
      <span className="min-w-0 flex-1 truncate">{hint}</span>
      {undoLabel && <span className="hidden truncate text-stone-500 xl:inline">Letzter Schritt: {undoLabel}</span>}
      <SaveState />
    </footer>
  );
}

export function ToastView() {
  const toast = useEditor((s) => s.toast);
  if (!toast) return null;
  const err = toast.kind === "error";
  return (
    <div
      key={toast.id}
      role={err ? "alert" : "status"}
      onPointerEnter={() => pauseToast(true)}
      onPointerLeave={() => pauseToast(false)}
      className={`toast slide-up fixed bottom-12 left-1/2 z-[120] flex max-w-[min(80vw,720px)] -translate-x-1/2 items-center gap-3 overflow-hidden rounded-xl py-2.5 pr-2 pl-3.5 text-sm ${err ? "toast-error" : ""}`}
    >
      {err ? <AlertTriangle size={16} className="shrink-0" /> : <Check size={15} className="shrink-0 opacity-80" />}
      <span className="min-w-0">{toast.msg}</span>
      {toast.action && (
        <button
          className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/25"
          onClick={() => {
            useEditor.getState().set("toast", null);
            toast.action!.run();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-60 transition hover:bg-white/15 hover:opacity-100" title="Schließen" onClick={() => useEditor.getState().set("toast", null)}>
        <X size={13} />
      </button>
      <span className="toast-progress absolute inset-x-0 bottom-0 h-0.5 origin-left" style={{ animationDuration: `${toast.duration}ms` }} />
    </div>
  );
}

/** Abfrage beim Schließen des Fensters mit ungespeicherten Änderungen (Desktop). */
export function CloseDialog() {
  const open = useEditor((s) => s.closeAsk);
  const filePath = useEditor((s) => s.filePath);
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const cancel = () => useEditor.getState().set("closeAsk", false);
  return (
    <Dialog
      open
      onClose={busy ? undefined : cancel}
      z="z-[130]"
      title="Änderungen speichern?"
      icon={<AlertTriangle size={18} />}
      width="max-w-md"
      footer={
        <>
          <button className="btn" onClick={cancel} disabled={busy}>
            Abbrechen
          </button>
          <button className="btn" onClick={() => void closeWindowNow()} disabled={busy}>
            Nicht speichern
          </button>
          <button
            className="btn-primary"
            data-autofocus
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await saveProject(false);
              setBusy(false);
              if (ok) await closeWindowNow();
            }}
          >
            Speichern und beenden
          </button>
        </>
      }
    >
      <p className="text-sm text-stone-600">
        {filePath ? `„${fileName(filePath)}“ hat ungespeicherte Änderungen.` : "Das Projekt wurde noch nicht als Datei gespeichert."} Der letzte Stand bleibt zusätzlich als automatische Sicherung erhalten und wird beim nächsten Start wiederhergestellt.
      </p>
    </Dialog>
  );
}
