// Ansichtsfenster: Aufteilung nach useLayout, verschiebbare Teiler, Kopfzeile je Fenster (Art, Kamera,
// Wände, Licht, Darstellung, Maximieren) – angelehnt an die Viewports von CAD- und Planungsprogrammen.
import { lazy, Suspense, useRef, useState } from "react";
import { Box, Camera, Columns2, DoorOpen, Footprints, Layers2, Maximize2, Minimize2, Moon, PanelRight, Rotate3d, SlidersHorizontal, Square, Sun, Map as MapIcon } from "lucide-react";
import { useEditor } from "../store/project";
import { Plan2D } from "../plan/Plan2D";
import { Menu, MenuItem, MenuLabel, MenuSep, Seg } from "./kit";
import { dividers, LAYOUTS, matchingView, paneRects, VIEW_PRESETS, visiblePanes, useLayout, type Camera3D, type Divider, type LayoutId, type PaneKind, type Rect, type ViewPreset, type WallMode } from "./layout";
import roomShots from "../data/roomShots.json";

const Scene3D = lazy(() => import("../three/Scene3D").then((m) => ({ default: m.Scene3D })));

export const WALL_LABELS: Record<WallMode, { short: string; long: string }> = {
  auto: { short: "Auto", long: "Automatisch – verdeckende Wände gekappt" },
  full: { short: "Voll", long: "Raumhoch" },
  cut: { short: "Schnitt", long: "Schnitt in 1,30 m Höhe" },
  low: { short: "Flach", long: "Nur Sockel (Grundriss in 3D)" },
};

export const KIND_LABEL: Record<PaneKind, string> = { plan: "2D-Plan", "3d": "3D-Ansicht" };
export const CAMERA_LABEL: Record<Camera3D, string> = { orbit: "Modell", top: "Draufsicht", walk: "Rundgang" };

const FULL: Rect = { l: 0, t: 0, w: 1, h: 1 };
const pct = (v: number) => `${(v * 100).toFixed(4)}%`;
/** Halber Abstand zwischen benachbarten Fenstern (px): die Lücke trägt den Teiler mit seinem Griff. */
const GAP = 5;
const EDGE = 0.001;
/** Lage eines Fensters mit Lücke zu den Nachbarn (Außenkanten bleiben bündig). */
function paneBox(r: Rect): React.CSSProperties {
  const gl = r.l > EDGE ? GAP : 0, gr = r.l + r.w < 1 - EDGE ? GAP : 0;
  const gt = r.t > EDGE ? GAP : 0, gb = r.t + r.h < 1 - EDGE ? GAP : 0;
  return { left: `calc(${pct(r.l)} + ${gl}px)`, top: `calc(${pct(r.t)} + ${gt}px)`, width: `calc(${pct(r.w)} - ${gl + gr}px)`, height: `calc(${pct(r.h)} - ${gt + gb}px)` };
}

export function Viewports() {
  const layout = useLayout((s) => s.layout);
  const solo = useLayout((s) => s.solo);
  const split = useLayout((s) => s.split);
  const maximized = useLayout((s) => s.maximized);
  const box = useRef<HTMLElement>(null);
  const vis = visiblePanes({ layout, solo });
  const rects = paneRects(layout, split);
  const multi = vis.length > 1;
  return (
    <main ref={box} className="glass viewports relative min-w-0 flex-1 overflow-hidden rounded-xl" aria-label="Ansichten" data-layout={layout} data-multi={multi && maximized == null}>
      {vis.map((i, k) => (
        <Pane key={i} index={i} rect={maximized === i ? FULL : rects[k]} hidden={maximized != null && maximized !== i} multi={multi} />
      ))}
      {maximized == null && dividers(layout, split).map((d, k) => <SplitHandle key={`${layout}-${k}`} d={d} box={box} grips={layout === "quad" ? [0.25, 0.75] : [0.5]} />)}
      {maximized == null && layout === "quad" && <CrossHandle box={box} />}
    </main>
  );
}

