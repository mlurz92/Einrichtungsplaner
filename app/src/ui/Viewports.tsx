// Ansichtsfenster: Aufteilung nach useLayout, verschiebbare Teiler, Kopfzeile je Fenster (Art, Kamera,
// Wände, Licht, Darstellung, Maximieren) – angelehnt an die Viewports von CAD- und Planungsprogrammen.
import { lazy, Suspense, useRef, useState } from "react";
import { Box, DoorOpen, Footprints, Layers2, Maximize2, Minimize2, Moon, PanelRight, Rotate3d, SlidersHorizontal, Square, Sun, Map as MapIcon } from "lucide-react";
import { useEditor } from "../store/project";
import { Plan2D } from "../plan/Plan2D";
import { Menu, MenuItem, MenuLabel, MenuSep, Seg } from "./kit";
import { dividers, LAYOUTS, paneRects, visiblePanes, useLayout, type Camera3D, type Divider, type LayoutId, type PaneKind, type Rect, type WallMode } from "./layout";

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
    <main ref={box} className="glass relative min-w-0 flex-1 overflow-hidden rounded-xl" aria-label="Ansichten" data-layout={layout}>
      {vis.map((i, k) => (
        <Pane key={i} index={i} rect={maximized === i ? FULL : rects[k]} hidden={maximized != null && maximized !== i} multi={multi} />
      ))}
      {maximized == null && dividers(layout, split).map((d, k) => <SplitHandle key={`${layout}-${k}`} d={d} box={box} />)}
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
      className="pane absolute flex flex-col"
      style={{ left: pct(rect.l), top: pct(rect.t), width: pct(rect.w), height: pct(rect.h), visibility: hidden ? "hidden" : undefined, zIndex: hidden ? 0 : 1 }}
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
      <button className="btn-ghost h-7 w-7 shrink-0 p-0" aria-pressed={night} title={night ? "Abendlicht – klicken für Tageslicht (alle 3D-Fenster)" : "Tageslicht – klicken für Abendlicht mit Leuchten (alle 3D-Fenster)"} onClick={() => useEditor.getState().set("night", !night)}>
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

function Lbl({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      <span className="hidden @[460px]:inline">{text}</span>
    </span>
  );
}

// ---------------------------------------------------------------- Teiler

/** Anteil (0–1) der Mausposition im Ansichtsbereich. */
function fraction(box: React.RefObject<HTMLElement | null>, e: { clientX: number; clientY: number }, axis: "x" | "y") {
  const r = box.current!.getBoundingClientRect();
  return axis === "x" ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
}

function SplitHandle({ d, box }: { d: Divider; box: React.RefObject<HTMLElement | null> }) {
  const split = useLayout((s) => s.split);
  const [drag, setDrag] = useState(false);
  const v = split[d.axis];
  const vert = d.axis === "x";
  const style: React.CSSProperties = vert ? { left: pct(v), top: pct(d.from), height: pct(d.to - d.from) } : { top: pct(v), left: pct(d.from), width: pct(d.to - d.from) };
  return (
    <div
      role="separator"
      aria-orientation={vert ? "vertical" : "horizontal"}
      aria-label={vert ? "Senkrechter Fensterteiler" : "Waagerechter Fensterteiler"}
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={12}
      aria-valuemax={88}
      tabIndex={0}
      title="Ziehen: Aufteilung ändern · Doppelklick: halbe-halbe · Pfeiltasten: in Schritten"
      data-drag={drag}
      className={`split-handle absolute z-20 outline-none ${vert ? "-ml-[5px] w-[10px] cursor-col-resize" : "-mt-[5px] h-[10px] cursor-row-resize"}`}
      style={style}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        setDrag(true);
        document.documentElement.style.cursor = vert ? "col-resize" : "row-resize";
      }}
      onPointerMove={(e) => drag && useLayout.getState().setSplit(d.axis, fraction(box, e, d.axis))}
      onPointerUp={() => {
        setDrag(false);
        document.documentElement.style.cursor = "";
      }}
      onDoubleClick={() => useLayout.getState().setSplit(d.axis, 0.5)}
      onKeyDown={(e) => {
        const keys = vert ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
        if (!keys.includes(e.key)) return;
        e.preventDefault();
        useLayout.getState().setSplit(d.axis, v + (e.key === keys[1] ? 1 : -1) * (e.shiftKey ? 0.1 : 0.02));
      }}
    >
      <div className={`split-line absolute ${vert ? "inset-y-0 left-1/2 w-px -translate-x-1/2" : "inset-x-0 top-1/2 h-px -translate-y-1/2"}`} />
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
      className="split-cross absolute z-30 -mt-2 -ml-2 h-4 w-4 cursor-move rounded-full"
      style={{ left: pct(split.x), top: pct(split.y) }}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        setDrag(true);
        document.documentElement.style.cursor = "move";
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

/** Aufteilung in der Kopfleiste: Schemaknöpfe (breite Fenster) bzw. Menü. */
export function LayoutPicker() {
  const layout = useLayout((s) => s.layout);
  const maximized = useLayout((s) => s.maximized);
  return (
    <>
      <div className="seg max-[1599px]:hidden!" role="radiogroup" aria-label="Aufteilung der Ansichten">
        {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
          <button key={id} role="radio" aria-checked={layout === id} data-on={layout === id} className="h-7 px-1.5!" title={`Aufteilung: ${LAYOUTS[id].label}`} onClick={() => useLayout.getState().setLayout(id)}>
            <LayoutGlyph id={id} />
          </button>
        ))}
      </div>
      <Menu className="btn-ghost h-8 gap-1 px-1.5 min-[1600px]:hidden!" icon={<LayoutGlyph id={layout} size={18} />} title="Aufteilung der Ansichten">
        <MenuLabel>Aufteilung</MenuLabel>
        <LayoutMenuItems />
        {maximized != null && (
          <>
            <MenuSep />
            <MenuItem icon={<Minimize2 size={14} />} kbd="Strg+Leertaste" onClick={() => useLayout.getState().toggleMaximize(maximized)}>
              Aufteilung wiederherstellen
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}
