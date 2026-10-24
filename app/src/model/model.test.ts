import { describe, expect, it } from "vitest";
import { apartment, baseCatalog, concepts, wallFaces } from "../data";
import { DEG, footprint, pointInPolygon, polygonArea, polygonsOverlap } from "./geometry";

const ARCHETYPES = new Set([
  "sofa", "sofaModular", "sofaRound", "sofaCorner", "sofaBed", "armchairLounge", "armchairRound", "armchairWing", "armchairShell",
  "diningArmchair", "diningChair", "cantilever", "barStool", "pouf", "bench", "tableRect", "tableRound", "tableOval", "tablePedestal",
  "coffeeDuo", "coffeeBlock", "coffeeRound", "sideRound", "sideContainer", "desk", "deskStanding", "console", "sideboard", "lowboard",
  "vitrine", "shelfOpen", "bookcase", "wardrobe", "dresser", "nightstand", "bed", "bedWood", "officeChair", "lampFloorGlobe",
  "lampFloorShade", "lampFloorArc", "lampFloorTripod", "lampTableMushroom", "lampTableGlobe", "lampTableShade", "lampTableLayered",
  "pendantGlobe", "pendantDome", "pendantCluster", "pendantMirrorBall", "ceilingDome", "ceilingDisc", "wallGlobe", "wallSconce",
  "rugRect", "rugRound", "rugOrganic", "curtain", "art", "artPair", "mirrorRound", "mirrorArch", "mirrorRect", "plantTree", "plantBush",
  "plantPot", "vase", "books", "tray", "bowl", "candles", "cushion", "throw", "tv", "tvFrame", "tylkoStorage", "pendantLinear", "lampTask", "lamella", "molding", "panelWall", "outdoorTable",
  "outdoorChair", "outdoorSofa", "kitchenRun", "kitchenAlno", "kitchenAlnoSide", "bathtub", "toilet", "washbasin", "shower", "washer", "box", "glb",
]);

describe("Grundriss WE 13", () => {
  it("Raumflächen entsprechen den Raumstempeln (±0,01 m², DU/WC lt. Prüfprotokoll −0,02)", () => {
    const soll: Record<string, number> = { "13.01": 42.45, "13.02": 10.38, "13.03": 15.76, "13.04": 9.96, "13.05": 5.93, "13.06": 4.37, "13.07": 2.95, "13.08": 5.31, "13.09": 5.15 };
    for (const r of apartment.rooms) {
      expect(Math.abs(Math.abs(polygonArea(r.polygon)) - soll[r.id])).toBeLessThan(0.011);
    }
    const innen = apartment.rooms.filter((r) => !r.outdoor).reduce((a, r) => a + r.area, 0);
    expect(innen).toBeCloseTo(91.8, 1);
  });

  it("Öffnungsbreiten = Rohbauöffnungen des Architektenplans", () => {
    const w = Object.fromEntries(apartment.openings.map((o) => [o.id, Math.round(o.width * 1000) / 10]));
    expect(w["D-ENT"]).toBeCloseTo(101, 0);
    expect(w["D-SCH"]).toBeCloseTo(88.5, 0);
    expect(w["D-BAD"]).toBeCloseTo(76, 0);
    expect(w["W-B1"]).toBeCloseTo(226, 0);
    expect(w["W-K"]).toBeCloseTo(188.5, 0);
    expect(w["W-S1"]).toBeCloseTo(113.5, 0);
    expect(apartment.openings).toHaveLength(16);
  });

  it("Raumhöhe 2,56 m", () => {
    expect(apartment.ceilingHeight).toBe(2.56);
  });

  it("jede Innenraum-Wandfläche hat eine Raum-Normale", () => {
    for (const f of wallFaces) {
      const r = apartment.rooms.find((x) => x.id === f.roomId)!;
      const mx = (f.a[0] + f.b[0]) / 2 + f.n[0] * 0.03;
      const my = (f.a[1] + f.b[1]) / 2 + f.n[1] * 0.03;
      expect(pointInPolygon(mx, my, r.polygon)).toBe(true);
    }
    // Offene Raumgrenze Kochen/Wohnen ist nicht als Wand markiert
    const kitchenOpen = wallFaces.filter((f) => f.roomId === "13.02" && f.spans.some((s) => s.kind === "open"));
    expect(kitchenOpen.length).toBeGreaterThan(0);
  });
});

