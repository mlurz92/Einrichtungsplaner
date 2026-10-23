import { describe, expect, it } from "vitest";
import { apartment, concepts } from "../data";
import { pointInPolygon } from "../model/geometry";
import { inFurniture, roomPole, roomView } from "./views";

describe("Raumansichten", () => {
  const items = concepts[0].project.items;
  it("Standpunkt im Raum, frei von Möbeln, Ziel in Blickweite", () => {
    for (const r of apartment.rooms.filter((x) => !x.outdoor)) {
      const v = roomView(r.id, items, 1.6)!;
      expect(pointInPolygon(v.pos[0], v.pos[2], r.polygon)).toBe(true);
      expect(inFurniture(v.pos[0], v.pos[2], items, 0.1)).toBe(false);
      expect(Math.hypot(v.target[0] - v.pos[0], v.target[2] - v.pos[2])).toBeGreaterThan(1);
      expect(v.pos[1]).toBe(1.6);
    }
  });
  it("Pol liegt auch im L-förmigen Wohnraum innerhalb", () => {
    const r = apartment.rooms.find((x) => x.id === "13.01")!;
    const p = roomPole(r.polygon);
    expect(pointInPolygon(p[0], p[1], r.polygon)).toBe(true);
  });
  it("Kollision berücksichtigt Drehung", () => {
    const it = { ...items[0], x: 0, y: 0, w: 2, d: 0.5, h: 1, rot: 90, mount: "floor" as const, hidden: false };
    expect(inFurniture(0, 0.9, [it], 0)).toBe(true);
    expect(inFurniture(0.9, 0, [it], 0)).toBe(false);
  });
});
