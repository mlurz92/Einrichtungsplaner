import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apartment, roomNames, wallFaces } from "../data";
import { useEditor, getCatalogItem, newItemFromCatalog } from "../store/project";
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
import { DND_TYPE, type CatalogDrop } from "../ui/dnd";
import { applyPlacementSnap, beginDrag, dragUpdate, isFlatFloorItem, type DragStart } from "../store/placement";
import { pointer } from "../ui/pointer";

const S = 100; // SVG-Einheit = cm
const P = (v: number) => v * S;
const pts = (poly: Vec2[]) => poly.map(([x, y]) => `${P(x)},${P(y)}`).join(" ");

const FLOOR_FILL: Record<string, string> = { planks: "#efe3cf", herringbone: "#efe3cf", chevron: "#efe3cf", tiles: "#eceae6", deck: "#e6dccd", stone: "#ece6db", carpet: "#e7e2da", microcement: "#e2e0dc", terrazzo: "#e6e1d8" };
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
      {(selected || hovered || conflict) && (
        <rect x={-P(it.w) / 2 - 1.5} y={-P(it.d) / 2 - 1.5} width={P(it.w) + 3} height={P(it.d) + 3} fill="none" stroke={conflict && !selected ? "#dc2626" : selected ? "#2563eb" : "#60a5fa"} strokeWidth={selected ? 1.6 : 1} strokeDasharray={conflict && !selected ? "3 2" : undefined} vectorEffect="non-scaling-stroke" />
      )}
      {showLabel && it.pos && (
        <g transform={`rotate(${-it.rot})`} pointerEvents="none">
          <rect x={-it.pos.length * 3.3 - 4} y={-7} width={it.pos.length * 6.6 + 8} height={14} rx={7} fill="#2f3a31" opacity={0.85} />
          <text x={0} y={4} fontSize={10} textAnchor="middle" fill="#fff" fontFamily="Inter, system-ui" fontWeight={600}>
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<[number, number, number, number]>([-60, -60, 1650, 1800]);
  const [drag, setDrag] = useState<Drag>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [measure, setMeasure] = useState<{ on: boolean; a?: Vec2; b?: Vec2 }>({ on: false });
  const [showLabels, setShowLabels] = useState(true);
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
    setVb([P(bx0) - 60 - (vw - W) / 2, P(by0) - 60 - (vh - H) / 2, vw, vh]);
  }, [size]);
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

  const items = project.items;
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

  const onUp = () => {
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
      if (e.key === "f" && !e.ctrlKey) fit();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [fit]);

  // ---------------------------------------------------------------- Abstandsmaße der Auswahl
  const selItem = selection.length === 1 ? items.find((i) => i.id === selection[0]) : undefined;
  const dims = useMemo(() => {
    if (!selItem || selItem.mount !== "floor") return [];
    const out: { a: Vec2; b: Vec2; len: number }[] = [];
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
      if (t !== null && t > 0.005) out.push({ a: o, b: [o[0] + d[0] * t, o[1] + d[1] * t], len: t });
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
    <div className="relative h-full w-full select-none overflow-hidden bg-[#f6f4f0]" onContextMenu={(e) => e.preventDefault()}>
      <svg
        ref={svgRef}
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
            <path d="M10 0H0V10" fill="none" stroke="#e7e3dc" strokeWidth={0.3} />
          </pattern>
          <pattern id="grid100" width={100} height={100} patternUnits="userSpaceOnUse">
            <rect width={100} height={100} fill="url(#grid10)" />
            <path d="M100 0H0V100" fill="none" stroke="#dcd6cc" strokeWidth={0.6} />
          </pattern>
          <pattern id="planks" width={190} height={19} patternUnits="userSpaceOnUse">
            <path d="M0 19H190M120 0V19" stroke="#e2d2b9" strokeWidth={0.5} fill="none" />
          </pattern>
          <pattern id="tiles60" width={60} height={60} patternUnits="userSpaceOnUse">
            <path d="M60 0H0V60" stroke="#d8d4cd" strokeWidth={0.5} fill="none" />
          </pattern>
        </defs>
        <rect x={vb[0] - 5000} y={vb[1] - 5000} width={vb[2] + 10000} height={vb[3] + 10000} fill="url(#grid100)" />
        {/* Räume */}
        {apartment.rooms.map((r) => {
          const fin = project.rooms[r.id];
          const kind = fin?.floor.kind ?? "planks";
          const c = polygonCentroid(r.polygon);
          const ang = fin?.floor.angle ?? 0;
          return (
            <g key={r.id}>
              <polygon points={pts(r.polygon)} fill={FLOOR_FILL[kind] ?? "#eee"} data-room={r.id} />
              <polygon points={pts(r.polygon)} fill={`url(#${kind === "tiles" ? "tiles60" : "planks"})`} transform={kind === "tiles" ? undefined : `rotate(${ang} ${P(c[0])} ${P(c[1])})`} pointerEvents="none" opacity={0.9} />
            </g>
          );
        })}
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
        {/* Objekte */}
        {sortedItems.map((it) => (
          <ItemSym key={it.id} it={it} selected={sel.has(it.id)} hovered={hoverId === it.id} conflict={conflicts.has(it.id)} showLabel={labelVisible} />
        ))}
        {/* Wände */}
        {WALL_POLY.map((w, i) => (
          <polygon key={i} points={pts(w)} fill="#2a2826" pointerEvents="none" />
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
                <polygon points={pts(o.reveal)} fill="#ffffff" />
                {[-0.025, 0.025].map((k) => (
                  <line key={k} x1={P(a[0] + sh[0] + n[0] * k)} y1={P(a[1] + sh[1] + n[1] * k)} x2={P(b[0] + sh[0] + n[0] * k)} y2={P(b[1] + sh[1] + n[1] * k)} stroke="#3b3d40" strokeWidth={0.8} />
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
              <polygon points={pts(o.reveal)} fill="#f6f4f0" />
              <line x1={P(h[0])} y1={P(h[1])} x2={P(leafEnd[0])} y2={P(leafEnd[1])} stroke="#3b3d40" strokeWidth={1.4} />
              <path d={`M${P(leafEnd[0])},${P(leafEnd[1])} A${P(L - 0.04)},${P(L - 0.04)} 0 0 ${sw > 0 ? 0 : 1} ${P(closedEnd[0])},${P(closedEnd[1])}`} fill="none" stroke="#9a948a" strokeWidth={0.6} strokeDasharray="3 2" />
            </g>
          );
        })}
        {apartment.railings.map((r, i) => (
          <line key={i} x1={P(r.a[0])} y1={P(r.a[1])} x2={P(r.b[0])} y2={P(r.b[1])} stroke="#3b3d40" strokeWidth={2} strokeDasharray="6 2" pointerEvents="none" />
        ))}
        {/* Raumstempel */}
        {apartment.rooms.map((r) => {
          const c = polygonCentroid(r.polygon);
          const fs = Math.max(9, Math.min(16, 10 / pxPerCm));
          return (
            <g key={`l${r.id}`} pointerEvents="none" opacity={0.75}>
              <text x={P(c[0])} y={P(c[1])} fontSize={fs} textAnchor="middle" fill="#6b6459" fontFamily="Inter, system-ui" fontWeight={600} letterSpacing={1.5}>
                {roomNames[r.id].toUpperCase()}
              </text>
              <text x={P(c[0])} y={P(c[1]) + fs * 1.15} fontSize={fs * 0.8} textAnchor="middle" fill="#8b8478" fontFamily="Inter, system-ui">
                {r.id} · {r.area.toLocaleString("de-DE", { maximumFractionDigits: 2 })} m²
              </text>
            </g>
          );
        })}
        {/* Abstandsmaße */}
        {dims.map((d, i) => {
          const mx = (d.a[0] + d.b[0]) / 2, my = (d.a[1] + d.b[1]) / 2;
          return (
            <g key={i} pointerEvents="none">
              <line x1={P(d.a[0])} y1={P(d.a[1])} x2={P(d.b[0])} y2={P(d.b[1])} stroke="#dc6b2f" strokeWidth={0.9} markerEnd="" vectorEffect="non-scaling-stroke" />
              <circle cx={P(d.b[0])} cy={P(d.b[1])} r={1.6} fill="#dc6b2f" />
              <rect x={P(mx) - 15} y={P(my) - 7} width={30} height={13} rx={3} fill="#fff" stroke="#dc6b2f" strokeWidth={0.6} />
              <text x={P(mx)} y={P(my) + 3.2} fontSize={8.5} textAnchor="middle" fill="#b45309" fontFamily="Inter, system-ui" fontWeight={600}>
                {fmtCm(d.len)}
              </text>
            </g>
          );
        })}
        {/* Griffe der Auswahl */}
        {selItem && !selItem.locked && (
          <g transform={`translate(${P(selItem.x)},${P(selItem.y)}) rotate(${selItem.rot})`}>
            <line x1={0} y1={-P(selItem.d) / 2} x2={0} y2={-P(selItem.d) / 2 - 22} stroke="#2563eb" strokeWidth={1} />
            <circle cx={0} cy={-P(selItem.d) / 2 - 26} r={6} fill="#fff" stroke="#2563eb" strokeWidth={1.5} data-handle="rot" style={{ cursor: "grab" }} />
            {getCatalogItem(selItem.catalogId)?.resizable !== false &&
              ([
                ["r", P(selItem.w) / 2, 0],
                ["l", -P(selItem.w) / 2, 0],
                ["f", 0, P(selItem.d) / 2],
                ["b", 0, -P(selItem.d) / 2],
              ] as const).map(([k, x, y]) => <rect key={k} x={x - 3.5} y={y - 3.5} width={7} height={7} fill="#2563eb" stroke="#fff" strokeWidth={1} data-handle={k} style={{ cursor: k === "l" || k === "r" ? "ew-resize" : "ns-resize" }} />)}
          </g>
        )}
        {/* Platzierungsvorschau */}
        {ghost && (
          <g transform={`translate(${P(ghost.it.x)},${P(ghost.it.y)}) rotate(${ghost.it.rot})`} opacity={0.7} pointerEvents="none">
            <PlanSymbol it={ghost.it} arch={ghost.arch} />
            <rect x={-P(ghost.it.w) / 2} y={-P(ghost.it.d) / 2} width={P(ghost.it.w)} height={P(ghost.it.d)} fill="none" stroke="#2563eb" strokeDasharray="4 2" />
          </g>
        )}
        {/* Hilfslinien Wandfang */}
        {[...snapGuides, ...(ghost?.guides ?? [])].map((g, i) => (
          <line key={i} x1={P(g.a[0])} y1={P(g.a[1])} x2={P(g.b[0])} y2={P(g.b[1])} stroke="#16a34a" strokeWidth={3} strokeLinecap="round" opacity={0.9} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ))}
        {drag?.kind === "marquee" && (
          <rect x={P(Math.min(drag.p0[0], drag.p1[0]))} y={P(Math.min(drag.p0[1], drag.p1[1]))} width={P(Math.abs(drag.p1[0] - drag.p0[0]))} height={P(Math.abs(drag.p1[1] - drag.p0[1]))} fill="#2563eb" fillOpacity={0.08} stroke="#2563eb" strokeDasharray="4 3" pointerEvents="none" />
        )}
        {measure.a && (
          <g pointerEvents="none">
            <line x1={P(measure.a[0])} y1={P(measure.a[1])} x2={P((measure.b ?? cursor ?? measure.a)[0])} y2={P((measure.b ?? cursor ?? measure.a)[1])} stroke="#7c3aed" strokeWidth={1.2} strokeDasharray="5 3" />
            {(() => {
              const b = measure.b ?? cursor ?? measure.a;
              const L = Math.hypot(b[0] - measure.a[0], b[1] - measure.a[1]);
              return (
                <text x={P((measure.a[0] + b[0]) / 2)} y={P((measure.a[1] + b[1]) / 2) - 6} fontSize={11} textAnchor="middle" fill="#6d28d9" fontWeight={700} fontFamily="Inter">
                  {fmtCm(L)} cm
                </text>
              );
            })()}
          </g>
        )}
      </svg>
      {/* Overlay-Bedienelemente */}
      <div className="pointer-events-auto absolute left-3 top-3 flex gap-1 rounded-lg border border-stone-200 bg-white/90 p-1 text-xs shadow-sm backdrop-blur">
        <button className={`rounded px-2 py-1 ${measure.on ? "bg-violet-600 text-white" : "hover:bg-stone-100"}`} onClick={() => setMeasure((m) => ({ on: !m.on }))} title="Messen (M)">
          Messen
        </button>
        <button className={`rounded px-2 py-1 ${showLabels ? "bg-stone-800 text-white" : "hover:bg-stone-100"}`} onClick={() => setShowLabels((v) => !v)} title="Positionsnummern">
          Pos.-Nr.
        </button>
        <button className="rounded px-2 py-1 hover:bg-stone-100" onClick={fit} title="Einpassen (F)">
          Einpassen
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-3 rounded bg-white/85 px-2 py-1 font-mono text-[11px] text-stone-600 shadow-sm">
        <span>{cursor ? `x ${cursor[0].toFixed(3)} · y ${cursor[1].toFixed(3)} m` : "–"}</span>
        <ScaleBar pxPerCm={pxPerCm} />
        {conflicts.size > 0 && <span className="text-red-600">{conflicts.size} Objekte überschneiden sich</span>}
      </div>
    </div>
  );
}

function ScaleBar({ pxPerCm }: { pxPerCm: number }) {
  const target = 120;
  const cands = [10, 20, 50, 100, 200, 500];
  const cm = cands.find((c) => c * pxPerCm >= target * 0.5) ?? 500;
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-1.5 border-x border-b border-stone-500" style={{ width: cm * pxPerCm }} />
      {cm >= 100 ? `${cm / 100} m` : `${cm} cm`}
    </span>
  );
}