describe("Möblierungskonzepte", () => {
  // PDF-Summen mit dem seit v2.0.1 rechteckigen Essplatz aus dem Katalog (Tisch, 7 Stühle, Pendelleuchte, Teppich)
  // statt rundem Tisch, 5 Stühlen, Pendelleuchte(n) und rundem Teppich der PDF-Planung.
  const pdfTotals: Record<string, number> = { concept1: 32997.29, concept2: 30783.46, concept3: 31111.31, concept4: 38086.64 };
  for (const c of concepts) {
    it(`${c.subtitle}: Budget = PDF mit Katalog-Essplatz`, () => {
      const p = c.project;
      const sum =
        p.items.reduce((a, it) => a + (it.existing ? 0 : (it.parts ?? []).reduce((s, x) => s + x.qty * x.unit, 0)), 0) +
        p.budget.reduce((a, b) => a + b.qty * b.unit, 0);
      expect(Math.round(sum * 100) / 100).toBeCloseTo(pdfTotals[c.id], 2);
    });
    it(`${c.subtitle}: alle Bodenobjekte liegen in der Wohnung`, () => {
      for (const it of c.project.items) {
        if (it.mount !== "floor") continue;
        const inside = apartment.rooms.some((r) => pointInPolygon(it.x, it.y, r.polygon));
        expect(inside, `${it.pos} ${it.label}`).toBe(true);
      }
    });
    it(`${c.subtitle}: keine Möbel in Wänden`, () => {
      for (const it of c.project.items) {
        if (it.mount !== "floor" || it.d < 0.05) continue;
        const fp = footprint(it, -0.03);
        for (const w of apartment.walls) {
          // Wandpolygone sind teils konkav: grob über die Eckpunkte prüfen
          const hit = fp.some(([x, y]) => pointInPolygon(x, y, w));
          expect(hit, `${it.pos} ${it.label}`).toBe(false);
        }
      }
    });
  }
});

describe("Essplatz der Konzepte", () => {
  const cat = (id: string) => baseCatalog.find((c) => c.id === id)!;
  for (const c of concepts) {
    it(`${c.subtitle}: länglicher Steintisch für 6, Längsachse von oben nach unten, Teppich und Pendelleuchte passend`, () => {
      const items = c.project.items;
      const table = items.find((i) => i.pos === "E1")!;
      expect(cat(table.catalogId).archetype).not.toBe("tableRound");
      expect(cat(table.catalogId).tags).toContain("Steintisch");
      expect(table.w).toBeGreaterThanOrEqual(1.7);
      // kein Holz an Platte oder Gestell
      for (const sl of Object.values(table.slots)) expect(["oak", "oakDark", "walnut", "ash", "mango", "burl"]).not.toContain(sl.material);
      // Länge (w) läuft entlang der Plan-y-Achse (Flügel 8° gedreht)
      expect(Math.abs(Math.cos(table.rot * DEG))).toBeLessThan(0.2);
      const chairs = items.filter((i) => i.pos === "E2");
      expect(chairs).toHaveLength(6);
      const local = (i: { x: number; y: number }) => {
        const a = -table.rot * DEG, dx = i.x - table.x, dy = i.y - table.y;
        return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
      };
      // je 3 Stühle an den Längsseiten, innerhalb der Tischlänge
      expect(chairs.filter((s) => local(s)[1] > table.d / 2 - 0.15)).toHaveLength(3);
      expect(chairs.filter((s) => local(s)[1] < -table.d / 2 + 0.15)).toHaveLength(3);
      for (const s of chairs) expect(Math.abs(local(s)[0]) + s.w / 2).toBeLessThan(table.w / 2);
      // Teppich: ≥ 60 cm Überstand an den Stuhlseiten, länger als der Tisch, mittig
      const rug = items.find((i) => i.pos === "E9")!;
      expect(cat(rug.catalogId).category).toBe("rug");
      const [rugAcross, rugAlong] = [Math.min(rug.w, rug.d), Math.max(rug.w, rug.d)];
      expect((rugAcross - table.d) / 2).toBeGreaterThanOrEqual(0.6);
      expect(rugAlong).toBeGreaterThan(table.w + 0.6);
      expect(Math.hypot(rug.x - table.x, rug.y - table.y)).toBeLessThan(0.01);
      // Pendelleuchte über dem Tisch, parallel, 75–100 % der Tischlänge
      const lamp = items.find((i) => i.pos === "E3")!;
      expect(cat(lamp.catalogId).category).toBe("pendant");
      expect(lamp.w).toBeGreaterThanOrEqual(table.w * 0.75);
      expect(lamp.w).toBeLessThanOrEqual(table.w);
      expect(Math.hypot(lamp.x - table.x, lamp.y - table.y)).toBeLessThan(0.01);
      expect(lamp.rot).toBe(table.rot);
      expect(lamp.elev - (table.elev + table.h)).toBeGreaterThan(0.55);
      // keine Überschneidung mit anderen Möbeln (Stühle unter dem Tisch ausgenommen)
      const dining = new Set(["E1", "E2"]);
      for (const it of [table, ...chairs]) {
        for (const o of items) {
          if (o.mount !== "floor" || o.elev > 0.3 || dining.has(o.pos ?? "") || o.h < 0.05 || cat(o.catalogId)?.category === "rug") continue;
          expect(polygonsOverlap(footprint(it), footprint(o)), `${it.label} ↔ ${o.label}`).toBe(false);
        }
      }
    });
  }
});

