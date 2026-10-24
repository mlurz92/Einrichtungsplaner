import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apartment, roomNames, wallFaces } from "../data";
import { useEditor, getCatalogItem, newItemFromCatalog, withSwapPreview } from "../store/project";
import type { PlacedItem, Vec2 } from "../model/types";
import {
  DEG,
  footprint,
  fmtCm,
  localToPlan,
  nearestFace,
  normAngle,
  polygonCentroid,
  polygonsOverlap,
  rotationForFace,
  snapAngle,
} from "../model/geometry";
import { PlanSymbol } from "./symbols";
import { FloorPattern } from "./floors";
import { Ratio, Maximize, Minus, Plus, Ruler, Hash, SquareDashed } from "lucide-react";
import { useContextMenu } from "../ui/kit";
import { itemContextEntries, planContextEntries } from "../ui/commands";
import { DND_TYPE, type CatalogDrop } from "../ui/dnd";
import { applyPlacementSnap, beginDrag, dragUpdate, isFlatFloorItem, type DragStart } from "../store/placement";
import { pointer } from "../ui/pointer";
import { useChecks } from "../ui/useChecks";

const S = 100; // SVG-Einheit = cm
const P = (v: number) => v * S;
const pts = (poly: Vec2[]) => poly.map(([x, y]) => `${P(x)},${P(y)}`).join(" ");

const SEL = "#2f7cf6";
const FONT = "Segoe UI Variable Text, Segoe UI, Inter, system-ui";
const WALL_POLY = apartment.walls;

type Drag =
  | { kind: "move"; ds: DragStart; p0: Vec2; moved: boolean; sx: number; sy: number }
  | { kind: "rotate"; id: string; cx: number; cy: number; a0: number; r0: number }
  | { kind: "resize"; id: string; side: "l" | "r" | "f" | "b"; orig: PlacedItem }
  | { kind: "pan"; sx: number; sy: number; vb: [number, number, number, number] }
  | { kind: "marquee"; p0: Vec2; p1: Vec2 }
  | null;

/** Abstand vom Punkt entlang Richtung bis zur nächsten Wandoberfläche. */
function rayToWalls(o: Vec2, d: Vec2, maxL = 6): number | null {
  let best: number | null = null;
  for (const poly of WALL_POLY) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const den = d[0] * ey - d[1] * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den;
      const s = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
      if (t > 0.001 && s >= 0 && s <= 1 && t < maxL && (best === null || t < best)) best = t;
    }
  }
  return best;
}

