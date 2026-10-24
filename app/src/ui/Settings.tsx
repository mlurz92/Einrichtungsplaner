// Einstellungen: Design, Transparenz, Animationen, Oberflächengröße, Updates, Info.
import { useEffect, useState } from "react";
import { Monitor, Moon, RotateCcw, Settings2, Sun } from "lucide-react";
import { useEditor } from "../store/project";
import { appVersion, openExternal } from "../platform";
import { Dialog, Seg } from "./kit";
import { useUi, type ThemePref } from "./prefs";
import { fetchLatestRelease, newerVersion } from "./update";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog() {
  const open = useEditor((s) => s.settingsOpen);
  const ui = useUi();
  const quality = useEditor((s) => s.quality);
  const [version, setVersion] = useState("");
  const [check, setCheck] = useState<string | null>(null);
  useEffect(() => {
    if (open) void appVersion().then(setVersion);
  }, [open]);
  const close = () => useEditor.getState().set("settingsOpen", false);
  const checkNow = async () => {
    setCheck("Suche …");
    try {
      const r = await fetchLatestRelease();
      if (!r) return setCheck("Keine Veröffentlichung gefunden");
      setCheck(newerVersion(r.version, version) ? `Neue Version ${r.version} verfügbar` : "Aktuell – keine neuere Version");
      if (newerVersion(r.version, version)) useUi.getState().setPref("dismissedUpdate", null);
    } catch {
      setCheck("Keine Verbindung zu GitHub");
    }
  };
  return (
    <Dialog open={open} onClose={close} title="Einstellungen" subtitle="Gilt für dieses Gerät, unabhängig vom Projekt" icon={<Settings2 size={18} />} width="max-w-xl">
      <div className="panel-title mt-1">Darstellung</div>
      <div className="divide-y divide-line">
        <Row label="Design" hint="„System“ folgt dem hellen bzw. dunklen Modus von Windows">
          <Seg<ThemePref>
            label="Design"
            value={ui.theme}
            onChange={(v) => ui.setPref("theme", v)}
            options={[
              { value: "system", label: <span className="flex items-center gap-1"><Monitor size={13} /> System</span> },
              { value: "light", label: <span className="flex items-center gap-1"><Sun size={13} /> Hell</span> },
              { value: "dark", label: <span className="flex items-center gap-1"><Moon size={13} /> Dunkel</span> },
            ]}
          />
        </Row>
        <Row label="Transparenzeffekte" hint="Glasflächen mit Unschärfe; aus = deckende Flächen, schneller auf schwacher Grafik">
          <input type="checkbox" className="switch" checked={ui.transparency} onChange={(e) => ui.setPref("transparency", e.target.checked)} aria-label="Transparenzeffekte" />
        </Row>
        <Row label="Animationen" hint="Weiche Übergänge bei Menüs, Dialogen und Leisten">
          <input type="checkbox" className="switch" checked={ui.motion} onChange={(e) => ui.setPref("motion", e.target.checked)} aria-label="Animationen" />
        </Row>
        <Row label="Oberflächengröße" hint="Strg + Mausrad oder Strg +/− funktionieren zusätzlich">
          <div className="flex items-center gap-2">
            <input type="range" min={80} max={150} step={5} value={ui.scale} onChange={(e) => ui.setPref("scale", Number(e.target.value))} className="w-32" aria-label="Oberflächengröße" />
            <span className="w-11 text-right text-sm tabular-nums">{ui.scale} %</span>
          </div>
        </Row>
        <Row label="3D-Darstellungsqualität" hint="„Schnell“ für Notebooks ohne eigene Grafikkarte">
          <select className="field w-40" value={quality} onChange={(e) => useEditor.getState().set("quality", e.target.value as typeof quality)}>
            <option value="hoch">Hoch</option>
            <option value="mittel">Mittel</option>
            <option value="niedrig">Schnell</option>
          </select>
        </Row>
      </div>
      <div className="panel-title mt-4">Programm</div>
      <div className="divide-y divide-line">
        <Row label="Nach Updates suchen" hint="Beim Start auf GitHub nach einer neuen Version schauen (nur Hinweis)">
          <input type="checkbox" className="switch" checked={ui.updateCheck} onChange={(e) => ui.setPref("updateCheck", e.target.checked)} aria-label="Nach Updates suchen" />
        </Row>
        <Row label={`Version ${version || "…"}`} hint={check ?? "Einrichtungsplaner WE 13"}>
          <div className="flex gap-1.5">
            <button className="btn text-xs" onClick={() => void checkNow()}>
              Jetzt prüfen
            </button>
            <button className="btn text-xs" onClick={() => void openExternal("https://github.com/mlurz92/einrichtungsplaner/releases")}>
              Versionshinweise
            </button>
          </div>
        </Row>
      </div>
      <div className="mt-4 flex justify-between">
        <button className="btn-ghost text-xs" onClick={() => ui.reset()} title="Design, Leisten und Größe zurücksetzen (Merkliste bleibt)">
          <RotateCcw size={13} /> Zurücksetzen
        </button>
        <button className="btn-primary" onClick={close}>
          Fertig
        </button>
      </div>
    </Dialog>
  );
}