describe("Katalog", () => {
  it("umfasst Westwing, IKEA und JYSK mit plausiblen Maßen", () => {
    const vendors = new Set(baseCatalog.map((c) => c.vendor));
    for (const v of ["Westwing", "IKEA", "JYSK"]) expect(vendors.has(v as never)).toBe(true);
    expect(baseCatalog.length).toBeGreaterThan(4000);
    for (const c of baseCatalog) {
      expect(c.w, c.name).toBeGreaterThan(0);
      expect(c.d, c.name).toBeGreaterThan(0);
      expect(c.h, c.name).toBeGreaterThan(0);
      expect(ARCHETYPES.has(c.archetype), `${c.name}: ${c.archetype}`).toBe(true);
      expect(c.variants.length, c.name).toBeGreaterThan(0);
    }
  });
  it("führt längliche Stein- und Marmortische mit Plattenkennzeichnung (Höffner, BoConcept)", () => {
    const marble = baseCatalog.filter((c) => c.tags?.includes("Steintisch"));
    expect(marble.filter((c) => c.vendor === "Höffner").length).toBeGreaterThanOrEqual(16);
    expect(marble.filter((c) => c.brand === "BoConcept").length).toBeGreaterThanOrEqual(5);
    expect(marble.filter((c) => c.tags?.includes("Marmortisch")).length).toBeGreaterThanOrEqual(15);
    expect(marble.some((c) => c.tags?.some((t) => t.startsWith("Echter Marmor")))).toBe(true);
    for (const c of marble) {
      expect(c.category, c.name).toBe("diningTable");
      expect(c.w, c.name).toBeGreaterThanOrEqual(159);
      expect(c.archetype, c.name).not.toBe("tableRound");
      expect(c.description, c.name).toMatch(/^Platte: /);
      expect(c.url, c.name).toMatch(/^https:\/\//);
      expect(c.price, c.name).toBeGreaterThan(0);
    }
  });
  it("Überschneidungstest erkennt Überlappung", () => {
    const a = footprint({ x: 0, y: 0, rot: 0, w: 1, d: 1 });
    const b = footprint({ x: 0.9, y: 0, rot: 45, w: 1, d: 1 });
    const c = footprint({ x: 2, y: 0, rot: 0, w: 1, d: 1 });
    expect(polygonsOverlap(a, b)).toBe(true);
    expect(polygonsOverlap(a, c)).toBe(false);
  });
});
