import { useEditor, budgetSummary } from "../store/project";
import type { CatalogItem, Project } from "../model/types";
import { dataUrlToBytes, openBinary, openText, saveBinary, saveText } from "../platform";
import { roomNames } from "../data";

const PROJ = [{ name: "Einrichtungsprojekt", extensions: ["we13", "json"] }];

export async function saveProject(as = false) {
  const st = useEditor.getState();
  const p = { ...st.project, updatedAt: new Date().toISOString() };
  const name = `${p.name.replace(/[^\wäöüÄÖÜß -]+/g, "").trim() || "Projekt"}.we13`;
  const path = await saveText(JSON.stringify(p, null, 1), name, PROJ, as ? null : st.filePath);
  if (path) {
    useEditor.setState({ filePath: path, dirty: false });
    st.showToast(`Gespeichert: ${path.split(/[\\/]/).pop()}`);
  }
}

export async function openProject() {
  const f = await openText(PROJ);
  if (!f) return;
  try {
    const p = JSON.parse(f.content) as Project;
    if (p.version !== 1 || !Array.isArray(p.items)) throw new Error("Unbekanntes Format");
    useEditor.getState().setProject(p, { keepHistory: true, filePath: f.name });
    useEditor.getState().showToast(`Geöffnet: ${p.name}`);
  } catch (e) {
    useEditor.getState().showToast(`Datei konnte nicht gelesen werden: ${(e as Error).message}`);
  }
}

export async function exportScreenshot() {
  const canvas = document.querySelector<HTMLCanvasElement>("#viewport3d canvas");
  if (!canvas) {
    useEditor.getState().showToast("3D-Ansicht ist nicht geöffnet");
    return;
  }
  const url = canvas.toDataURL("image/png");
  await saveBinary(dataUrlToBytes(url), "WE13_Ansicht.png", [{ name: "PNG", extensions: ["png"] }]);
}

export async function exportPlanSvg() {
  const svg = document.querySelector<SVGSVGElement>("#viewport2d svg");
  if (!svg) {
    useEditor.getState().showToast("2D-Plan ist nicht geöffnet");
    return;
  }
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  await saveText(new XMLSerializer().serializeToString(clone), "WE13_Grundriss.svg", [{ name: "SVG", extensions: ["svg"] }]);
}

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportShoppingList() {
  const p = useEditor.getState().project;
  const b = budgetSummary(p);
  const rows = [["Pos.", "Raum", "Produkt", "Händler", "Anzahl", "Einzelpreis €", "Summe €", "Link"]];
  for (const l of b.lines) rows.push([l.pos ?? "", roomNames[l.room] ?? l.room, l.name, l.vendor, String(+l.qty.toFixed(2)).replace(".", ","), l.unit.toFixed(2).replace(".", ","), l.total.toFixed(2).replace(".", ","), l.url ?? ""]);
  rows.push(["", "", "Gesamt", "", "", "", b.total.toFixed(2).replace(".", ","), ""]);
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  await saveText(csv, "WE13_Einkaufsliste.csv", [{ name: "CSV (Excel)", extensions: ["csv"] }]);
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
  ${[...byRoom.entries()].map(([room, ls]) => `<h2>${room}</h2><table><tr><th>Pos.</th><th>Produkt</th><th>Händler</th><th>Anz.</th><th>Einzel</th><th>Summe</th></tr>${ls.map((l) => `<tr><td>${l.pos ?? ""}</td><td>${l.name}</td><td>${l.vendor}</td><td class="n">${+l.qty.toFixed(2)}</td><td class="n">${eur(l.unit)}</td><td class="n">${eur(l.total)}</td></tr>`).join("")}</table>`).join("")}
  <div class="tot">Gesamt: ${eur(b.total)}</div><script>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}

/** Eigenes 3D-Modell (GLB/GLTF) importieren und als Katalogeintrag anlegen. */
export async function importGlb() {
  const f = await openBinary([{ name: "3D-Modell (glTF-Binär)", extensions: ["glb"] }]);
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