function Pane({ index, rect, hidden, multi }: { index: number; rect: Rect; hidden: boolean; multi: boolean }) {
  const kind = useLayout((s) => s.panes[index].kind);
  const active = useLayout((s) => s.active === index);
  const [tools, setTools] = useState<HTMLDivElement | null>(null);
  return (
    <section
      data-pane={index}
      data-kind={kind}
      data-active={active && multi}
      aria-label={`Fenster ${index + 1}: ${KIND_LABEL[kind]}`}
      className={`pane absolute flex flex-col overflow-hidden ${multi ? "rounded-lg" : ""}`}
      style={{ ...paneBox(rect), visibility: hidden ? "hidden" : undefined, zIndex: hidden ? 0 : 1 }}
      onPointerDownCapture={() => useLayout.getState().activate(index)}
      onFocusCapture={() => useLayout.getState().activate(index)}
    >
      <PaneHeader index={index} multi={multi} toolsRef={setTools} />
      <div className="@container relative min-h-0 flex-1" style={kind === "3d" ? { background: "var(--scene-bg)" } : undefined}>
        {kind === "plan" ? (
          <Plan2D pane={index} tools={tools} />
        ) : (
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-stone-500">3D-Ansicht wird geladen …</div>}>
            <Scene3D pane={index} hidden={hidden} />
          </Suspense>
        )}
        {kind === "3d" && <WalkHint index={index} />}
      </div>
    </section>
  );
}

function WalkHint({ index }: { index: number }) {
  const cam = useLayout((s) => s.panes[index].camera);
  if (cam !== "walk") return null;
  return (
    <div className="glass-strong pointer-events-none absolute bottom-3 left-1/2 max-w-[calc(100%-24px)] -translate-x-1/2 truncate rounded-full px-3.5 py-1.5 text-xs text-stone-700">
      Rundgang: hineinklicken · Maus = umsehen · W A S D = gehen · Umschalt = schneller · Esc = Maus freigeben
    </div>
  );
}

// ---------------------------------------------------------------- Kopfzeile eines Fensters

