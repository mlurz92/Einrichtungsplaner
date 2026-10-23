import { describe, expect, it } from "vitest";
import type { WallFace } from "./geometry";
import { snapFloorItem, snapWallItem } from "./snap";
import { alignOffsets, distributeOffsets } from "./align";

// Raum 0…4 × 0…3 m; Nordwand y = 0 (Normale +y), Westwand x = 0 (Normale +x)
const face = (id: string, a: [number, number], b: [number, number], n: [number, number]): WallFace => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { id, roomId: "r", index: 0, a, b, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n, length: L, spans: [], wallRatio: 1, angleDeg: 0 };
};
const N = face("n", [0, 0], [4, 0], [0, 1]);
const W = face("w", [0, 3], [0, 0], [1, 0]);
const faces = [N, W];

describe("Wandfang", () => {
  it("dreht ein Sideboard mit der Rückseite zur Wand und legt es bündig an", () => {
    // 30 cm vor der Nordwand, 35° verdreht
    const r = snapFloorItem({ x: 2, y: 0.225 + 0.3, rot: 35, w: 1.6, d: 0.45 }, faces, true);
    expect(r.rot).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(0.225 + 0.002, 3);
    expect(r.x).toBeCloseTo(2, 5);
    expect(r.guides.length).toBe(1);
  });
  it("dreht nicht, wenn die Abweichung zu groß ist (Seite zur Wand)", () => {
    const r = snapFloorItem({ x: 2, y: 0.8 + 0.1, rot: 90, w: 1.6, d: 0.45 }, faces, true);
    expect(r.rot).toBe(90);
    // Seite (halbe Breite 0,8 m) liegt 10 cm vor der Wand → bündig
    expect(r.y).toBeCloseTo(0.8 + 0.002, 3);
  });
  it("Eckfang: zwei Seiten bündig", () => {
    const r = snapFloorItem({ x: 0.45 + 0.12, y: 0.3 + 0.15, rot: 0, w: 0.9, d: 0.6 }, faces, true);
    expect(r.y).toBeCloseTo(0.302, 3);
    expect(r.x).toBeCloseTo(0.452, 3);
    expect(r.guides.length).toBe(2);
  });
  it("kein Fang außerhalb des Fangradius", () => {
    const r = snapFloorItem({ x: 2, y: 1.5, rot: 0, w: 1, d: 0.5 }, faces, true);
    expect([r.x, r.y, r.rot]).toEqual([2, 1.5, 0]);
  });
  it("Objekt in der Wand wird herausgeschoben", () => {
    const r = snapFloorItem({ x: 2, y: 0.15, rot: 180, w: 1, d: 0.5 }, faces, false);
    expect(r.y).toBeCloseTo(0.252, 3);
  });
  it("Wandobjekt dockt an und richtet sich aus", () => {
    const r = snapWallItem({ x: 1, y: 0.5, d: 0.03 }, faces)!;
    expect(r.y).toBeCloseTo(0.017, 3);
    expect(r.rot).toBeCloseTo(0, 5);
  });
});

describe("Ausrichten & Verteilen", () => {
  const items = [
    { id: "a", x: 1, y: 1, rot: 0, w: 1, d: 0.5 },
    { id: "b", x: 3, y: 2, rot: 90, w: 1, d: 0.5 },
    { id: "c", x: 6, y: 1.5, rot: 0, w: 2, d: 0.5 },
  ];
  it("links bündig nutzt die gedrehten Grundrisse", () => {
    const m = alignOffsets(items, "left");
    expect(m.get("a")![0]).toBeCloseTo(0, 6);
    expect(3 + m.get("b")![0] - 0.25).toBeCloseTo(0.5, 6); // b ist 90° gedreht: halbe Ausdehnung in x = d/2
    expect(6 + m.get("c")![0] - 1).toBeCloseTo(0.5, 6);
  });
  it("verteilt mit gleichen Abständen", () => {
    const m = distributeOffsets(items, "x");
    const xs = items.map((i) => i.x + m.get(i.id)![0]);
    // Lücken: a.re → b.li und b.re → c.li gleich
    const g1 = xs[1] - 0.25 - (xs[0] + 0.5);
    const g2 = xs[2] - 1 - (xs[1] + 0.25);
    expect(g1).toBeCloseTo(g2, 6);
    expect(m.get("a")![0]).toBeCloseTo(0, 6);
    expect(m.get("c")![0]).toBeCloseTo(0, 6);
  });
});
