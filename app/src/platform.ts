// Plattformschicht: Tauri (Windows-Desktop) bzw. Browser-Fallback.

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function openExternal(url: string) {
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else window.open(url, "_blank", "noopener");
}

export async function saveText(content: string, defaultName: string, filters: { name: string; extensions: string[] }[], path?: string | null): Promise<string | null> {
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const target = path ?? (await save({ defaultPath: defaultName, filters }));
    if (!target) return null;
    await writeTextFile(target, content);
    return target;
  }
  downloadBlob(new Blob([content], { type: "application/octet-stream" }), defaultName);
  return defaultName;
}

export async function saveBinary(data: Uint8Array, defaultName: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const target = await save({ defaultPath: defaultName, filters });
    if (!target) return null;
    await writeFile(target, data);
    return target;
  }
  downloadBlob(new Blob([data as BlobPart]), defaultName);
  return defaultName;
}

export async function openText(filters: { name: string; extensions: string[] }[]): Promise<{ name: string; content: string } | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const p = await open({ multiple: false, filters });
    if (!p || Array.isArray(p)) return null;
    return { name: p, content: await readTextFile(p) };
  }
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      resolve({ name: f.name, content: await f.text() });
    };
    inp.click();
  });
}

/** Datei über einen bekannten Pfad lesen (nur Desktop, z. B. „Zuletzt verwendet“). */
export async function readTextPath(path: string): Promise<string> {
  if (!isTauri) throw new Error("Nur in der Desktop-App verfügbar");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  return readTextFile(path);
}

/** Fenstertitel setzen (Desktop: Fensterleiste, Browser: Tab). */
export async function setWindowTitle(title: string) {
  document.title = title;
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTitle(title);
  } catch {
    /* ohne Berechtigung bleibt der Standardtitel */
  }
}

/**
 * Schließen des Fensters abfangen (Desktop). `onClose` liefert true, wenn sofort geschlossen werden darf;
 * sonst entscheidet die App später und ruft `closeWindowNow()` auf.
 */
export async function interceptWindowClose(onClose: () => boolean): Promise<() => void> {
  if (!isTauri) return () => {};
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().onCloseRequested((ev) => {
    if (!onClose()) ev.preventDefault();
  });
}

export async function closeWindowNow() {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().destroy();
}

export async function openBinary(filters: { name: string; extensions: string[] }[]): Promise<{ name: string; data: Uint8Array } | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const p = await open({ multiple: false, filters });
    if (!p || Array.isArray(p)) return null;
    return { name: p.split(/[\\/]/).pop() ?? p, data: await readFile(p) };
  }
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      resolve({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) });
    };
    inp.click();
  });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function dataUrlToBytes(url: string): Uint8Array {
  const b64 = url.split(",")[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Fenster-Titelleiste und Mica an das Farbschema anpassen (null = wie Windows). */
export async function applyNativeTheme(theme: "light" | "dark" | null) {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTheme(theme);
  } catch {
    /* ältere Systeme: Standard */
  }
}

/** Systemhintergrund des Fensters: "mica" unter Windows 11, sonst null (eigener Verlauf). */
export async function nativeBackdrop(): Promise<"mica" | null> {
  if (!isTauri) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke<string | null>("backdrop_kind")) === "mica" ? "mica" : null;
  } catch {
    return null;
  }
}

/** Oberflächengröße (Desktop: WebView-Zoom, Browser: CSS-Zoom). */
export async function setUiZoom(f: number) {
  if (isTauri) {
    try {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      await getCurrentWebview().setZoom(f);
      return;
    } catch {
      /* Fallback unten */
    }
  }
  (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = f === 1 ? "" : String(f);
}

/** Beim Start übergebene Projektdatei (Doppelklick auf .we13 im Explorer). */
export async function takeStartupFile(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke<string | null>("startup_file")) ?? null;
  } catch {
    return null;
  }
}

/** Projektdateien, die eine zweite App-Instanz weiterreicht (Doppelklick bei laufender App). */
export async function onOpenFileRequest(cb: (path: string) => void): Promise<() => void> {
  if (!isTauri) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string>("open-file", (e) => cb(e.payload));
}

/** Vollbild (F11) umschalten. */
export async function toggleFullscreen() {
  if (isTauri) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    await w.setFullscreen(!(await w.isFullscreen()));
    return;
  }
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

/** App-Version (Desktop: aus tauri.conf.json, Browser: aus package.json). */
export async function appVersion(): Promise<string> {
  if (isTauri) {
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      return await getVersion();
    } catch {
      /* Fallback */
    }
  }
  return __APP_VERSION__;
}
