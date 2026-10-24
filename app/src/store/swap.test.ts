import { describe, expect, it } from "vitest";
import { allCatalog, getCatalogItem, newItemFromCatalog, swappedItem, useEditor, withSwapPreview } from "./project";
import { localToPlan, nearestFace } from "../model/geometry";
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
    const prev = withSwapPreview(p0.items, { id: ids[0], catalogId: alt.id, variant: 0 });
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

  it("übernimmt ausführungsabhängige Parameter (Frontstil) beim Platzieren", () => {
    const c = allCatalog().find((x) => x.variants.some((v) => v.params?.front === "frame"));
    if (!c) return;
    const i = c.variants.findIndex((v) => v.params?.front === "frame");
    expect(newItemFromCatalog(c, i, 0, 0).params?.front).toBe("frame");
  });
});
