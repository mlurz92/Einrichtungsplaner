import { targetPane } from "./layout";
import { useEditor, budgetSummary } from "../store/project";
import type { CatalogItem, Project } from "../model/types";
import { dataUrlToBytes, openBinary, openText, readTextPath, saveBinary, saveText } from "../platform";
import { roomNames } from "../data";
import { addRecent, fileName, removeRecent } from "./recent";

const PROJ = [{ name: "Einrichtungsprojekt", extensions: ["we13", "json"] }];

function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (/denied|forbidden|not allowed|access/i.test(m)) return "Zugriff verweigert (Datei schreibgeschützt oder in einem geschützten Ordner?)";
  if (/not found|no such file|cannot find|os error 2|os error 3/i.test(m)) return "Datei oder Ordner nicht gefunden";
  if (/used by another process|os error 32/i.test(m)) return "Datei wird von einem anderen Programm verwendet";
  return m || "unbekannter Fehler";
}

/** Speichern; liefert true bei Erfolg (false bei Abbruch oder Fehler). */
export async function saveProject(as = false): Promise<boolean> {
  const st = useEditor.getState();
  const p = { ...st.project, updatedAt: new Date().toISOString() };
  const name = `${p.name.replace(/[^\wäöüÄÖÜß -]+/g, "").trim() || "Projekt"}.we13`;
  try {
    const path = await saveText(JSON.stringify(p, null, 1), name, PROJ, as ? null : st.filePath);
    if (!path) return false;
    useEditor.setState({ filePath: path, dirty: false });
    addRecent(path, p.name);
    st.showToast(`Gespeichert: ${fileName(path)}`);
    return true;
  } catch (e) {
    st.showToast(`Speichern fehlgeschlagen: ${errText(e)}`, { kind: "error", action: { label: "Speichern unter …", run: () => void saveProject(true) } });
    return false;
  }
}

/** Projekt aus Dateiinhalt laden (Öffnen, Doppelklick auf .we13, Ziehen ins Fenster). */
export function loadProjectText(content: string, path: string) {
  const st = useEditor.getState();
  let p: Project;
  try {
    p = JSON.parse(content) as Project;
  } catch {
    throw new Error("keine gültige Projektdatei (JSON fehlerhaft)");
  }
  if (!p || typeof p !== "object" || !Array.isArray(p.items)) throw new Error("keine Projektdatei des Einrichtungsplaners");
  if (p.version !== 1) throw new Error(`Dateiversion ${p.version ?? "?"} wird nicht unterstützt`);
  const wasDirty = st.dirty;
  st.setProject(p, { keepHistory: true, filePath: path, label: `${p.name} öffnen` });
  addRecent(path, p.name);
  st.set("startOpen", false);
  st.showToast(`Geöffnet: ${p.name}`, wasDirty ? { action: { label: "Rückgängig", run: () => useEditor.getState().undo() } } : undefined);
}

export async function openProject() {
  try {
    const f = await openText(PROJ);
    if (!f) return;
    loadProjectText(f.content, f.name);
  } catch (e) {
    useEditor.getState().showToast(`Datei konnte nicht geöffnet werden: ${errText(e)}`, { kind: "error" });
  }
}

/** Datei aus „Zuletzt verwendet“ öffnen. */
export async function openRecent(path: string) {
  try {
    loadProjectText(await readTextPath(path), path);
  } catch (e) {
    const msg = errText(e);
    if (msg.startsWith("Datei oder Ordner nicht gefunden")) removeRecent(path);
    useEditor.getState().showToast(`${fileName(path)} konnte nicht geöffnet werden: ${msg}`, { kind: "error" });
  }
}

/** Bild der 3D-Ansicht `pane` (Standard: aktives bzw. erstes sichtbares 3D-Fenster). */
export async function exportScreenshot(pane: number | null = targetPane("3d")) {
  const canvas = pane == null ? null : document.querySelector<HTMLCanvasElement>(`[data-pane="${pane}"] canvas`);
  if (!canvas) {
    useEditor.getState().showToast("Keine 3D-Ansicht sichtbar – ein Fenster auf 3D stellen");
    return;
  }
  const url = canvas.toDataURL("image/png");
  await exportFile(() => saveBinary(dataUrlToBytes(url), "WE13_Ansicht.png", [{ name: "PNG", extensions: ["png"] }]));
}

