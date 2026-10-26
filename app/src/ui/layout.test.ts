import { describe, expect, it } from "vitest";
import { dividers, LAYOUT_DEFAULTS, LAYOUTS, matchingView, paneRects, sanitizeLayout, useLayout, VIEW_PRESETS, visiblePanes, type LayoutId } from "./layout";

const ids = Object.keys(LAYOUTS) as LayoutId[];

describe("Fensteraufteilung", () => {
  it("füllt den Ansichtsbereich lückenlos und ohne Überlappung", () => {
    for (const id of ids) {
      const rects = paneRects(id, { x: 0.37, y: 0.61 });
      expect(rects).toHaveLength(LAYOUTS[id].count);
      expect(rects.reduce((a, r) => a + r.w * r.h, 0)).toBeCloseTo(1, 9);
      for (const r of rects) {
        expect(r.l).toBeGreaterThanOrEqual(0);
        expect(r.t).toBeGreaterThanOrEqual(0);
        expect(r.l + r.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(r.t + r.h).toBeLessThanOrEqual(1 + 1e-9);
      }
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          const ox = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l);
          const oy = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
          expect(ox <= 1e-9 || oy <= 1e-9).toBe(true);
        }
    }
  });

  it("hat Teiler genau dort, wo Fenster aneinandergrenzen", () => {
    expect(dividers("single", { x: 0.5, y: 0.5 })).toHaveLength(0);
    expect(dividers("cols", { x: 0.5, y: 0.5 })).toEqual([{ axis: "x", from: 0, to: 1 }]);
    // Drei Fenster, groß links: waagerechter Teiler nur in der rechten Spalte
    expect(dividers("left3", { x: 0.6, y: 0.5 })[1]).toEqual({ axis: "y", from: 0.6, to: 1 });
    expect(dividers("quad", { x: 0.5, y: 0.5 })).toHaveLength(2);
  });

  it("zeigt bei „Ein Fenster“ das gewählte Fenster, sonst die ersten n", () => {
    expect(visiblePanes({ layout: "single", solo: 2 })).toEqual([2]);
    expect(visiblePanes({ layout: "left3", solo: 2 })).toEqual([0, 1, 2]);
  });

  it("bereinigt gespeicherte Werte", () => {
    const s = sanitizeLayout({ layout: "achtfach" as never, split: { x: 4, y: Number.NaN }, panes: [{ kind: "video" } as never], maximized: 3, active: 9 });
    expect(s.layout).toBe(LAYOUT_DEFAULTS.layout);
    expect(s.split).toEqual({ x: 0.88, y: 0.5 });
    expect(s.panes[0].kind).toBe("plan");
    expect(s.panes).toHaveLength(4);
    // Fenster 4 ist bei zwei Fenstern nicht sichtbar → nicht maximiert, aktiv wird das erste
    expect(s.maximized).toBeNull();
    expect(s.active).toBe(0);
    expect(sanitizeLayout(null)).toEqual(LAYOUT_DEFAULTS);
  });
});

describe("Schnellwahl und Fensterwechsel", () => {
  it("behält beim Wechsel auf ein Fenster das passende geladene Fenster", async () => {
    const { useLayout, targetPane, ensure3d } = await import("./layout");
    const l = () => useLayout.getState();
    l().reset();
    l().preset("3d");
    expect(l().layout).toBe("single");
    expect(l().solo).toBe(1); // 3D-Fenster der Aufteilung bleibt erhalten
    l().preset("split");
    expect(l().layout).toBe("cols");
    expect(l().panes.slice(0, 2).map((p) => p.kind)).toEqual(["plan", "3d"]);
    l().preset("plan");
    expect(targetPane("3d")).toBeNull();
    // 3D-Befehl ohne sichtbares 3D-Fenster blendet eines ein
    const t = ensure3d();
    expect(l().panes[t].kind).toBe("3d");
    expect(targetPane("3d")).toBe(t);
    // Maximieren nur bei mehreren Fenstern, aktives Fenster wird Ziel
    l().setLayout("quad");
    l().toggleMaximize(2);
    expect(l().maximized).toBe(2);
    expect(l().active).toBe(2);
    l().toggleMaximize(2);
    expect(l().maximized).toBeNull();
    l().reset();
  });

  it("vorgefertigte Ansichten stellen Aufteilung und Belegung ein und werden wiedererkannt", () => {
    const ids = new Set<string>();
    for (const v of VIEW_PRESETS) {
      expect(ids.has(v.id)).toBe(false);
      ids.add(v.id);
      expect(v.slots.length).toBe(LAYOUTS[v.layout].count);
      useLayout.getState().applyView(v.id);
      const s = useLayout.getState();
      expect(s.layout).toBe(v.layout);
      expect(s.maximized).toBeNull();
      expect(matchingView(s)).toBe(v.id);
      const vis = visiblePanes(s);
      v.slots.forEach((slot, k) => expect(s.panes[vis[k]].kind).toBe(slot.kind));
    }
    // Teilerstellung bleibt beim Wechsel ohne eigene Vorgabe, „gleich groß“ setzt sie zurück
    useLayout.getState().setSplit("x", 0.7);
    useLayout.getState().evenSplit();
    expect(useLayout.getState().split).toEqual({ x: 0.5, y: 0.5 });
    useLayout.getState().reset();
  });
});
