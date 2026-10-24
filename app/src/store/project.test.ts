import { describe, expect, it } from "vitest";
import { useEditor, getCatalogItem, migrateProject } from "./project";
import { concepts } from "../data";
import type { Project } from "../model/types";
import { FLOOR_PRESETS } from "../data/paints";

describe("Neue Einrichtung (leere Wohnung)", () => {
  it("übernimmt nur den gewählten Bestand und setzt den Grundausbau", () => {
    const terr = FLOOR_PRESETS.find((f) => f.id === "terrazzo")!;
    useEditor.getState().newFurnishing({
      name: "Test", keepKitchen: false, keepSanitary: false, keepWasher: false,
      wallColor: "#c3cfb5", wallProduct: "Salbei", ceilingColor: "#f4f3ee", floor: terr.floor,
    });
    const p = useEditor.getState().project;
    const arch = p.items.map((i) => getCatalogItem(i.catalogId)?.archetype);
    expect(arch).toContain("kitchenAlno");
    expect(arch).toContain("kitchenAlnoSide");
    expect(arch).not.toContain("toilet");
    expect(arch).not.toContain("washer");
    expect(p.items.every((i) => i.existing)).toBe(true);
    // Wohnräume: Terrazzo, Nassräume: Bestand Iron
    expect(p.rooms["13.01"].floor.kind).toBe("terrazzo");
    expect(p.rooms["13.05"].floor.productName).toContain("Iron");
    expect(p.rooms["13.07"].floor.color).toBe("#5e5b57");
    expect(p.rooms["13.03"].wall.base.color).toBe("#c3cfb5");
    expect(p.rooms["13.05"].wall.lower).toBeTruthy(); // Fliesenspiegel im Bad bleibt
  });
  it("überträgt Ausbau auf mehrere Räume in einem Schritt", () => {
    const st = useEditor.getState();
    const before = st.past.length;
    st.applyToRooms(["13.01", "13.03"], (r) => ({ ...r, skirting: { height: 0.12, color: "#f4f2ec" }, ceilingFinish: { kind: "paint", cornice: 0.07 } }));
    const p = useEditor.getState().project;
    expect(p.rooms["13.03"].skirting?.height).toBe(0.12);
    expect(p.rooms["13.01"].ceilingFinish?.cornice).toBe(0.07);
    expect(useEditor.getState().past.length).toBe(before + 1);
  });
});

describe("Einbauküche Alno 2060 (fester Bestand)", () => {
  const OLD = "bestand-k-che-alno-2060-bestand-schematisch-";
  it("steht in allen Konzepten an der Westwand der Küche, maßgenau nach Höffner-Planung", () => {
    for (const c of concepts) {
      const k = c.project.items.find((i) => i.catalogId === "bestand-kueche-alno-2060")!;
      const s = c.project.items.find((i) => i.catalogId === "bestand-kueche-alno-2060-sideboard")!;
      expect(k.builtIn && k.locked && k.existing).toBe(true);
      expect(k.room).toBe("13.02");
      expect(s.room).toBe("13.02");
      expect(k.w).toBeCloseTo(3.647, 2);
      expect(k.h).toBeCloseTo(2.358, 3);
      expect(s.w).toBeCloseTo(1.236, 3);
      expect(c.project.items.some((i) => i.catalogId === OLD)).toBe(false);
    }
  });
  it("ersetzt in gespeicherten Projekten die schematische Küche und ergänzt fehlende Einbauteile", () => {
    const p = structuredClone(concepts[1].project) as Project;
    const k = p.items.find((i) => i.catalogId === "bestand-kueche-alno-2060")!;
    p.items = p.items.filter((i) => !i.builtIn);
    p.items.push({ ...k, builtIn: undefined, catalogId: OLD, w: 3.628, d: 0.62, h: 2.3 });
    const m = migrateProject(p);
    expect(m.items.some((i) => i.catalogId === OLD)).toBe(false);
    expect(m.items.filter((i) => i.builtIn).length).toBe(2);
    expect(getCatalogItem("bestand-kueche-alno-2060")?.archetype).toBe("kitchenAlno");
  });
  it("lässt sich weder löschen, verschieben noch entsperren", () => {
    const st = useEditor.getState();
    st.loadConcept(concepts[0].id);
    const k = useEditor.getState().project.items.find((i) => i.builtIn)!;
    st.removeItems([k.id]);
    st.updateItems([k.id], (it) => {
      it.x += 1;
      it.locked = false;
    });
    const after = useEditor.getState().project.items.find((i) => i.id === k.id)!;
    expect(after.x).toBe(k.x);
    expect(after.locked).toBe(true);
  });
});