/**
 * Grundriss-SVG für den Export vorbereiten: Designvariablen werden mit den Werten des hellen Designs
 * fest eingesetzt (druckt sich unabhängig vom aktuellen Design), Bedienelemente entfernt.
 */
function planForExport(): { svg: SVGSVGElement; w: number; h: number } | null {
  const pane = targetPane("plan");
  const src = pane == null ? null : document.querySelector<SVGSVGElement>(`[data-pane="${pane}"] svg[data-plan]`);
  if (!src) {
    useEditor.getState().showToast("Kein 2D-Plan sichtbar – ein Fenster auf 2D-Plan stellen");
    return null;
  }
  const root = document.documentElement;
  const theme = root.dataset.theme;
  root.dataset.theme = "light";
  const cs = getComputedStyle(root);
  const resolve = (v: string) => v.replace(/var\((--[\w-]+)\)/g, (_, n: string) => cs.getPropertyValue(n).trim() || "#000");
  const clone = src.cloneNode(true) as SVGSVGElement;
  for (const el of [clone, ...clone.querySelectorAll("*")]) {
    for (const a of [...el.attributes]) if (a.value.includes("var(")) el.setAttribute(a.name, resolve(a.value));
  }
  root.dataset.theme = theme;
  clone.querySelectorAll("[data-noexport]").forEach((n) => n.remove());
  const r = src.getBoundingClientRect();
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.round(r.width)));
  clone.setAttribute("height", String(Math.round(r.height)));
  clone.style.background = resolve("var(--plan-bg)");
  return { svg: clone, w: r.width, h: r.height };
}

export async function exportPlanSvg() {
  const p = planForExport();
  if (!p) return;
  await exportFile(() => saveText(new XMLSerializer().serializeToString(p.svg), "WE13_Grundriss.svg", [{ name: "SVG", extensions: ["svg"] }]));
}