function PaneHeader({ index, multi, toolsRef }: { index: number; multi: boolean; toolsRef: (el: HTMLDivElement | null) => void }) {
  const conf = useLayout((s) => s.panes[index]);
  const maximized = useLayout((s) => s.maximized === index);
  const set = (p: Parameters<ReturnType<typeof useLayout.getState>["setPane"]>[1]) => useLayout.getState().setPane(index, p);
  return (
    <div
      className="pane-bar @container flex h-9 shrink-0 items-center gap-1 overflow-hidden px-1.5"
      onDoubleClick={(e) => {
        if (multi && e.target === e.currentTarget) useLayout.getState().toggleMaximize(index);
      }}
    >
      <Menu
        className="pane-kind btn-ghost h-7 gap-1 px-1.5 text-xs font-semibold"
        icon={conf.kind === "plan" ? <MapIcon size={14} /> : <Box size={14} />}
        label={<span className="hidden whitespace-nowrap @[300px]:inline">{KIND_LABEL[conf.kind]}</span>}
        title={`Fenster ${index + 1}: Ansichtsart wählen`}
      >
        <MenuLabel>Fenster {index + 1} zeigt</MenuLabel>
        <MenuItem checked={conf.kind === "plan"} onClick={() => set({ kind: "plan" })}>
          2D-Plan
        </MenuItem>
        <MenuItem checked={conf.kind === "3d"} onClick={() => set({ kind: "3d" })}>
          3D-Ansicht
        </MenuItem>
        {multi && (
          <>
            <MenuSep />
            <MenuItem icon={maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />} kbd="Strg+Leertaste" onClick={() => useLayout.getState().toggleMaximize(index)}>
              {maximized ? "Aufteilung wiederherstellen" : "Fenster maximieren"}
            </MenuItem>
          </>
        )}
      </Menu>
      <div className="mx-0.5 h-4 w-px shrink-0 bg-stone-500/20" />
      {conf.kind === "3d" ? <Tools3D index={index} /> : <div ref={toolsRef} className="flex min-w-0 items-center gap-0.5" />}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {conf.kind === "3d" && (
          <button className="btn-ghost h-7 w-7 p-0" data-on={conf.panel} aria-pressed={conf.panel} title={conf.panel ? "Ansichtsleiste ausblenden" : "Ansichtsleiste: Sonne, Licht, Kamera, Raumfotos, Foto"} onClick={() => set({ panel: !conf.panel })}>
            <PanelRight size={15} className={conf.panel ? "text-accent-ink" : ""} />
          </button>
        )}
        {multi && (
          <button className="btn-ghost h-7 w-7 p-0" title={maximized ? "Aufteilung wiederherstellen (Strg+Leertaste)" : "Fenster maximieren (Strg+Leertaste, Doppelklick auf die Kopfzeile)"} onClick={() => useLayout.getState().toggleMaximize(index)}>
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

const fmtTime = (t: number) => `${Math.floor(t)}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;

/** Kamera, Wände, Licht und Darstellung in der Kopfzeile eines 3D-Fensters. */
function Tools3D({ index }: { index: number }) {
  const conf = useLayout((s) => s.panes[index]);
  const night = useEditor((s) => s.night);
  const settings = useEditor((s) => s.project.settings);
  const showCeiling = useEditor((s) => s.showCeiling);
  const quality = useEditor((s) => s.quality);
  const set = (p: Partial<typeof conf>) => useLayout.getState().setPane(index, p);
  const setSetting = (k: string, v: number | boolean) => useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, [k]: v } } }));
  const walk = conf.camera === "walk";
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Seg<Camera3D>
        label="Kamera"
        className="pane-seg"
        value={conf.camera}
        onChange={(v) => set({ camera: v })}
        options={[
          { value: "orbit", label: <Lbl icon={<Rotate3d size={13} />} text="Modell" />, title: "Modellansicht: links drehen, rechts verschieben, Rad zoomt" },
          { value: "top", label: <Lbl icon={<Square size={13} />} text="Oben" />, title: "Draufsicht" },
          { value: "walk", label: <Lbl icon={<Footprints size={13} />} text="Rundgang" />, title: "Rundgang auf Augenhöhe (W A S D, Maus; Esc gibt die Maus frei)" },
        ]}
      />
      <Menu
        className="btn-ghost h-7 gap-1 px-1.5 text-xs"
        icon={<Layers2 size={14} />}
        label={<span className="hidden @[560px]:inline">{walk ? "Raumhoch" : WALL_LABELS[conf.walls].short}</span>}
        title={walk ? "Wände: im Rundgang immer raumhoch" : `Wände: ${WALL_LABELS[conf.walls].long} (Taste W)`}
      >
        <MenuLabel>Wände in diesem Fenster</MenuLabel>
        {(Object.keys(WALL_LABELS) as WallMode[]).map((m) => (
          <MenuItem key={m} checked={conf.walls === m} kbd={m === "auto" ? "W" : undefined} onClick={() => set({ walls: m })}>
            {WALL_LABELS[m].long}
          </MenuItem>
        ))}
      </Menu>
      <ShotsMenu index={index} />
      <button className="btn-ghost h-7 w-7 shrink-0 p-0 @max-[300px]:hidden!" aria-pressed={night} title={night ? "Abendlicht – klicken für Tageslicht (alle 3D-Fenster)" : "Tageslicht – klicken für Abendlicht mit Leuchten (alle 3D-Fenster)"} onClick={() => useEditor.getState().set("night", !night)}>
        {night ? <Moon size={15} className="text-amber-600" /> : <Sun size={15} />}
      </button>
      <Menu icon={<SlidersHorizontal size={14} />} title="Darstellung: Sonnenstand, Türen, Decke, Qualität" keepOpen className="btn-ghost h-7 w-7 p-0 @max-[340px]:hidden!" chevron={false}>
        <div className="w-72 space-y-3 p-2.5 text-sm text-stone-700">
          <div className="panel-title">Darstellung 3D (alle Fenster)</div>
          <label className={`block ${night ? "opacity-40" : ""}`}>
            <span className="flex justify-between text-xs text-stone-500">
              Sonnenstand <span className="tabular-nums text-stone-700">{fmtTime(settings.timeOfDay ?? 15)} Uhr</span>
            </span>
            <input type="range" min={7} max={19.5} step={0.25} disabled={night} value={settings.timeOfDay ?? 15} onChange={(e) => setSetting("timeOfDay", Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <DoorOpen size={15} className="text-stone-500" /> Türen geöffnet
            </span>
            <input type="checkbox" className="switch" checked={(settings.doorsOpen ?? 0) > 0.5} onChange={(e) => setSetting("doorsOpen", e.target.checked ? 0.9 : 0)} />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span>Decke anzeigen</span>
            <input type="checkbox" className="switch" checked={showCeiling} onChange={(e) => useEditor.getState().set("showCeiling", e.target.checked)} />
          </label>
          <label className="block">
            <span className="text-xs text-stone-500">Darstellungsqualität</span>
            <select className="field mt-1 text-sm" value={quality} onChange={(e) => useEditor.getState().set("quality", e.target.value as typeof quality)}>
              <option value="hoch">Hoch (Umgebungsverdeckung, Glanz)</option>
              <option value="mittel">Mittel</option>
              <option value="niedrig">Schnell (schwächere Grafik)</option>
            </select>
          </label>
        </div>
      </Menu>
    </div>
  );
}

type Shot = { id: string; name: string; pos: [number, number, number]; target: [number, number, number]; fov: number };
const SHOTS = roomShots as unknown as Shot[];

/** Raumfotos direkt in der Kopfzeile: kuratierte Blickwinkel anschwenken (Speichern in der Ansichtsleiste). */
function ShotsMenu({ index }: { index: number }) {
  const go = (s: Shot) => void import("./View3DPanel").then((m) => m.flyToShot(s as Parameters<typeof m.flyToShot>[0], index));
  return (
    <Menu
      className="btn-ghost h-7 gap-1 px-1.5 text-xs"
      icon={<Camera size={14} />}
      label={<span className="hidden @[640px]:inline">Raumfotos</span>}
      title="Raumfotos: vorgefertigte Blickwinkel je Raum anschwenken"
      chevron={false}
    >
      <MenuLabel>Raumfotos – Blickwinkel anschwenken</MenuLabel>
      {SHOTS.map((s) => (
        <MenuItem key={s.id} onClick={() => go(s)}>
          {s.name}
        </MenuItem>
      ))}
      <MenuSep />
      <MenuItem icon={<PanelRight size={14} />} onClick={() => useLayout.getState().setPane(index, { panel: true })}>
        Als Bild speichern … (Ansichtsleiste)
      </MenuItem>
    </Menu>
  );
}

function Lbl({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      <span className="hidden @[540px]:inline">{text}</span>
    </span>
  );
}

// ---------------------------------------------------------------- Teiler

/** Anteil (0–1) der Mausposition im Ansichtsbereich. */
function fraction(box: React.RefObject<HTMLElement | null>, e: { clientX: number; clientY: number }, axis: "x" | "y") {
  const r = box.current!.getBoundingClientRect();
  return axis === "x" ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
}

function SplitHandle({ d, box, grips }: { d: Divider; box: React.RefObject<HTMLElement | null>; grips: number[] }) {
  const split = useLayout((s) => s.split);
  const [drag, setDrag] = useState(false);
  const v = split[d.axis];
  const vert = d.axis === "x";
  const style: React.CSSProperties = vert ? { left: pct(v), top: pct(d.from), height: pct(d.to - d.from) } : { top: pct(v), left: pct(d.from), width: pct(d.to - d.from) };
  const end = () => {
    setDrag(false);
    document.documentElement.style.cursor = "";
    document.documentElement.classList.remove("split-dragging");
  };
  const a = Math.round(v * 100);
  return (
    <div
      role="separator"
      aria-orientation={vert ? "vertical" : "horizontal"}
      aria-label={vert ? "Senkrechter Fensterteiler" : "Waagerechter Fensterteiler"}
      aria-valuenow={a}
      aria-valuemin={12}
      aria-valuemax={88}
      tabIndex={0}
      title={drag ? undefined : "Ziehen: Fenstergröße ändern · Doppelklick: halbe-halbe · Pfeiltasten: in Schritten"}
      data-drag={drag}
      data-axis={d.axis}
      className={`split-handle group absolute z-20 touch-none outline-none ${vert ? "-ml-[7px] w-[14px] cursor-col-resize" : "-mt-[7px] h-[14px] cursor-row-resize"}`}
      style={style}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        document.documentElement.style.cursor = vert ? "col-resize" : "row-resize";
        document.documentElement.classList.add("split-dragging");
      }}
      onPointerMove={(e) => drag && useLayout.getState().setSplit(d.axis, fraction(box, e, d.axis))}
      onPointerUp={end}
      onLostPointerCapture={end}
      onDoubleClick={() => useLayout.getState().setSplit(d.axis, 0.5)}
      onKeyDown={(e) => {
        const keys = vert ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
        if (!keys.includes(e.key)) return;
        e.preventDefault();
        useLayout.getState().setSplit(d.axis, v + (e.key === keys[1] ? 1 : -1) * (e.shiftKey ? 0.1 : 0.02));
      }}
    >
      <div className={`split-line absolute ${vert ? "inset-y-1 left-1/2 w-[2px] -translate-x-1/2" : "inset-x-1 top-1/2 h-[2px] -translate-y-1/2"}`} />
      {grips.map((g) => (
        <div key={g} className={`split-grip absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${vert ? "left-1/2 h-10 w-[6px]" : "top-1/2 h-[6px] w-10"}`} style={vert ? { top: pct(g) } : { left: pct(g) }} />
      ))}
      {drag && (
        <div className={`glass-strong pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-stone-800 tabular-nums shadow-lg ${vert ? "" : ""}`}>
          {vert ? `${a} % | ${100 - a} %` : `${a} % / ${100 - a} %`}
        </div>
      )}
    </div>
  );
}

/** Kreuzungspunkt der Vier-Fenster-Aufteilung: verschiebt beide Teiler zugleich. */
function CrossHandle({ box }: { box: React.RefObject<HTMLElement | null> }) {
  const split = useLayout((s) => s.split);
  const [drag, setDrag] = useState(false);
  return (
    <div
      aria-hidden
      title="Ziehen: beide Teiler verschieben · Doppelklick: vier gleiche Fenster"
      data-drag={drag}
      className="split-cross absolute z-30 -mt-2.5 -ml-2.5 h-5 w-5 touch-none cursor-move rounded-full"
      style={{ left: pct(split.x), top: pct(split.y) }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        document.documentElement.style.cursor = "move";
      }}
      onLostPointerCapture={() => {
        setDrag(false);
        document.documentElement.style.cursor = "";
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const s = useLayout.getState();
        s.setSplit("x", fraction(box, e, "x"));
        s.setSplit("y", fraction(box, e, "y"));
      }}
      onPointerUp={() => {
        setDrag(false);
        document.documentElement.style.cursor = "";
      }}
      onDoubleClick={() => {
        useLayout.getState().setSplit("x", 0.5);
        useLayout.getState().setSplit("y", 0.5);
      }}
    />
  );
}

// ---------------------------------------------------------------- Aufteilungswahl (Kopfleiste, Menü)

/** Kleines Schema einer Aufteilung (wie die Viewport-Layouts in CAD-Programmen). */
export function LayoutGlyph({ id, size = 16 }: { id: LayoutId; size?: number }) {
  const rects = paneRects(id, { x: 0.5, y: 0.5 });
  const big = id === "left3" ? { x: 0.58, y: 0.5 } : id === "top3" ? { x: 0.5, y: 0.58 } : { x: 0.5, y: 0.5 };
  const r = id === "left3" || id === "top3" ? paneRects(id, big) : rects;
  const W = 16, H = 12, g = 1.2;
  return (
    <svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0">
      {r.map((q, i) => (
        <rect key={i} x={q.l * W + g / 2} y={q.t * H + g / 2} width={q.w * W - g} height={q.h * H - g} rx={1.2} fill="currentColor" opacity={i === 0 ? 0.9 : 0.5} />
      ))}
    </svg>
  );
}

export function LayoutMenuItems() {
  const layout = useLayout((s) => s.layout);
  return (
    <>
      {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
        <MenuItem key={id} checked={layout === id} icon={<LayoutGlyph id={id} />} onClick={() => useLayout.getState().setLayout(id)}>
          {LAYOUTS[id].label}
        </MenuItem>
      ))}
    </>
  );
}

const SLOT_TEXT = (k: ViewPreset["slots"][number]) => (k.kind === "plan" ? "2D" : k.camera === "walk" ? "Gehen" : k.camera === "top" ? "Oben" : "3D");

/** Vorschau einer vorgefertigten Ansicht: Fenster mit Beschriftung (2D, 3D, Oben, Gehen). */
export function ViewGlyph({ v, width = 72 }: { v: ViewPreset; width?: number }) {
  const W = 72, H = 46, g = 2;
  const r = paneRects(v.layout, v.split ?? { x: 0.5, y: 0.5 });
  return (
    <svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0">
      {r.map((q, i) => {
        const slot = v.slots[i];
        const x = q.l * W + g / 2, y = q.t * H + g / 2, w = q.w * W - g, h = q.h * H - g;
        const is3d = slot.kind === "3d";
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={3} className={is3d ? "fill-accent/25 stroke-accent" : "fill-card stroke-stone-400"} strokeWidth={1} />
            <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" fontSize={w < 30 ? 7 : 9} fontWeight={600} className={is3d ? "fill-accent-ink" : "fill-stone-600"}>
              {SLOT_TEXT(slot)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * „Ansichten“ in der Kopfleiste: vorgefertigte Ansichten als Vorschaukacheln (Aufteilung + Belegung),
 * darunter die reinen Aufteilungen und der Hinweis auf die ziehbaren Teiler.
 */
export function LayoutPicker() {
  const st = useLayout();
  const current = matchingView(st);
  const maximized = st.maximized;
  const cur = VIEW_PRESETS.find((v) => v.id === current);
  return (
    <Menu
      className="btn-ghost h-8 gap-1.5 px-2 text-sm font-medium"
      icon={<LayoutGlyph id={st.layout} size={18} />}
      label={<span className="whitespace-nowrap">Ansichten</span>}
      title={`Vorgefertigte Ansichten und Aufteilung${cur ? ` – aktuell: ${cur.label}` : ""}`}
    >
      <div className="w-[min(560px,calc(100vw-24px))] p-1.5">
        <MenuLabel>Vorgefertigte Ansichten</MenuLabel>
        <div className="grid grid-cols-5 gap-1.5 px-1 pb-1">
          {VIEW_PRESETS.map((v) => (
            <button
              key={v.id}
              role="menuitemradio"
              aria-checked={current === v.id}
              data-on={current === v.id}
              title={`${v.hint}${v.kbd ? ` (Taste ${v.kbd})` : ""}`}
              className="view-tile flex flex-col items-center gap-1 rounded-lg p-1.5 text-center text-[11px] leading-tight font-medium text-stone-700 outline-none"
              onClick={() => useLayout.getState().applyView(v.id)}
            >
              <ViewGlyph v={v} width={84} />
              <span className="flex items-center gap-1">
                {v.label}
                {v.kbd && <kbd className="text-[10px]">{v.kbd}</kbd>}
              </span>
            </button>
          ))}
        </div>
        <MenuSep />
        <MenuLabel>Nur Aufteilung ändern (Fensterinhalt bleibt)</MenuLabel>
        <div className="flex flex-wrap gap-1 px-1 pb-1">
          {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
            <button key={id} role="menuitemradio" aria-checked={st.layout === id} data-on={st.layout === id} title={LAYOUTS[id].label} className="view-tile flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-stone-700 outline-none" onClick={() => useLayout.getState().setLayout(id)}>
              <LayoutGlyph id={id} size={20} />
              <span className="hidden min-[1400px]:inline">{LAYOUTS[id].label.replace("Drei: ", "")}</span>
            </button>
          ))}
        </div>
        <MenuSep />
        <div className="px-2.5 py-1.5 text-xs leading-relaxed text-stone-500">
          <b className="text-stone-700">Fenstergröße:</b> den Griff zwischen zwei Fenstern ziehen (Doppelklick = halbe-halbe). <b className="text-stone-700">Inhalt:</b> in der Kopfzeile jedes Fensters 2D-Plan oder 3D wählen.
        </div>
        <MenuItem icon={<Columns2 size={14} />} onClick={() => useLayout.getState().evenSplit()}>
          Fenster gleich groß
        </MenuItem>
        {maximized != null && (
          <MenuItem icon={<Minimize2 size={14} />} kbd="Strg+Leertaste" onClick={() => useLayout.getState().toggleMaximize(maximized)}>
            Aufteilung wiederherstellen
          </MenuItem>
        )}
      </div>
    </Menu>
  );
}
