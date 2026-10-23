import { describe, expect, it } from "vitest";
import type { Apartment, CatalogItem, PlacedItem, Vec2 } from "./types";
import { fitsThrough, runChecks } from "./check";
import { apartment, wallFaces } from "../data";
import { getCatalogItem } from "../store/project";
import { polygonCentroid } from "./geometry";

// Raum 0…4 × 0…3 m mit 20 cm Wänden ringsum
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const apt = {
  walls: [rect(-0.2, -0.2, 4.2, 0), rect(-0.2, 3, 4.2, 3.2), rect(-0.2, 0, 0, 3), rect(4, 0, 4.2, 3)],
  rooms: [{ id: "r", name: "Raum", floor: "parkett", outdoor: false, polygon: rect(0, 0, 4, 3), area: 12, perimeter: 14 }],
  openings: [],
} as unknown as Apartment;

const cat = (category: string, archetype = category, vendor = "Westwing"): CatalogItem =>
  ({ id: category, vendor, name: category, category, archetype, w: 100, d: 60, h: 200, price: 0, mount: "floor", variants: [] }) as unknown as CatalogItem;
const CAT = new Map(["wardrobe", "bed", "sofa", "chair", "diningTable"].map((c) => [c, cat(c)]));
const lookup = (id: string) => CAT.get(id);
let n = 0;
const item = (catalogId: string, x: number, y: number, rot: number, w: number, d: number, h = 0.8): PlacedItem =>
  ({ id: `i${n++}`, catalogId, x, y, rot, w, d, h, elev: 0, mount: "floor", slots: {}, room: "r" }) as PlacedItem;

describe("Planungs-Check", () => {
  it("meldet zu wenig Bewegungsfläche vor dem Kleiderschrank", () => {
    // Schrank an der Nordwand (Front nach Süden), Bett 50 cm davor
    const schrank = item("wardrobe", 2, 0.3, 0, 2, 0.6, 2.2);
    const bett = item("bed", 2, 0.6 + 0.5 + 1.0, 0, 1.4, 2.0);
    const r = runChecks([schrank, bett], apt, [], lookup);
    const f = r.findings.find((x) => x.itemIds[0] === schrank.id && x.kind === "bewegung");
    expect(f?.level).toBe("warnung");
    expect(f?.title).toContain("50 cm");
    expect(f?.itemIds).toContain(bett.id);
  });
  it("Schrank mit 1 m Abstand ist in Ordnung (Zone grün)", () => {
    const schrank = item("wardrobe", 2, 0.3, 0, 2, 0.6, 2.2);
    const r = runChecks([schrank], apt, [], lookup);
    expect(r.findings.filter((x) => x.kind === "bewegung")).toHaveLength(0);
    expect(r.zones.some((z) => z.state === "ok")).toBe(true);
  });
  it("Doppelbett braucht beidseitig Platz, Einzelbett nur einseitig", () => {
    const doppel = item("bed", 0.9, 1.0, 0, 1.6, 2.0); // linke Seite an der Wand
    expect(runChecks([doppel], apt, [], lookup).findings.some((f) => f.title.includes("links"))).toBe(true);
    const einzel = item("bed", 0.5, 1.0, 0, 0.9, 2.0);
    expect(runChecks([einzel], apt, [], lookup).findings.filter((f) => f.kind === "bewegung")).toHaveLength(0);
  });
  it("Stuhlzone am Esstisch nur auf Seiten mit Stühlen", () => {
    const tisch = item("diningTable", 2, 1.0, 0, 1.6, 0.9, 0.75);
    const stuhl = item("chair", 2, 1.0 + 0.45 + 0.2, 180, 0.5, 0.5); // Südseite, ~2 m frei
    const ok = runChecks([tisch, stuhl], apt, [], lookup);
    expect(ok.findings).toHaveLength(0);
    const nordStuhl = item("chair", 2, 1.0 - 0.45 - 0.2, 0, 0.5, 0.5); // Nordseite: nur 55 cm bis zur Wand
    const eng = runChecks([tisch, stuhl, nordStuhl], apt, [], lookup);
    expect(eng.findings.some((f) => f.title.includes("Esstisch") && f.level === "warnung")).toBe(true);
  });
  it("erkennt Möbel in der Wand", () => {
    const sofa = item("sofa", 2, 0.2, 0, 2, 0.9);
    expect(runChecks([sofa], apt, [], lookup).findings.some((f) => f.kind === "wand")).toBe(true);
  });
  it("Lieferweg: gekippt durch die Tür", () => {
    expect(fitsThrough([2.28, 1.04, 0.8], 0.89, 1.95)).toBe(true);
    expect(fitsThrough([2.0, 1.0, 1.0], 0.89, 1.95)).toBe(false);
  });
  it("Türschwenkbereich in der echten Wohnung", () => {
    const leer = runChecks([], apartment, wallFaces, getCatalogItem);
    const swing = leer.zones.find((z) => z.poly.length === 10)!;
    expect(swing).toBeTruthy();
    const [x, y] = polygonCentroid(swing.poly);
    const sb = { ...item("x", x, y, 0, 0.4, 0.4), catalogId: "custom-box" };
    const box = { ...cat("sideboard"), id: "custom-box" };
    const r = runChecks([sb], apartment, wallFaces, (id) => (id === "custom-box" ? box : getCatalogItem(id)));
    expect(r.findings.some((f) => f.kind === "tuer" && f.level === "fehler")).toBe(true);
  });
  it("Balkonzugang: Möbel vor der Fenstertür", () => {
    const face = wallFaces.find((f) => f.spans.some((sp) => sp.openingId === "W-B1") && !f.roomId.startsWith("13.08"))!;
    const sp = face.spans.find((x) => x.openingId === "W-B1")!;
    const t = (sp.t0 + sp.t1) / 2;
    const x = face.a[0] + (face.b[0] - face.a[0]) * t + face.n[0] * 0.4;
    const y = face.a[1] + (face.b[1] - face.a[1]) * t + face.n[1] * 0.4;
    const box = { ...cat("sideboard"), id: "custom-box" };
    const sb = { ...item("x", x, y, 0, 0.5, 0.5), catalogId: "custom-box" };
    const r = runChecks([sb], apartment, wallFaces, (id) => (id === "custom-box" ? box : getCatalogItem(id)));
    expect(r.findings.some((f) => f.kind === "fenster" && f.level === "fehler")).toBe(true);
  });
});
