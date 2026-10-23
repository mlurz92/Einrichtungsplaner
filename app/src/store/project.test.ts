import { describe, expect, it } from "vitest";
import { useEditor, getCatalogItem } from "./project";
import { FLOOR_PRESETS } from "../data/paints";

describe("Neue Einrichtung (leere Wohnung)", () => {
  it("übernimmt nur den gewählten Bestand und setzt den Grundausbau", () => {
    const terr = FLOOR_PRESETS.find((f) => f.id === "terrazzo")!;
    useEditor.getState().newFurnishing({
      name: "Test", keepKitchen: true, keepSanitary: false, keepWasher: false,
      wallColor: "#c3cfb5", wallProduct: "Salbei", ceilingColor: "#f4f3ee", floor: terr.floor,
    });
    const p = useEditor.getState().project;
    const arch = p.items.map((i) => getCatalogItem(i.catalogId)?.archetype);
    expect(arch).toContain("kitchenRun");
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
