import { describe, expect, it } from "vitest";
import { useEditor } from "./project";

const st = () => useEditor.getState();

function freshConcept() {
  st().loadConcept("concept1");
  st().setProject(structuredClone(st().project));
}

describe("Undo/Redo-Verlauf", () => {
  it("benennt Schritte und stellt die Auswahl konsistent wieder her", () => {
    freshConcept();
    const it0 = st().project.items.find((i) => !i.locked)!;
    st().select([it0.id]);
    st().removeItems([it0.id]);
    expect(st().pastLabels.at(-1)).toMatch(/löschen$/);
    expect(st().project.items.some((i) => i.id === it0.id)).toBe(false);
    st().undo();
    expect(st().project.items.some((i) => i.id === it0.id)).toBe(true);
    expect(st().futureLabels[0]).toMatch(/löschen$/);
    st().select([it0.id]);
    st().redo();
    expect(st().selection).toEqual([]);
    expect(st().pastLabels.length).toBe(st().past.length);
  });

  it("fasst aufeinanderfolgende Pfeiltasten-Schritte zu einem Undo-Schritt zusammen", () => {
    freshConcept();
    const it0 = st().project.items.find((i) => !i.locked)!;
    const x0 = it0.x;
    for (let k = 0; k < 5; k++) st().updateItems([it0.id], (it) => void (it.x += 0.01), { label: "Verschieben (Pfeiltasten)", coalesce: "nudge" });
    expect(st().past.length).toBe(1);
    st().undo();
    expect(st().project.items.find((i) => i.id === it0.id)!.x).toBeCloseTo(x0, 6);
  });

  it("löscht gesperrte Objekte nicht", () => {
    freshConcept();
    const locked = st().project.items.find((i) => i.locked);
    if (!locked) return;
    st().removeItems([locked.id]);
    expect(st().project.items.some((i) => i.id === locked.id)).toBe(true);
    expect(st().past.length).toBe(0);
  });
});

describe("Zwischenablage", () => {
  it("fügt Kopien an der gewünschten Position ein und behält die Anordnung", () => {
    freshConcept();
    const [a, b] = st().project.items.filter((i) => !i.locked && !i.existing);
    st().copyItems([a.id, b.id]);
    const n = st().project.items.length;
    st().pasteItems([1, 1]);
    const p = st().project;
    expect(p.items.length).toBe(n + 2);
    const copies = p.items.filter((i) => st().selection.includes(i.id));
    expect(copies).toHaveLength(2);
    const cx = (copies[0].x + copies[1].x) / 2;
    const cy = (copies[0].y + copies[1].y) / 2;
    expect(cx).toBeCloseTo(1, 6);
    expect(cy).toBeCloseTo(1, 6);
    expect(copies[1].x - copies[0].x).toBeCloseTo(b.x - a.x, 6);
    expect(copies.every((c) => c.id !== a.id && c.id !== b.id && !c.pos)).toBe(true);
    st().undo();
    expect(st().project.items.length).toBe(n);
  });

  it("Ausschneiden entfernt die Objekte, Einfügen bringt sie zurück", () => {
    freshConcept();
    const a = st().project.items.find((i) => !i.locked && !i.existing)!;
    const n = st().project.items.length;
    st().cutItems([a.id]);
    expect(st().project.items.length).toBe(n - 1);
    st().pasteItems([a.x, a.y]);
    expect(st().project.items.length).toBe(n);
  });
});
