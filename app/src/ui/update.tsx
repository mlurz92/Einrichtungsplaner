// Hinweis auf neue Programmversionen (GitHub-Releases); nur Hinweis, kein automatischer Download.
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { appVersion, openExternal } from "../platform";
import { useUi } from "./prefs";

const RELEASES = "https://api.github.com/repos/mlurz92/einrichtungsplaner/releases/latest";

/** Versionsvergleich „1.10.0“ > „1.9.2“; Präfix „v“ und Zusätze (-beta) werden ignoriert. */
export function newerVersion(latest: string, current: string): boolean {
  const p = (v: string) => v.replace(/^v/i, "").split(/[-+]/)[0].split(".").map((n) => Number(n) || 0);
  const a = p(latest);
  const b = p(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export interface ReleaseInfo {
  version: string;
  url: string;
  name: string;
}

export async function fetchLatestRelease(signal?: AbortSignal): Promise<ReleaseInfo | null> {
  const r = await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" }, signal });
  if (!r.ok) return null;
  const j = (await r.json()) as { tag_name?: string; html_url?: string; name?: string };
  if (!j.tag_name || !j.html_url?.startsWith("https://github.com/")) return null;
  return { version: j.tag_name.replace(/^v/i, ""), url: j.html_url, name: j.name || j.tag_name };
}

export function UpdateBanner() {
  const enabled = useUi((s) => s.updateCheck);
  const dismissed = useUi((s) => s.dismissedUpdate);
  const [rel, setRel] = useState<ReleaseInfo | null>(null);
  useEffect(() => {
    if (!enabled || import.meta.env.DEV) return;
    const ac = new AbortController();
    // etwas verzögert, damit der Start nicht gebremst wird
    const t = setTimeout(async () => {
      try {
        const [latest, cur] = await Promise.all([fetchLatestRelease(ac.signal), appVersion()]);
        if (latest && newerVersion(latest.version, cur)) setRel(latest);
      } catch {
        /* offline: kein Hinweis */
      }
    }, 4000);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [enabled]);
  if (!rel || dismissed === rel.version) return null;
  return (
    <div role="status" className="glass-strong grain slide-up fixed right-4 bottom-10 z-[110] flex w-80 items-start gap-3 rounded-xl p-3.5 text-sm">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
        <Download size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Version {rel.version} verfügbar</div>
        <div className="mt-0.5 text-xs text-stone-500">Installationsprogramm auf GitHub herunterladen und ausführen – Projekte bleiben erhalten.</div>
        <button className="btn-primary mt-2 px-2.5 py-1 text-xs" onClick={() => void openExternal(rel.url)}>
          Zur Download-Seite
        </button>
      </div>
      <button className="btn-ghost -mt-1 -mr-1 h-7 w-7 p-0" title="Hinweis für diese Version ausblenden" onClick={() => useUi.getState().setPref("dismissedUpdate", rel.version)}>
        <X size={14} />
      </button>
    </div>
  );
}