/** Grundriss als hochaufgelöstes Bild (dreifache Bildschirmauflösung). */
export async function exportPlanPng() {
  const p = planForExport();
  if (!p) return;
  const scale = 3;
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(p.svg)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Grundriss konnte nicht gerendert werden"));
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = Math.round(p.w * scale);
    c.height = Math.round(p.h * scale);
    const g = c.getContext("2d")!;
    g.fillStyle = p.svg.style.background || "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    await exportFile(() => saveBinary(dataUrlToBytes(c.toDataURL("image/png")), "WE13_Grundriss.png", [{ name: "PNG", extensions: ["png"] }]));
  } catch (e) {
    useEditor.getState().showToast(`Export fehlgeschlagen: ${errText(e)}`, { kind: "error" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function exportFile(run: () => Promise<string | null>) {
  try {
    const path = await run();
    if (path) useEditor.getState().showToast(`Exportiert: ${fileName(path)}`);
  } catch (e) {
    useEditor.getState().showToast(`Export fehlgeschlagen: ${errText(e)}`, { kind: "error" });
  }
}

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportShoppingList() {
  const p = useEditor.getState().project;
  const b = budgetSummary(p);
  const rows = [["Pos.", "Raum", "Produkt", "Händler", "Anzahl", "Einzelpreis €", "Summe €", "Status", "Link"]];
  for (const l of b.lines) rows.push([l.pos ?? "", roomNames[l.room] ?? l.room, l.name, l.vendor, String(+l.qty.toFixed(2)).replace(".", ","), l.unit.toFixed(2).replace(".", ","), l.total.toFixed(2).replace(".", ","), l.status, l.url ?? ""]);
  rows.push(["", "", "Gesamt", "", "", "", b.total.toFixed(2).replace(".", ","), "", ""]);
  rows.push(["", "", "davon noch offen (geplant)", "", "", "", b.byStatus.geplant.toFixed(2).replace(".", ","), "", ""]);
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  await exportFile(() => saveText(csv, "WE13_Einkaufsliste.csv", [{ name: "CSV (Excel)", extensions: ["csv"] }]));
}

export function printBudget() {
  const p = useEditor.getState().project;
  const b = budgetSummary(p);
  const w = window.open("", "_blank");
  if (!w) return;
  const eur = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const byRoom = new Map<string, typeof b.lines>();
  for (const l of b.lines) {
    const k = roomNames[l.room] ?? l.room;
    byRoom.set(k, [...(byRoom.get(k) ?? []), l]);
  }
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${p.name} – Einkaufsliste</title>
  <style>body{font:12px/1.4 "Segoe UI",system-ui;margin:24px;color:#222}h1{font-size:20px;margin:0}h2{font-size:13px;margin:18px 0 4px;text-transform:uppercase;letter-spacing:.06em;color:#555}
  table{width:100%;border-collapse:collapse}td,th{padding:3px 6px;border-bottom:1px solid #e5e2dc;text-align:left}td.n{text-align:right;white-space:nowrap}th{font-size:11px;color:#666}
  .tot{font-weight:700;font-size:14px;margin-top:16px}</style></head><body>
  <h1>${p.name}</h1><div>${p.subtitle ?? ""}</div><div>Stand ${new Date().toLocaleDateString("de-DE")} · Preise inkl. MwSt. laut Händlerangaben</div>
  ${[...byRoom.entries()].map(([room, ls]) => `<h2>${room}</h2><table><tr><th>Pos.</th><th>Produkt</th><th>Händler</th><th>Anz.</th><th>Einzel</th><th>Summe</th><th>Status</th></tr>${ls.map((l) => `<tr><td>${l.pos ?? ""}</td><td>${l.name}</td><td>${l.vendor}</td><td class="n">${+l.qty.toFixed(2)}</td><td class="n">${eur(l.unit)}</td><td class="n">${eur(l.total)}</td><td>${l.status === "geplant" ? "☐" : "☑ " + l.status}</td></tr>`).join("")}</table>`).join("")}
  <div class="tot">Gesamt: ${eur(b.total)} · davon offen: ${eur(b.byStatus.geplant)}</div><script>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}

/** Eigenes 3D-Modell (GLB/GLTF) importieren und als Katalogeintrag anlegen. */
export async function importGlb() {
  let f: Awaited<ReturnType<typeof openBinary>>;
  try {
    f = await openBinary([{ name: "3D-Modell (glTF-Binär)", extensions: ["glb"] }]);
  } catch (e) {
    useEditor.getState().showToast(`Modell konnte nicht gelesen werden: ${errText(e)}`, { kind: "error" });
    return;
  }
  if (!f) return;
  let bin = "";
  for (let i = 0; i < f.data.length; i += 0x8000) bin += String.fromCharCode(...f.data.subarray(i, i + 0x8000));
  const url = `data:model/gltf-binary;base64,${btoa(bin)}`;
  const name = f.name.replace(/\.glb$/i, "");
  const w = Number(prompt("Breite in cm", "80") ?? 80) || 80;
  const d = Number(prompt("Tiefe in cm", "80") ?? 80) || 80;
  const h = Number(prompt("Höhe in cm", "80") ?? 80) || 80;
  const item: CatalogItem = {
    id: `custom-${Date.now().toString(36)}`,
    vendor: "Fachhandel",
    name: `Eigenes Modell: ${name}`,
    category: "decor",
    w,
    d,
    h,
    price: 0,
    archetype: "glb",
    model: url,
    mount: "floor",
    variants: [{ name: "Original", slots: {} }],
    tags: ["Import"],
  };
  useEditor.getState().addCustomCatalog(item);
  useEditor.getState().set("placing", { catalogId: item.id, variant: 0 });
  useEditor.getState().showToast("Modell importiert – zum Platzieren in den Plan klicken");
}
