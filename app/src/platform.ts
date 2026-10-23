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
