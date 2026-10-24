import { describe, expect, it } from "vitest";
import { allCatalog, getCatalogItem, newItemFromCatalog, swappedItem, swapTargets, useEditor, withSwapPreview } from "./project";
import { footprint, localToPlan, nearestFace, pointInPolygon, toLocal } from "../model/geometry";
import { wallFaces } from "../data";

const sofas = allCatalog().filter((c) => c.category === "sofa" && c.vendor !== "Bestand");
const deep = sofas.find((c) => c.d >= 100)!;
const shallow = sofas.find((c) => c.d <= 90)!;

describe("Tauschen", () => {
  it("lässt die Rückseite an der Wand und wächst in den Raum", () => {
    // Sofa mit dem Rücken an eine Wand stellen
    const f = wallFaces.find((x) => x.wallRatio > 0.8 && Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]) > 3)!;
    const mid: [number, number] = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2];
    const rot = (Math.atan2(f.n[1], f.n[0]) * 180) / Math.PI - 90;
    const it = newItemFromCatalog(shallow, 0, mid[0] + f.n[0] * (shallow.d / 200 + 0.002), mid[1] + f.n[1] * (shallow.d / 200 + 0.002), rot);
    const n = swappedItem(it, deep, 0);
    const backOld = localToPlan(it, 0, -it.d / 2);
    const backNew = localToPlan(n, 0, -n.d / 2);
    expect(Math.hypot(backOld[0] - backNew[0], backOld[1] - backNew[1])).toBeLessThan(0.005);
    expect(nearestFace(wallFaces, backNew[0], backNew[1], 0.05)).toBeTruthy();
    expect(n.id).toBe(it.id);
  });

  it("behält bei frei stehenden Objekten den Mittelpunkt", () => {
    const it = newItemFromCatalog(shallow, 0, 4.3, 7.0, 0);
    expect(nearestFace(wallFaces, ...localToPlan(it, 0, -it.d / 2), 0.12)).toBeNull();
    const n = swappedItem(it, deep, 0);
    expect(n.x).toBeCloseTo(it.x, 6);
    expect(n.y).toBeCloseTo(it.y, 6);
  });

  it("behält Höhe von Wand- und Deckenobjekten, Notiz und Positionsnummer", () => {
    const lamps = allCatalog().filter((c) => c.category === "wallLamp");
    const it = { ...newItemFromCatalog(lamps[0], 0, 4.3, 7.0, 0), elev: 1.62, note: "über dem Sessel", pos: "W7" };
    const n = swappedItem(it, lamps[1], 0);
    expect(n.elev).toBe(1.62);
    expect(n.note).toBe("über dem Sessel");
    expect(n.pos).toBe("W7");
  });

  it("tauscht mehrere gleiche Objekte in einem Schritt und zeigt die Vorschau ohne Projektänderung", () => {
    const st = useEditor.getState();
    st.loadConcept("concept1");
    const p0 = useEditor.getState().project;
    const groups = new Map<string, string[]>();
    for (const i of p0.items) if (!i.existing && !i.locked) groups.set(i.catalogId, [...(groups.get(i.catalogId) ?? []), i.id]);
    const [cid, ids] = [...groups.entries()].find(([, v]) => v.length > 1)!;
    const c = getCatalogItem(cid)!;
    const alt = allCatalog().find((x) => x.category === c.category && x.id !== c.id && x.vendor !== "Bestand")!;
    const prev = withSwapPreview(p0.items, { ids: [ids[0]], catalogId: alt.id, variant: 0 });
    expect(prev.find((i) => i.id === ids[0])!.catalogId).toBe(alt.id);
    expect(useEditor.getState().project.items.find((i) => i.id === ids[0])!.catalogId).toBe(cid);
    const before = useEditor.getState().past.length;
    useEditor.getState().replaceItems(ids, alt.id, 0);
    const p1 = useEditor.getState().project;
    expect(ids.every((id) => p1.items.find((i) => i.id === id)!.catalogId === alt.id)).toBe(true);
    expect(useEditor.getState().past.length).toBe(before + 1);
    useEditor.getState().undo();
    expect(ids.every((id) => useEditor.getState().project.items.find((i) => i.id === id)!.catalogId === cid)).toBe(true);
  });

  it("tauscht markierte gleiche Stühle gemeinsam: gleiche Drehung, Abstand zur Tischkante, nicht seitlich verschoben", () => {
    useEditor.getState().loadConcept("concept1");
    const p0 = useEditor.getState().project;
    const chairs = p0.items.filter((i) => getCatalogItem(i.catalogId)?.category === "chair");
    const table = p0.items.find((i) => getCatalogItem(i.catalogId)?.category === "diningTable")!;
    expect(chairs.length).toBeGreaterThanOrEqual(6);
    // Mehrfachauswahl mit Tisch: nur die Stühle werden getauscht, der Tisch bleibt
    const sel = [table.id, ...chairs.map((c) => c.id)];
    const t = swapTargets(p0.items, sel)!;
    expect(t.ids.sort()).toEqual(chairs.map((c) => c.id).sort());
    expect(t.skipped).toBe(1);
    const c0 = getCatalogItem(chairs[0].catalogId)!;
    const deeper = allCatalog()
      .filter((x) => x.category === "chair" && x.vendor !== "Bestand" && x.id !== c0.id)
      .sort((a, b) => b.d - a.d)[0];
    expect(deeper.d / 100).toBeGreaterThan(chairs[0].d + 0.015);
    // Vorschau zeigt alle markierten getauscht, ohne das Projekt zu ändern
    const pv = withSwapPreview(p0.items, { ids: t.ids, catalogId: deeper.id, variant: 0 });
    expect(t.ids.every((id) => pv.find((i) => i.id === id)!.catalogId === deeper.id)).toBe(true);
    const before = useEditor.getState().past.length;
    useEditor.getState().replaceItems(t.ids, deeper.id, 0);
    const p1 = useEditor.getState().project;
    expect(useEditor.getState().past.length).toBe(before + 1);
    expect(p1.items.find((i) => i.id === table.id)).toEqual(table);
    for (const o of chairs) {
      const n = p1.items.find((i) => i.id === o.id)!;
      expect(n.catalogId).toBe(deeper.id);
      expect(n.rot).toBe(o.rot);
      // lokale Lage des neuen Stuhls im Koordinatensystem des alten
      const [lx, ly] = toLocal(o, n.x, n.y);
      expect(Math.abs(lx)).toBeLessThan(1e-6);
      const atTable = pointInPolygon(...localToPlan(o, 0, o.d / 2 + 0.3), footprint(table));
      if (atTable) {
        // Vorderkante (Sitzkante) bleibt an derselben Stelle zur Tischkante
        const fo = localToPlan(o, 0, o.d / 2);
        const fn = localToPlan(n, 0, n.d / 2);
        expect(Math.hypot(fo[0] - fn[0], fo[1] - fn[1])).toBeLessThan(1e-6);
        expect(ly).toBeLessThan(0);
      }
    }
    expect(chairs.filter((o) => pointInPolygon(...localToPlan(o, 0, o.d / 2 + 0.3), footprint(table))).length).toBeGreaterThanOrEqual(6);
    useEditor.getState().undo();
    expect(useEditor.getState().project.items.filter((i) => t.ids.includes(i.id)).every((i) => i.catalogId === c0.id)).toBe(true);
  });

  it("bevorzugt beim Tauschen die Gruppe des geöffneten Objekts und lässt Bestand/Gesperrtes aus", () => {
    useEditor.getState().loadConcept("concept1");
    const items = useEditor.getState().project.items;
    const chairs = items.filter((i) => getCatalogItem(i.catalogId)?.category === "chair");
    const table = items.find((i) => getCatalogItem(i.catalogId)?.category === "diningTable")!;
    expect(swapTargets(items, [table.id, chairs[0].id, chairs[1].id], table.id)).toEqual({ anchor: table.id, ids: [table.id], skipped: 2 });
    const locked = items.map((i) => (i.id === chairs[0].id ? { ...i, locked: true } : i));
    expect(swapTargets(locked, [chairs[0].id, chairs[1].id])!.ids).toEqual([chairs[1].id]);
    expect(swapTargets(locked, [chairs[0].id])).toBeNull();
  });

  it("übernimmt ausführungsabhängige Parameter (Frontstil) beim Platzieren", () => {
    const c = allCatalog().find((x) => x.variants.some((v) => v.params?.front === "frame"));
    if (!c) return;
    const i = c.variants.findIndex((v) => v.params?.front === "frame");
    expect(newItemFromCatalog(c, i, 0, 0).params?.front).toBe("frame");
  });
});