const ItemSym = memo(function ItemSym({ it, selected, hovered, conflict, showLabel }: { it: PlacedItem; selected: boolean; hovered: boolean; conflict: boolean; showLabel: boolean }) {
  const cat = getCatalogItem(it.catalogId);
  const arch = cat?.archetype ?? "box";
  const dashed = it.mount === "ceiling" || it.mount === "wall" || it.elev > 0.3;
  return (
    <g transform={`translate(${P(it.x)},${P(it.y)}) rotate(${it.rot})`} data-item={it.id} style={{ cursor: it.locked ? "default" : "move" }} opacity={it.hidden ? 0.25 : dashed ? 0.9 : 1}>
      <PlanSymbol it={it} arch={arch} />
      {selected && <rect x={-P(it.w) / 2 - 2} y={-P(it.d) / 2 - 2} width={P(it.w) + 4} height={P(it.d) + 4} rx={2} fill={SEL} fillOpacity={0.07} stroke={SEL} strokeOpacity={0.28} strokeWidth={5} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      {(selected || hovered || conflict) && (
        <rect x={-P(it.w) / 2 - 2} y={-P(it.d) / 2 - 2} width={P(it.w) + 4} height={P(it.d) + 4} rx={2} fill="none" stroke={conflict && !selected ? "#dc2626" : selected ? SEL : "#7fb0ff"} strokeWidth={selected ? 1.5 : 1.1} strokeDasharray={conflict && !selected ? "3 2" : undefined} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      )}
      {showLabel && it.pos && (
        <g transform={`rotate(${-it.rot})`} pointerEvents="none">
          <rect x={-it.pos.length * 3.3 - 4} y={-7} width={it.pos.length * 6.6 + 8} height={14} rx={7} fill="#24493f" opacity={0.88} />
          <text x={0} y={4} fontSize={10} textAnchor="middle" fill="#fff" fontFamily={FONT} fontWeight={600}>
            {it.pos}
          </text>
        </g>
      )}
    </g>
  );
});

export function Plan2D() {
  const snapGuides = useEditor((s) => s.snapGuides);
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const selectedFace = useEditor((s) => s.selectedFace);
  const hoverId = useEditor((s) => s.hoverId);
  const placing = useEditor((s) => s.placing);
  const selectedRoom = useEditor((s) => s.selectedRoom);
  const showClearance = useEditor((s) => s.showClearance);
  const checks = useChecks();
  const flagged = useMemo(() => {
    const m = new Set<string>();
    if (showClearance) for (const f of checks.findings) if (f.level !== "hinweis") for (const id of f.itemIds) m.add(id);
    return m;
  }, [checks, showClearance]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<[number, number, number, number]>([-60, -60, 1650, 1800]);
  const [drag, setDrag] = useState<Drag>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [measure, setMeasure] = useState<{ on: boolean; a?: Vec2; b?: Vec2 }>({ on: false });
  const [showLabels, setShowLabels] = useState(true);
  const [editDim, setEditDim] = useState<{ i: number; value: string } | null>(null);
  const fitW = useRef(1650);
  const ctxStart = useRef<{ x: number; y: number } | null>(null);
  const north = project.settings.northDeg ?? 0;
  const showDims = project.settings.showDimensions !== false;
  const sel = useMemo(() => new Set(selection), [selection]);

  // Größe beobachten und Ansicht einpassen
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const fit = useCallback(() => {
    const [bx0, by0, bx1, by1] = apartment.bounds;
    const W = P(bx1 - bx0) + 120, H = P(by1 - by0) + 120;
    const aspect = size.w / Math.max(1, size.h);
    let vw = W, vh = H;
    if (W / H > aspect) vh = W / aspect;
    else vw = H * aspect;
    fitW.current = vw;
    setVb([P(bx0) - 60 - (vw - W) / 2, P(by0) - 60 - (vh - H) / 2, vw, vh]);
  }, [size]);
  /** Um die Mitte zoomen (Zoomleiste, Tasten + und −). */
  const zoomBy = useCallback((f: number) => {
    setVb(([x, y, w, h]) => {
      const nw = Math.min(6000, Math.max(80, w * f));
      const nh = (h * nw) / w;
      return [x + (w - nw) / 2, y + (h - nh) / 2, nw, nh];
    });
  }, []);
  useEffect(() => fit(), [fit]);
  // Fokus-Anfrage
  const focus = useEditor((s) => s.focusRequest);
  useEffect(() => {
    if (!focus) return;
    setVb(([, , vw, vh]) => [P(focus.x) - vw / 2, P(focus.y) - vh / 2, vw, vh]);
  }, [focus]);

  const toPlan = useCallback(
    (cx: number, cy: number): Vec2 => {
      const r = svgRef.current!.getBoundingClientRect();
      const sx = vb[2] / r.width;
      const sy = vb[3] / r.height;
      const s = Math.max(sx, sy);
      const ox = vb[0] + (vb[2] - r.width * s) / 2;
      const oy = vb[1] + (vb[3] - r.height * s) / 2;
      return [(ox + (cx - r.left) * s) / S, (oy + (cy - r.top) * s) / S];
    },
    [vb],
  );
  /** Planpunkt (m) → Bildschirmposition relativ zur Ansicht (px). */
  const toView = (p: Vec2): [number, number] => {
    const s = Math.max(vb[2] / size.w, vb[3] / size.h);
    const ox = vb[0] + (vb[2] - size.w * s) / 2;
    const oy = vb[1] + (vb[3] - size.h * s) / 2;
    return [(P(p[0]) - ox) / s, (P(p[1]) - oy) / s];
  };

  const swapPreview = useEditor((s) => s.swapPreview);
  const items = useMemo(() => withSwapPreview(project.items, swapPreview), [project.items, swapPreview]);
  const conflicts = useMemo(() => {
    const c = new Set<string>();
    const floor = items.filter((i) => i.mount === "floor" && !i.hidden && i.elev < 0.05);
    const cat = (i: PlacedItem) => getCatalogItem(i.catalogId)?.category;
    const solid = floor.filter((i) => !["rug", "curtain", "textile", "decor", "plant", "floorLamp"].includes(cat(i) ?? ""));
    const seat = new Set(["chair", "stool", "officeChair", "outdoor", "pouf"]);
    const table = new Set(["diningTable", "desk", "coffeeTable", "console", "outdoor", "sideTable"]);
    for (let i = 0; i < solid.length; i++) {
      const a = footprint(solid[i], -0.01);
      for (let j = i + 1; j < solid.length; j++) {
        const ci = cat(solid[i]) ?? "", cj = cat(solid[j]) ?? "";
        if ((seat.has(ci) && table.has(cj)) || (seat.has(cj) && table.has(ci))) continue;
        const b = footprint(solid[j], -0.01);
        if (polygonsOverlap(a, b)) {
          c.add(solid[i].id);
          c.add(solid[j].id);
        }
      }
    }
    return c;
  }, [items]);

  const pxPerCm = size.w / vb[2];
  const labelVisible = showLabels && pxPerCm > 0.35;

  // ---------------------------------------------------------------- Ereignisse
  const onWheel = (e: React.WheelEvent) => {
    const [px, py] = toPlan(e.clientX, e.clientY);
    const f = Math.exp(e.deltaY * 0.0012);
    setVb(([x, y, w, h]) => {
      const nw = Math.min(6000, Math.max(80, w * f));
      const nh = (h * nw) / w;
      return [P(px) - (P(px) - x) * (nw / w), P(py) - (P(py) - y) * (nh / h), nw, nh];
    });
  };

  const itemAt = (target: EventTarget | null): string | null => {
    let el = target as Element | null;
    while (el && el !== svgRef.current) {
      const id = el.getAttribute?.("data-item");
      if (id) return id;
      el = el.parentElement;
    }
    return null;
  };

  const onDown = (e: React.PointerEvent) => {
    const st = useEditor.getState();
    const p = toPlan(e.clientX, e.clientY);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setEditDim(null);
    if (e.button === 2) ctxStart.current = { x: e.clientX, y: e.clientY };
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.nativeEvent.getModifierState?.("Space"))) {
      setDrag({ kind: "pan", sx: e.clientX, sy: e.clientY, vb });
      return;
    }
    if (placing) {
      st.addFromCatalog(placing.catalogId, placing.variant, p[0], p[1]);
      if (!e.shiftKey) st.set("placing", null);
      return;
    }
    if (measure.on) {
      if (!measure.a || measure.b) setMeasure({ on: true, a: p });
      else setMeasure({ on: true, a: measure.a, b: p });
      return;
    }
    const handle = (e.target as Element).getAttribute?.("data-handle");
    if (handle && selection.length === 1) {
      const it = items.find((i) => i.id === selection[0])!;
      if (handle === "rot") setDrag({ kind: "rotate", id: it.id, cx: it.x, cy: it.y, a0: Math.atan2(p[1] - it.y, p[0] - it.x), r0: it.rot });
      else setDrag({ kind: "resize", id: it.id, side: handle as "l" | "r" | "f" | "b", orig: structuredClone(it) });
      st.commit(handle === "rot" ? "Drehen" : "Größe ändern");
      return;
    }
    const id = itemAt(e.target);
    const hitItem = id ? items.find((i) => i.id === id) : undefined;
    if (id && hitItem && !sel.has(id) && isFlatFloorItem(hitItem) && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
      // Teppich: erster Klick wählt nur aus, Ziehen verschiebt die Ansicht
      st.select([id]);
      st.selectFace(null);
      setDrag({ kind: "pan", sx: e.clientX, sy: e.clientY, vb });
      return;
    }
    if (id) {
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!sel.has(id) || additive) st.select([id], additive);
      const ids = (additive ? useEditor.getState().selection : sel.has(id) ? selection : [id]).filter((x) => !items.find((i) => i.id === x)?.locked);
      if (ids.length) setDrag({ kind: "move", ds: beginDrag(ids, items), p0: p, moved: false, sx: e.clientX, sy: e.clientY });
      return;
    }
    const face = (e.target as Element).getAttribute?.("data-face");
    if (face) {
      st.selectFace(face);
      st.selectRoom(face.split(":")[0]);
      return;
    }
    const room = (e.target as Element).getAttribute?.("data-room");
    st.select([]);
    st.selectFace(null);
    if (room) st.selectRoom(room);
    // Freie Fläche: Ziehen verschiebt die Ansicht, mit Umschalt/Strg Auswahlrahmen
    if (e.shiftKey || e.ctrlKey || e.metaKey) setDrag({ kind: "marquee", p0: p, p1: p });
    else setDrag({ kind: "pan", sx: e.clientX, sy: e.clientY, vb });
  };

  const onMove = (e: React.PointerEvent) => {
    const p = toPlan(e.clientX, e.clientY);
    setCursor(p);
    pointer.plan = p;
    pointer.over = "plan";
    if (!drag) {
      const id = itemAt(e.target);
      useEditor.getState().setHover(id);
      return;
    }
    const st = useEditor.getState();
    const snapOn = st.project.settings.snap && !e.altKey;
    const grid = st.project.settings.gridSize || 0.05;
    if (drag.kind === "pan") {
      const r = svgRef.current!.getBoundingClientRect();
      const s = Math.max(drag.vb[2] / r.width, drag.vb[3] / r.height);
      setVb([drag.vb[0] - (e.clientX - drag.sx) * s, drag.vb[1] - (e.clientY - drag.sy) * s, drag.vb[2], drag.vb[3]]);
    } else if (drag.kind === "move") {
      let dx = p[0] - drag.p0[0];
      let dy = p[1] - drag.p0[1];
      // Erst ab 4 px Mausweg verschieben (Klick bleibt Klick)
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      if (!drag.moved) {
        st.commit(drag.ds.ids.length > 1 ? `${drag.ds.ids.length} Objekte verschieben` : "Verschieben");
        setDrag({ ...drag, moved: true });
      }
      if (snapOn) {
        dx = Math.round(dx / grid) * grid;
        dy = Math.round(dy / grid) * grid;
      }
      const u = dragUpdate(drag.ds, dx, dy, snapOn, st.project.items);
      st.updateItems(u.ids, u.apply, { commit: false });
      st.set("snapGuides", u.guides);
    } else if (drag.kind === "rotate") {
      const a = Math.atan2(p[1] - drag.cy, p[0] - drag.cx);
      let r = normAngle(drag.r0 + ((a - drag.a0) * 180) / Math.PI);
      if (snapOn) r = snapAngle(r, 15, 8);
      st.updateItems([drag.id], (it) => void (it.rot = r), { commit: false });
    } else if (drag.kind === "resize") {
      const o = drag.orig;
      const a = -o.rot * DEG;
      const lx = (p[0] - o.x) * Math.cos(a) - (p[1] - o.y) * Math.sin(a);
      const ly = (p[0] - o.x) * Math.sin(a) + (p[1] - o.y) * Math.cos(a);
      const q = (v: number) => (snapOn ? Math.round(v / 0.01) * 0.01 : v);
      st.updateItems(
        [drag.id],
        (it) => {
          if (drag.side === "r" || drag.side === "l") {
            const fixed = drag.side === "r" ? -o.w / 2 : o.w / 2;
            const w2 = Math.max(0.05, drag.side === "r" ? q(lx - fixed) : q(fixed - lx));
            const c = localToPlan(o, fixed + (drag.side === "r" ? w2 / 2 : -w2 / 2), 0);
            it.w = w2;
            it.x = c[0];
            it.y = c[1];
          } else {
            const fixed = drag.side === "f" ? -o.d / 2 : o.d / 2;
            const d2 = Math.max(0.01, drag.side === "f" ? q(ly - fixed) : q(fixed - ly));
            const c = localToPlan(o, 0, fixed + (drag.side === "f" ? d2 / 2 : -d2 / 2));
            it.d = d2;
            it.x = c[0];
            it.y = c[1];
          }
        },
        { commit: false },
      );
    } else if (drag.kind === "marquee") {
      setDrag({ ...drag, p1: p });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    // Rechtsklick ohne Ziehen: Kontextmenü
    const cs = ctxStart.current;
    ctxStart.current = null;
    if (e.button === 2 && cs && Math.hypot(e.clientX - cs.x, e.clientY - cs.y) < 5) {
      setDrag(null);
      const id = itemAt(e.target);
      const at = toPlan(e.clientX, e.clientY);
      const entries = id ? itemContextEntries(id) : planContextEntries(at, { measure: () => setMeasure({ on: true }), fit });
      useContextMenu.getState().open(e.clientX, e.clientY, entries);
      return;
    }
    if (drag?.kind === "marquee") {
      const [x0, x1] = [Math.min(drag.p0[0], drag.p1[0]), Math.max(drag.p0[0], drag.p1[0])];
      const [y0, y1] = [Math.min(drag.p0[1], drag.p1[1]), Math.max(drag.p0[1], drag.p1[1])];
      if (x1 - x0 > 0.05 && y1 - y0 > 0.05) {
        const ids = items.filter((i) => !i.locked && i.x >= x0 && i.x <= x1 && i.y >= y0 && i.y <= y1).map((i) => i.id);
        useEditor.getState().select(ids);
      }
    }
    if (useEditor.getState().snapGuides.length) useEditor.getState().set("snapGuides", []);
    setDrag(null);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const st = useEditor.getState();
      if (st.paletteOpen || st.startOpen || st.closeAsk || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") setMeasure((m) => ({ on: !m.on }));
      if (e.key === "Escape") setMeasure({ on: false });
      if (e.key === "f" && !e.ctrlKey && !st.selection.length) fit();
      if (e.key === "+" || e.key === "=") zoomBy(1 / 1.25);
      if (e.key === "-") zoomBy(1.25);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [fit, zoomBy]);

  // ---------------------------------------------------------------- Abstandsmaße der Auswahl
  const selItem = selection.length === 1 ? items.find((i) => i.id === selection[0]) : undefined;
  const dims = useMemo(() => {
    if (!selItem || selItem.mount !== "floor") return [];
    const out: { a: Vec2; b: Vec2; len: number; d: Vec2 }[] = [];
    const a = selItem.rot * DEG;
    const dirs: [Vec2, number][] = [
      [[-Math.sin(a), Math.cos(a)], selItem.d / 2],
      [[Math.sin(a), -Math.cos(a)], selItem.d / 2],
      [[Math.cos(a), Math.sin(a)], selItem.w / 2],
      [[-Math.cos(a), -Math.sin(a)], selItem.w / 2],
    ];
    for (const [d, half] of dirs) {
      const o: Vec2 = [selItem.x + d[0] * half, selItem.y + d[1] * half];
      const t = rayToWalls(o, d, 5);
      if (t !== null && t > 0.005) out.push({ a: o, b: [o[0] + d[0] * t, o[1] + d[1] * t], len: t, d });
    }
    return out;
  }, [selItem]);

  // Platzierungs-Vorschau
  const ghost = useMemo(() => {
    if (!placing || !cursor) return null;
    const c = getCatalogItem(placing.catalogId);
    if (!c) return null;
    const it = newItemFromCatalog(c, placing.variant, cursor[0], cursor[1], 0);
    if (c.mount === "floor") {
      const nf = nearestFace(wallFaces, cursor[0], cursor[1], Math.max(it.d, 0.5));
      it.rot = nf ? rotationForFace(nf.face) : 8;
    }
    const guides = applyPlacementSnap(it, useEditor.getState().project.items, it.rot, useEditor.getState().project.settings.snap);
    return { it, arch: c.archetype, guides };
  }, [placing, cursor]);

  const sortedItems = useMemo(() => {
    const order = (i: PlacedItem) => {
      const cat = getCatalogItem(i.catalogId)?.category ?? "";
      if (cat === "rug") return 0;
      if (i.mount === "ceiling") return 5;
      if (i.mount === "wall") return 4;
      if (i.elev > 0.1) return 3;
      return 1 + i.h * 0.1;
    };
    return [...items].sort((a, b) => order(a) - order(b));
  }, [items]);

  return (
    <div className="@container relative h-full w-full select-none overflow-hidden" style={{ background: "var(--plan-bg)" }} onContextMenu={(e) => e.preventDefault()}>
      <svg
        ref={svgRef}
        data-plan
        role="img"
        aria-label="Grundriss der Wohnung WE 13"
        className="h-full w-full"
        viewBox={vb.join(" ")}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => {
          setCursor(null);
          pointer.over = null;
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DND_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setCursor(toPlan(e.clientX, e.clientY));
        }}
        onDragLeave={() => setCursor(null)}
        onDrop={(e) => {
          const raw = e.dataTransfer.getData(DND_TYPE);
          if (!raw) return;
          e.preventDefault();
          const { catalogId, variant } = JSON.parse(raw) as CatalogDrop;
          const p = toPlan(e.clientX, e.clientY);
          const st = useEditor.getState();
          st.addFromCatalog(catalogId, variant, p[0], p[1]);
          st.set("placing", null);
        }}
        style={{ cursor: placing || measure.on ? "crosshair" : drag?.kind === "pan" ? "grabbing" : drag?.kind === "marquee" ? "crosshair" : "grab" }}
      >
        <defs>
          <pattern id="grid10" width={10} height={10} patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" style={{ stroke: "var(--plan-grid)" }} strokeWidth={0.3} />
          </pattern>
          <pattern id="grid100" width={100} height={100} patternUnits="userSpaceOnUse">
            <rect width={100} height={100} fill="url(#grid10)" />
            <path d="M100 0H0V100" fill="none" style={{ stroke: "var(--plan-grid-major)" }} strokeWidth={0.6} />
          </pattern>
          {/* weicher Schatten unter Möbeln */}
          <filter id="plan-shadow" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feDropShadow dx={0} dy={1.6} stdDeviation={1.8} floodColor="#1d150c" floodOpacity={0.22} />
          </filter>
          {/* Innenschatten der Wände in die Räume */}
          <filter id="wall-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation={3.5} />
          </filter>
          {apartment.rooms.map((r) => {
            const fin = project.rooms[r.id];
            if (!fin) return null;
            const c = polygonCentroid(r.polygon);
            return <FloorPattern key={r.id} id={`floor-${r.id.replace(".", "-")}`} f={fin.floor} cx={P(c[0])} cy={P(c[1])} />;
          })}
        </defs>
        <rect x={vb[0] - 5000} y={vb[1] - 5000} width={vb[2] + 10000} height={vb[3] + 10000} fill="url(#grid100)" />
        {/* Räume mit Belag */}
        {apartment.rooms.map((r) => (
          <polygon key={r.id} points={pts(r.polygon)} fill={project.rooms[r.id] ? `url(#floor-${r.id.replace(".", "-")})` : "#ece6db"} data-room={r.id} />
        ))}
        {/* Auswahl eines Raums */}
        {selectedRoom && !selection.length && !selectedFace && apartment.rooms.find((r) => r.id === selectedRoom) && (
          <polygon points={pts(apartment.rooms.find((r) => r.id === selectedRoom)!.polygon)} fill={SEL} fillOpacity={0.06} stroke={SEL} strokeOpacity={0.6} strokeWidth={1.4} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )}
        {/* Schattenkante entlang der Wände */}
        <g filter="url(#wall-shadow)" opacity={0.28} pointerEvents="none">
          {WALL_POLY.map((w, i) => (
            <polygon key={i} points={pts(w)} fill="none" stroke="#2b2116" strokeWidth={5} />
          ))}
        </g>
        {/* Wandflächen (Farbband + Auswahl) */}
        {wallFaces.map((f) => {
          if (f.wallRatio < 0.2) return null;
          const fin = project.walls[f.id] ?? project.rooms[f.roomId]?.wall;
          const col = fin?.base.color ?? "#f3f0e8";
          const off = 0.03;
          const a: Vec2 = [f.a[0] + f.n[0] * off, f.a[1] + f.n[1] * off];
          const b: Vec2 = [f.b[0] + f.n[0] * off, f.b[1] + f.n[1] * off];
          const custom = !!project.walls[f.id] || (fin && fin.base.color.toLowerCase() !== "#f3f0e8");
          return (
            <g key={f.id}>
              {custom && <line x1={P(a[0])} y1={P(a[1])} x2={P(b[0])} y2={P(b[1])} stroke={col} strokeWidth={4} strokeLinecap="butt" pointerEvents="none" />}
              <line x1={P(a[0])} y1={P(a[1])} x2={P(b[0])} y2={P(b[1])} stroke={selectedFace === f.id ? "#2563eb" : "transparent"} strokeWidth={selectedFace === f.id ? 5 : 9} data-face={f.id} style={{ cursor: "pointer" }} />
            </g>
          );
        })}
        {/* Bewegungsflächen und Türschwenkbereiche */}
        {showClearance &&
          checks.zones.map((z, i) => (
            <polygon
              key={i}
              points={pts(z.poly)}
              fill={z.state === "ok" ? "#16a34a" : z.state === "eng" ? "#f59e0b" : "#dc2626"}
              fillOpacity={z.state === "ok" ? 0.13 : 0.26}
              stroke={z.state === "ok" ? "#16a34a" : z.state === "eng" ? "#d97706" : "#dc2626"}
              strokeWidth={0.8}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
        {/* Objekte */}
        <g filter={drag?.kind === "move" && drag.moved ? undefined : "url(#plan-shadow)"}>
          {sortedItems.map((it) => (
            <ItemSym key={it.id} it={it} selected={sel.has(it.id)} hovered={hoverId === it.id} conflict={conflicts.has(it.id) || flagged.has(it.id)} showLabel={labelVisible} />
          ))}
        </g>
        {/* Wände */}
        {WALL_POLY.map((w, i) => (
          <polygon key={i} points={pts(w)} style={{ fill: "var(--plan-wall)" }} pointerEvents="none" />
        ))}
        {/* Öffnungen */}
        {apartment.openings.map((o) => {
          if (!o.reveal) return null;
          if (o.type === "window") {
            const [a, b] = [o.a, o.b];
            const n: Vec2 = [-(b[1] - a[1]) / o.width, (b[0] - a[0]) / o.width];
            const rv = o.reveal;
            const cx = rv.reduce((s, p) => s + p[0], 0) / rv.length;
            const cy = rv.reduce((s, p) => s + p[1], 0) / rv.length;
            const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const sh: Vec2 = [cx - mid[0], cy - mid[1]];
            return (
              <g key={o.id} pointerEvents="none">
                <polygon points={pts(o.reveal)} style={{ fill: "var(--plan-window)" }} />
                {[-0.025, 0.025].map((k) => (
                  <line key={k} x1={P(a[0] + sh[0] + n[0] * k)} y1={P(a[1] + sh[1] + n[1] * k)} x2={P(b[0] + sh[0] + n[0] * k)} y2={P(b[1] + sh[1] + n[1] * k)} style={{ stroke: "var(--plan-opening)" }} strokeWidth={0.8} />
                ))}
              </g>
            );
          }
          const L = o.width;
          const u: Vec2 = [(o.b[0] - o.a[0]) / L, (o.b[1] - o.a[1]) / L];
          const sw = o.swing ?? 1;
          const nO: Vec2 = [-u[1] * sw, u[0] * sw];
          const rv = o.reveal;
          const cx = rv.reduce((s, p) => s + p[0], 0) / rv.length;
          const cy = rv.reduce((s, p) => s + p[1], 0) / rv.length;
          const mid: Vec2 = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
          const h: Vec2 = [o.a[0] + (cx - mid[0]) + nO[0] * o.depth / 2, o.a[1] + (cy - mid[1]) + nO[1] * o.depth / 2];
          const open = project.settings.doorsOpen ?? 0;
          const ang = Math.atan2(u[1], u[0]) + sw * (open > 0 ? open : 1) * (Math.PI / 2);
          const leafEnd: Vec2 = [h[0] + Math.cos(ang) * (L - 0.04), h[1] + Math.sin(ang) * (L - 0.04)];
          const closedEnd: Vec2 = [h[0] + u[0] * (L - 0.04), h[1] + u[1] * (L - 0.04)];
          return (
            <g key={o.id} pointerEvents="none">
              <polygon points={pts(o.reveal)} style={{ fill: "var(--plan-reveal)" }} />
              <line x1={P(h[0])} y1={P(h[1])} x2={P(leafEnd[0])} y2={P(leafEnd[1])} style={{ stroke: "var(--plan-opening)" }} strokeWidth={1.6} strokeLinecap="round" />
              <path d={`M${P(leafEnd[0])},${P(leafEnd[1])} A${P(L - 0.04)},${P(L - 0.04)} 0 0 ${sw > 0 ? 0 : 1} ${P(closedEnd[0])},${P(closedEnd[1])}`} fill="none" stroke="#9a948a" strokeWidth={0.6} strokeDasharray="3 2" />
            </g>
          );
        })}
        {apartment.railings.map((r, i) => (
          <line key={i} x1={P(r.a[0])} y1={P(r.a[1])} x2={P(r.b[0])} y2={P(r.b[1])} style={{ stroke: "var(--plan-opening)" }} strokeWidth={2} strokeDasharray="6 2" pointerEvents="none" />
        ))}
        {/* Raumstempel: Name, Nummer, Fläche und bei Rechteckräumen die lichten Maße */}
        {apartment.rooms.map((r) => {
          const c = polygonCentroid(r.polygon);
          const fs = Math.max(9, Math.min(16, 10 / pxPerCm));
          const xs = r.polygon.map((q) => q[0]);
          const ys = r.polygon.map((q) => q[1]);
          const rect = r.polygon.length === 4;
          const dimTxt = rect ? `${(Math.max(...xs) - Math.min(...xs)).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${(Math.max(...ys) - Math.min(...ys)).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` : null;
          return (
            <g key={`l${r.id}`} pointerEvents="none" opacity={0.85}>
              <text x={P(c[0])} y={P(c[1])} fontSize={fs} textAnchor="middle" style={{ fill: "var(--plan-label)", paintOrder: "stroke", stroke: "var(--plan-bg)", strokeOpacity: 0.55, strokeWidth: fs * 0.25 }} fontFamily={FONT} fontWeight={650} letterSpacing={1.4}>
                {roomNames[r.id].toUpperCase()}
              </text>
              <text x={P(c[0])} y={P(c[1]) + fs * 1.15} fontSize={fs * 0.78} textAnchor="middle" style={{ fill: "var(--plan-label-sub)" }} fontFamily={FONT}>
                {r.id} · {r.area.toLocaleString("de-DE", { maximumFractionDigits: 2 })} m²
              </text>
              {showDims && dimTxt && (
                <text x={P(c[0])} y={P(c[1]) + fs * 2.15} fontSize={fs * 0.7} textAnchor="middle" style={{ fill: "var(--plan-label-sub)" }} fontFamily={FONT} opacity={0.85}>
                  {dimTxt}
                </text>
              )}
            </g>
          );
        })}
        {/* Abstandsmaße zur Wand – anklicken setzt einen exakten Abstand */}
        {dims.map((d, i) => {
          const mx = (d.a[0] + d.b[0]) / 2, my = (d.a[1] + d.b[1]) / 2;
          const k = Math.max(1, 1.1 / Math.max(0.35, pxPerCm));
          const editable = !!selItem && !selItem.locked;
          return (
            <g key={i}>
              <line x1={P(d.a[0])} y1={P(d.a[1])} x2={P(d.b[0])} y2={P(d.b[1])} stroke="#dc6b2f" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              <circle cx={P(d.b[0])} cy={P(d.b[1])} r={1.6 * k} fill="#dc6b2f" pointerEvents="none" />
              <g
                transform={`translate(${P(mx)},${P(my)}) scale(${k})`}
                style={{ cursor: editable ? "text" : "default" }}
                data-noexport-hover
                onPointerDown={(e) => {
                  if (e.button !== 0 || !editable) return;
                  e.stopPropagation();
                  setEditDim({ i, value: fmtCm(d.len) });
                }}
              >
                <title>{editable ? "Abstand zur Wand – anklicken und exakten Wert in cm eingeben" : "Abstand zur Wand"}</title>
                <rect x={-17} y={-7.5} width={34} height={14} rx={7} fill="#fff" stroke="#dc6b2f" strokeWidth={0.7} />
                <text x={0} y={3.2} fontSize={8.5} textAnchor="middle" fill="#b45309" fontFamily={FONT} fontWeight={650}>
                  {fmtCm(d.len)}
                </text>
              </g>
            </g>
          );
        })}
        {/* Griffe der Auswahl */}
        {selItem && !selItem.locked && (
          <g transform={`translate(${P(selItem.x)},${P(selItem.y)}) rotate(${selItem.rot})`}>
            <line x1={0} y1={-P(selItem.d) / 2 - 2} x2={0} y2={-P(selItem.d) / 2 - 20} stroke={SEL} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={0} cy={-P(selItem.d) / 2 - 26} r={6.5} fill="#fff" stroke={SEL} strokeWidth={1.5} data-handle="rot" style={{ cursor: "grab" }} />
            <path d={`M-2.6 ${-P(selItem.d) / 2 - 27.5}a3 3 0 1 1 0.4 3`} fill="none" stroke={SEL} strokeWidth={1} pointerEvents="none" />
            {getCatalogItem(selItem.catalogId)?.resizable !== false &&
              ([
                ["r", P(selItem.w) / 2, 0],
                ["l", -P(selItem.w) / 2, 0],
                ["f", 0, P(selItem.d) / 2],
                ["b", 0, -P(selItem.d) / 2],
              ] as const).map(([k, x, y]) => <rect key={k} x={x - 4} y={y - 4} width={8} height={8} rx={2} fill="#fff" stroke={SEL} strokeWidth={1.5} data-handle={k} style={{ cursor: k === "l" || k === "r" ? "ew-resize" : "ns-resize" }} />)}
          </g>
        )}
        {/* Platzierungsvorschau */}
        {ghost && (
          <g transform={`translate(${P(ghost.it.x)},${P(ghost.it.y)}) rotate(${ghost.it.rot})`} opacity={0.7} pointerEvents="none">
            <PlanSymbol it={ghost.it} arch={ghost.arch} />
            <rect x={-P(ghost.it.w) / 2} y={-P(ghost.it.d) / 2} width={P(ghost.it.w)} height={P(ghost.it.d)} rx={2} fill={SEL} fillOpacity={0.06} stroke={SEL} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
          </g>
        )}
        {/* Hilfslinien Wandfang */}
        {[...snapGuides, ...(ghost?.guides ?? [])].map((g, i) => (
          <line key={i} x1={P(g.a[0])} y1={P(g.a[1])} x2={P(g.b[0])} y2={P(g.b[1])} stroke="#16a34a" strokeWidth={3} strokeLinecap="round" opacity={0.9} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ))}
        {drag?.kind === "marquee" && (
          <rect x={P(Math.min(drag.p0[0], drag.p1[0]))} y={P(Math.min(drag.p0[1], drag.p1[1]))} width={P(Math.abs(drag.p1[0] - drag.p0[0]))} height={P(Math.abs(drag.p1[1] - drag.p0[1]))} fill={SEL} fillOpacity={0.08} stroke={SEL} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )}
        {measure.a && (
          <g pointerEvents="none">
            <line x1={P(measure.a[0])} y1={P(measure.a[1])} x2={P((measure.b ?? cursor ?? measure.a)[0])} y2={P((measure.b ?? cursor ?? measure.a)[1])} stroke="#7c3aed" strokeWidth={1.2} strokeDasharray="5 3" />
            {(() => {
              const b = measure.b ?? cursor ?? measure.a;
              const L = Math.hypot(b[0] - measure.a[0], b[1] - measure.a[1]);
              return (
                <text x={P((measure.a[0] + b[0]) / 2)} y={P((measure.a[1] + b[1]) / 2) - 6} fontSize={11} textAnchor="middle" fill="#6d28d9" fontWeight={700} fontFamily={FONT} style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>
                  {fmtCm(L)} cm
                </text>
              );
            })()}
          </g>
        )}
      </svg>
      {/* Werkzeugleiste */}
      <div className="toolbar absolute left-3 top-3 whitespace-nowrap" role="toolbar" aria-label="Planwerkzeuge">
        <button className="tool" data-on={measure.on} onClick={() => setMeasure((m) => ({ on: !m.on }))} title="Messen: zwei Punkte anklicken (M)">
          <Ruler size={14} /> <span className="hidden @[620px]:inline">Messen</span>
        </button>
        <button className="tool" data-on={showLabels} onClick={() => setShowLabels((v) => !v)} title="Positionsnummern der Einkaufsliste einblenden">
          <Hash size={14} /> <span className="hidden @[620px]:inline">Pos.-Nr.</span>
        </button>
        <button className="tool" data-on={showClearance} onClick={() => useEditor.getState().set("showClearance", !showClearance)} title="Bewegungsflächen, Türschwenkbereiche und Balkonzugänge einblenden (grün = ausreichend, gelb = eng, rot = zu wenig)">
          <SquareDashed size={14} /> <span className="hidden @[620px]:inline">Freiflächen</span>
        </button>
        <button className="tool" data-on={showDims} onClick={() => useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, showDimensions: !showDims } } }))} title="Raummaße in den Raumstempeln">
          <Ratio size={14} /> <span className="hidden @[620px]:inline">Maße</span>
        </button>
      </div>
      {/* Nordpfeil */}
      <div className="glass absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full" title={`Norden (${north}° – unter Darstellung 3D einstellbar)`}>
        <svg width={30} height={30} viewBox="-15 -15 30 30" style={{ transform: `rotate(${north}deg)` }} aria-hidden>
          <path d="M0 -11L5 4L0 1.5L-5 4Z" fill="var(--ui-accent)" />
          <path d="M0 11L5 4L0 1.5L-5 4Z" fill="currentColor" className="text-stone-400" opacity={0.6} />
          <text y={-5.5} fontSize={0} />
        </svg>
        <span className="pointer-events-none absolute top-0.5 text-[8px] font-bold text-accent-ink" style={{ transform: `rotate(${north}deg) translateY(-1px)`, transformOrigin: "50% 21px" }}>
          N
        </span>
      </div>
      {/* Zoom */}
      <div className="toolbar absolute bottom-3 right-3" role="toolbar" aria-label="Zoom">
        <button className="tool w-7 px-0" onClick={() => zoomBy(1.25)} title="Verkleinern (−)">
          <Minus size={14} />
        </button>
        <button className="tool w-14 whitespace-nowrap px-0 tabular-nums" onClick={fit} title="Ganze Wohnung einpassen (F)">
          {Math.round((fitW.current / vb[2]) * 100)} %
        </button>
        <button className="tool w-7 px-0" onClick={() => zoomBy(1 / 1.25)} title="Vergrößern (+)">
          <Plus size={14} />
        </button>
        <div className="mx-0.5 h-4 w-px bg-stone-500/20" />
        <button className="tool w-7 px-0" onClick={fit} title="Einpassen (F)">
          <Maximize size={14} />
        </button>
      </div>
      {/* Statuszeile */}
      <div className="glass pointer-events-none absolute bottom-3 left-3 flex h-9 items-center gap-3 rounded-xl px-3 text-[11px] text-stone-600">
        <span className="hidden w-36 font-mono tabular-nums @[560px]:inline">{cursor ? `x ${cursor[0].toFixed(2)} · y ${cursor[1].toFixed(2)} m` : "–"}</span>
        <ScaleBar pxPerCm={pxPerCm} />
        {conflicts.size > 0 && <span className="font-medium whitespace-nowrap text-red-700">{conflicts.size} <span className="hidden @[720px]:inline">Objekte überschneiden sich</span><span className="@[720px]:hidden">Überschneidungen</span></span>}
        {checks.findings.length > 0 && (
          <button className="pointer-events-auto font-medium whitespace-nowrap text-amber-700 hover:underline" onClick={() => useEditor.setState({ leftTab: "planung", showClearance: true })}>
            <span className="hidden @[640px]:inline">Planungs-Check: </span>
            {checks.findings.length} {checks.findings.length === 1 ? "Hinweis" : "Hinweise"}
          </button>
        )}
      </div>
      {/* Exakten Abstand eingeben */}
      {editDim && selItem && dims[editDim.i] && (() => {
        const d = dims[editDim.i];
        const [sx, sy] = toView([(d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2]);
        const apply = () => {
          const v = Number(editDim.value.replace(",", ".")) / 100;
          setEditDim(null);
          if (!Number.isFinite(v) || v < 0 || v > 10) return;
          const delta = d.len - v;
          useEditor.getState().updateItems([selItem.id], (it) => {
            it.x += d.d[0] * delta;
            it.y += d.d[1] * delta;
          }, { label: "Abstand zur Wand setzen" });
        };
        return (
          <div className="glass-strong pop-in absolute z-10 flex items-center gap-1 rounded-lg p-1 text-xs" style={{ left: sx - 60, top: sy - 18 }}>
            <input
              autoFocus
              className="field w-16 py-0.5 text-right tabular-nums"
              value={editDim.value}
              onChange={(e) => setEditDim({ ...editDim, value: e.target.value })}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
                if (e.key === "Escape") setEditDim(null);
                e.stopPropagation();
              }}
              aria-label="Abstand zur Wand in cm"
            />
            <span className="text-stone-500">cm</span>
            <button className="btn-primary px-2 py-0.5 text-xs" onClick={apply}>
              OK
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function ScaleBar({ pxPerCm }: { pxPerCm: number }) {
  const target = 120;
  const cands = [10, 20, 50, 100, 200, 500];
  const cm = cands.find((c) => c * pxPerCm >= target * 0.5) ?? 500;
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className="inline-block h-1.5 border-x border-b border-stone-500 transition-[width] duration-150" style={{ width: cm * pxPerCm }} />
      {cm >= 100 ? `${cm / 100} m` : `${cm} cm`}
    </span>
  );
}
