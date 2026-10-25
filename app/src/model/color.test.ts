import { describe, expect, it } from "vitest";
import { closestVariant, colorFamily, deltaE, matchVariant, variantIndex } from "./color";
import type { CatalogItem } from "./types";

const sofa: CatalogItem = {
  id: "t",
  vendor: "Westwing",
  name: "Testsofa",
  category: "sofa",
  w: 220,
  d: 95,
  h: 80,
  price: 1000,
  archetype: "sofa",
  mount: "floor",
  variants: [
    { name: "Webstoff Off White", slots: { main: { color: "#ede8dc", material: "fabric" }, legs: { color: "#1d1d1d", material: "blackMetal" } } },
    { name: "Bouclé Greige", slots: { main: { color: "#c9c0b2", material: "boucle" }, legs: { color: "#1d1d1d", material: "blackMetal" } } },
    { name: "Samt Petrol", slots: { main: { color: "#2f6d72", material: "velvet" }, legs: { color: "#c9a55c", material: "brass" } } },
    { name: "Cord Olivgrün", slots: { main: { color: "#6e7450", material: "cord" }, legs: { color: "#1d1d1d", material: "blackMetal" } } },
  ],
};

describe("Farbabstand und Farbfamilien", () => {
  it("ΔE ist 0 für gleiche und groß für gegensätzliche Farben", () => {
    expect(deltaE("#336699", "#336699")).toBeCloseTo(0, 5);
    expect(deltaE("#000000", "#ffffff")).toBeGreaterThan(99);
  });
  it("ordnet typische Möbelfarben richtig ein", () => {
    expect(colorFamily("#ede8dc")).toBe("weiss");
    expect(colorFamily("#d6c4a4")).toBe("beige");
    expect(colorFamily("#7a5a43")).toBe("braun");
    expect(colorFamily("#8f8f8b")).toBe("grau");
    expect(colorFamily("#1d1d1d")).toBe("schwarz");
    expect(colorFamily("#6e7450")).toBe("gruen");
    expect(colorFamily("#2f6d72")).toBe("blau");
    expect(colorFamily("#b8653f")).toBe("rot");
    expect(colorFamily("#c49a2e")).toBe("gelb");
  });
});

describe("Ausführung zur bisherigen Farbe", () => {
  it("wählt beim Tausch die nächstliegende Hersteller-Ausführung", () => {
    expect(closestVariant(sofa, { main: { color: "#2a6a70", material: "velvet" } })).toBe(2);
    expect(closestVariant(sofa, { main: { color: "#cdc4b6", material: "boucleMel" } })).toBe(1);
    expect(closestVariant(sofa, { main: { color: "#f1ece2", material: "linen" } })).toBe(0);
  });
  it("findet Ausführungen nach Farbfamilie und Material", () => {
    expect(matchVariant(sofa, "gruen", "")).toBe(3);
    expect(matchVariant(sofa, "", "samt")).toBe(2);
    expect(matchVariant(sofa, "blau", "metall")).toBe(2);
    expect(matchVariant(sofa, "gruen", "leder")).toBe(-1);
  });
});

describe("Ausführung nach Namen", () => {
  const c = { variants: [{ name: "Mikrofaser Taupe Vintage, Gestell Schwarz" }, { name: "Mikrofaser Beige Vintage, Gestell Schwarz" }] } as unknown as CatalogItem;
  it("findet exakte Namen und Namen ohne Bezugsoptik aus älteren Projekten", () => {
    expect(variantIndex(c, "Mikrofaser Beige Vintage, Gestell Schwarz")).toBe(1);
    expect(variantIndex(c, "Mikrofaser Beige, Gestell Schwarz")).toBe(1);
    expect(variantIndex(c, "Mikrofaser Taupe, Gestell Schwarz")).toBe(0);
    expect(variantIndex(c, "Cord Beige, Gestell Schwarz")).toBe(-1);
    expect(variantIndex(c, undefined)).toBe(-1);
  });
});
