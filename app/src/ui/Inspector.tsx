import { useMemo, useState } from "react";
import { ArrowLeftRight, Copy, Crosshair, ExternalLink, Eye, EyeOff, Lock, RotateCcw, RotateCw, Trash2, Unlock } from "lucide-react";
import { useEditor, getCatalogItem, allCatalog, itemPrice } from "../store/project";
import { CATEGORY_LABELS, apartment, roomNames, wallFaceById } from "../data";
import type { MaterialKey, PlacedItem, Slot, Surface, SurfaceKind, WallFinish } from "../model/types";
import { MATERIAL_LABELS, PAINTS, PARAM_LABELS, SLOT_LABELS, SURFACE_KINDS, TILE_PATTERNS, WALLPAPER_PATTERNS } from "../data/paints";
import { Thumb } from "./CatalogPanel";
import { fmtEuro, nearestFace, normAngle, rotationForFace, segmentDistance } from "../model/geometry";
import { openExternal } from "../platform";

function Num({ label, value, onChange, step = 1, unit, min, max, digits = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string; min?: number; max?: number; digits?: number }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (Math.round(value * 10 ** digits) / 10 ** digits).toLocaleString("de-DE");
  return (
    <label className="block">
      <span className="text-[11px] text-stone-500">{label}</span>
      <div className="flex items-center">
        <input
          className="field rounded-r-none text-right tabular-nums"
          value={shown}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== null) {
              const v = Number(text.replace(",", "."));
              if (!Number.isNaN(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
            }
            setText(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value + (e.key === "ArrowUp" ? step : -step) * (e.shiftKey ? 10 : 1))));
            }
          }}
        />
        {unit && <span className="rounded-r-md border border-l-0 border-stone-200 bg-stone-50 px-1.5 py-1 text-xs text-stone-500">{unit}</span>}
      </div>
    </label>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="border-b border-stone-200 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="panel-title">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function SwapList({ it, onDone }: { it: PlacedItem; onDone: () => void }) {
  const c = getCatalogItem(it.catalogId);
  const [vendor, setVendor] = useState("");
  const [tol, setTol] = useState(0.3);
  const st = useEditor();
  const alts = useMemo(() => {
    if (!c) return [];
    const W = it.w * 100, D = it.d * 100;
    return allCatalog()
      .filter((x) => x.category === c.category && x.id !== c.id && x.vendor !== "Bestand" && (!vendor || x.vendor === vendor))
      .map((x) => ({ x, fit: Math.abs(x.w - W) / W + Math.abs(x.d - D) / Math.max(D, 1) * 0.6 }))
      .filter((a) => a.fit <= tol * 2)
      .sort((a, b) => a.fit - b.fit)
      .slice(0, 60);
  }, [c, it.w, it.d, vendor, tol]);
  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        {["", "Westwing", "IKEA", "JYSK"].map((v) => (
          <button key={v} className="chip" data-on={vendor === v} onClick={() => setVendor(v)}>
            {v || "Alle"}
          </button>
        ))}
        <select className="field ml-auto w-auto py-0.5 text-xs" value={tol} onChange={(e) => setTol(Number(e.target.value))}>
          <option value={0.1}>Maße ±10 %</option>
          <option value={0.3}>±30 %</option>
          <option value={1}>beliebig</option>
        </select>
      </div>
      <div className="max-h-[42vh] space-y-1 overflow-auto">
        {alts.map(({ x }) => (
          <button key={x.id} className="flex w-full items-center gap-2 rounded-md p-1 text-left hover:bg-white hover:shadow-sm" onClick={() => (st.replaceItem(it.id, x.id, 0), onDone())}>
            <Thumb c={x} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{x.name}</div>
              <div className="text-[11px] text-stone-500">
                {x.vendor} · {Math.round(x.w)}×{Math.round(x.d)}×{Math.round(x.h)} · {x.price > 0 ? fmtEuro(x.price) : "—"}
              </div>
            </div>
          </button>
        ))}
        {!alts.length && <div className="text-xs text-stone-500">Keine passenden Alternativen.</div>}
      </div>
    </div>
  );
}

function ItemInspector({ it }: { it: PlacedItem }) {
  const st = useEditor();
  const c = getCatalogItem(it.catalogId);
  const [swap, setSwap] = useState(false);
  const up = (fn: (x: PlacedItem) => void) => st.updateItems([it.id], fn);
  const price = itemPrice(it);
  const slots = Object.entries(it.slots) as [Slot, { color: string; material: MaterialKey }][];
  const paramKeys = Object.keys(it.params ?? {}).filter((k) => PARAM_LABELS[k] && typeof it.params![k] === "number");
  return (
    <div>
      <div className="flex gap-3 border-b border-stone-200 p-3">
        {c && <Thumb c={c} size={84} />}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            {c?.vendor} · {CATEGORY_LABELS[c?.category ?? ""] ?? ""} {it.pos ? `· ${it.pos}` : ""}
          </div>
          <div className="text-sm font-semibold leading-snug">{it.label ?? c?.name}</div>
          <div className="mt-0.5 text-xs text-stone-500">{roomNames[it.room ?? ""] ?? "außerhalb"}</div>
          <div className="mt-1 text-sm font-semibold">{it.existing ? "Bestand" : fmtEuro(price)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-stone-200 px-3 py-2">
        <button className="btn-ghost" title="Tauschen" onClick={() => setSwap((s) => !s)} disabled={it.existing}>
          <ArrowLeftRight size={15} /> Tauschen
        </button>
        <button className="btn-ghost" title="Duplizieren (Strg+D)" onClick={() => st.duplicateItems([it.id])}>
          <Copy size={15} />
        </button>
        <button className="btn-ghost" title="−15° (Umschalt+R)" onClick={() => up((x) => void (x.rot = normAngle(x.rot - 15)))}>
          <RotateCcw size={15} />
        </button>
        <button className="btn-ghost" title="+15° (R)" onClick={() => up((x) => void (x.rot = normAngle(x.rot + 15)))}>
          <RotateCw size={15} />
        </button>
        <button
          className="btn-ghost"
          title="An nächster Wand ausrichten"
          onClick={() =>
            up((x) => {
              const nf = nearestFace(Array.from(wallFaceById.values()), x.x, x.y, 3);
              if (!nf) return;
              x.rot = rotationForFace(nf.face);
              const q = segmentDistance([x.x, x.y], nf.face.a, nf.face.b).q;
              x.x = q[0] + nf.face.n[0] * (x.d / 2 + 0.002);
              x.y = q[1] + nf.face.n[1] * (x.d / 2 + 0.002);
            })
          }
        >
          <Crosshair size={15} />
        </button>
        <button className="btn-ghost" title={it.locked ? "Entsperren" : "Sperren"} onClick={() => up((x) => void (x.locked = !x.locked))}>
          {it.locked ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
        <button className="btn-ghost" title={it.hidden ? "Einblenden" : "Ausblenden"} onClick={() => up((x) => void (x.hidden = !x.hidden))}>
          {it.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button className="btn-ghost text-red-700" title="Löschen (Entf)" onClick={() => st.removeItems([it.id])} disabled={it.locked}>
          <Trash2 size={15} />
        </button>
      </div>
      {swap && (
        <Section title="Alternativen (gleiche Kategorie, passende Maße)">
          <SwapList it={it} onDone={() => setSwap(false)} />
        </Section>
      )}
      <Section title="Position & Maße">
        <div className="grid grid-cols-3 gap-2">
          <Num label="x" unit="m" value={it.x} digits={3} step={0.01} onChange={(v) => up((x) => void (x.x = v))} />
          <Num label="y" unit="m" value={it.y} digits={3} step={0.01} onChange={(v) => up((x) => void (x.y = v))} />
          <Num label="Drehung" unit="°" value={it.rot} step={1} onChange={(v) => up((x) => void (x.rot = normAngle(v)))} />
          <Num label="Breite" unit="cm" value={it.w * 100} step={1} min={1} onChange={(v) => up((x) => void (x.w = v / 100))} />
          <Num label="Tiefe" unit="cm" value={it.d * 100} step={1} min={0.5} onChange={(v) => up((x) => void (x.d = v / 100))} />
          <Num label="Höhe" unit="cm" value={it.h * 100} step={1} min={0.5} onChange={(v) => up((x) => void (x.h = v / 100))} />
          <Num label={it.mount === "ceiling" ? "Unterkante" : "Montagehöhe"} unit="cm" value={it.elev * 100} step={1} min={0} max={apartment.ceilingHeight * 100} onChange={(v) => up((x) => void (x.elev = v / 100))} />
        </div>
        {c && (Math.abs(c.w - it.w * 100) > 0.5 || Math.abs(c.d - it.d * 100) > 0.5 || Math.abs(c.h - it.h * 100) > 0.5) && (
          <button className="mt-2 text-xs text-emerald-800 underline" onClick={() => up((x) => void ((x.w = c.w / 100), (x.d = c.d / 100), (x.h = c.h / 100)))}>
            Katalogmaße wiederherstellen ({c.w} × {c.d} × {c.h} cm)
          </button>
        )}
      </Section>
      {c && c.variants.length > 1 && (
        <Section title={`Varianten (${c.variants.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {c.variants.map((v, i) => (
              <button key={i} title={v.name} onClick={() => st.applyVariant(it.id, i)} className={`h-7 w-7 rounded-full border-2 shadow ring-1 ring-stone-300 ${it.variant === v.name ? "border-stone-900" : "border-white"}`} style={{ background: v.slots.main?.color ?? v.slots.top?.color ?? v.slots.frame?.color ?? "#ccc" }} />
            ))}
          </div>
          <div className="mt-1 text-xs text-stone-600">{it.variant}</div>
        </Section>
      )}
      <Section title="Farben & Materialien">
        <div className="space-y-2">
          {slots.map(([slot, s]) => (
            <div key={slot} className="flex items-center gap-2">
              <input type="color" value={s.color} onChange={(e) => st.setSlot(it.id, slot, { color: e.target.value })} className="h-8 w-9 cursor-pointer rounded border border-stone-200 bg-white p-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-stone-500">{SLOT_LABELS[slot] ?? slot}</div>
                <select className="field py-0.5 text-xs" value={s.material} onChange={(e) => st.setSlot(it.id, slot, { material: e.target.value as MaterialKey })}>
                  {Object.entries(MATERIAL_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {!slots.length && <div className="text-xs text-stone-500">Dieses Objekt hat keine einstellbaren Materialien.</div>}
        </div>
      </Section>
      {paramKeys.length > 0 && (
        <Section title="Ausführung">
          <div className="grid grid-cols-2 gap-2">
            {paramKeys.map((k) => {
              const m = PARAM_LABELS[k];
              return <Num key={k} label={m.label} value={it.params![k] as number} step={m.step ?? 1} min={m.min} max={m.max} digits={m.step && m.step < 1 ? 2 : 0} onChange={(v) => up((x) => void (x.params = { ...x.params, [k]: v }))} />;
            })}
          </div>
        </Section>
      )}
      {!it.existing && (
        <Section title="Stückliste & Preis">
          <div className="space-y-1.5">
            {(it.parts ?? []).map((p, i) => (
              <div key={i} className="rounded-md bg-white p-2 text-xs shadow-sm ring-1 ring-stone-200">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {p.pos ? `${p.pos} · ` : ""}
                    {p.name}
                  </span>
                  {p.url && (
                    <button className="text-emerald-800" title="Im Shop öffnen" onClick={() => openExternal(p.url!)}>
                      <ExternalLink size={13} />
                    </button>
                  )}
                </div>
                <div className="mt-0.5 text-stone-500">
                  {p.vendor} · {+p.qty.toFixed(2)} × {fmtEuro(p.unit)} = {fmtEuro(p.qty * p.unit)}
                  {p.delivery ? ` · ${p.delivery}` : ""}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      <Section title="Notiz">
        <textarea className="field h-16 resize-none text-xs" value={it.note ?? ""} placeholder="z. B. Stoffmuster bestellen …" onChange={(e) => st.updateItems([it.id], (x) => void (x.note = e.target.value), { commit: false })} />
      </Section>
    </div>
  );
}

export function SurfaceEditor({ value, onChange, allowLower = true }: { value: WallFinish; onChange: (f: WallFinish) => void; allowLower?: boolean }) {
  const setBase = (p: Partial<Surface>) => onChange({ ...value, base: { ...value.base, ...p } });
  const lower = value.lower;
  const kindDefaults: Record<SurfaceKind, Partial<Surface>> = {
    paint: { color: "#f3f0e8" },
    limewash: { color: "#e7dccb" },
    wallpaper: { color: "#efe8da", color2: "#c9b79c", pattern: "stripes" },
    lamella: { color: "#c9a273", color2: "#141414" },
    woodPanel: { color: "#c9a477" },
    wainscot: { color: "#f3f0e8" },
    tiles: { color: "#efece6", color2: "#cfcac1", pattern: "large" },
    stone: { color: "#e3d6c1" },
    concrete: { color: "#cfcbc4" },
    microcement: { color: "#d8d2c8" },
    fabric: { color: "#e6dfd2" },
  };
  return (
    <div className="space-y-2">
      <select className="field" value={value.base.kind} onChange={(e) => setBase({ kind: e.target.value as SurfaceKind, ...kindDefaults[e.target.value as SurfaceKind] })}>
        {SURFACE_KINDS.map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <input type="color" value={value.base.color} onChange={(e) => setBase({ color: e.target.value, productName: undefined })} className="h-8 w-10 cursor-pointer rounded border border-stone-200 p-0.5" />
        {(value.base.kind === "wallpaper" || value.base.kind === "tiles" || value.base.kind === "limewash" || value.base.kind === "lamella") && (
          <input type="color" value={value.base.color2 ?? "#cccccc"} onChange={(e) => setBase({ color2: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-stone-200 p-0.5" title="Zweitfarbe / Fuge" />
        )}
        {value.base.kind === "wallpaper" && (
          <select className="field" value={value.base.pattern} onChange={(e) => setBase({ pattern: e.target.value })}>
            {WALLPAPER_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
        {value.base.kind === "tiles" && (
          <select className="field" value={value.base.pattern} onChange={(e) => setBase({ pattern: e.target.value })}>
            {TILE_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
        {value.base.kind === "paint" && (
          <select className="field" value={value.base.sheen ?? "matt"} onChange={(e) => setBase({ sheen: e.target.value as Surface["sheen"] })}>
            <option value="matt">matt</option>
            <option value="edelmatt">edelmatt</option>
            <option value="seidenmatt">seidenmatt</option>
            <option value="glanz">glänzend</option>
          </select>
        )}
      </div>
      {value.base.productName && <div className="text-xs text-stone-600">{value.base.productName}</div>}
      {(value.base.kind === "paint" || value.base.kind === "limewash") && (
        <div className="max-h-40 overflow-auto rounded-md border border-stone-200 bg-white p-1.5">
          <div className="grid grid-cols-8 gap-1">
            {PAINTS.map((p) => (
              <button key={p.brand + p.name} title={`${p.brand} – ${p.name}${p.note ? ` (${p.note})` : ""}`} onClick={() => setBase({ color: p.hex, productName: `${p.brand} ${p.name}` })} className={`aspect-square rounded border ${value.base.color.toLowerCase() === p.hex ? "border-stone-900 ring-2 ring-stone-900/30" : "border-stone-300"}`} style={{ background: p.hex }} />
            ))}
          </div>
        </div>
      )}
      {allowLower && (
        <div className="rounded-md border border-stone-200 bg-white p-2">
          <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
            <input type="checkbox" className="accent-emerald-800" checked={!!lower && lower.height > 0} onChange={(e) => onChange({ ...value, lower: e.target.checked ? { height: 1.1, surface: { kind: "wainscot", color: "#f3f0e8" }, rail: true } : undefined })} />
            Sockelzone / Vertäfelung / Zweifarbig
          </label>
          {lower && lower.height > 0 && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Num label="Höhe" unit="cm" value={lower.height * 100} min={5} max={240} onChange={(v) => onChange({ ...value, lower: { ...lower, height: v / 100 } })} />
                <label className="block">
                  <span className="text-[11px] text-stone-500">Ausführung</span>
                  <select className="field" value={lower.surface.kind} onChange={(e) => onChange({ ...value, lower: { ...lower, surface: { ...lower.surface, kind: e.target.value as SurfaceKind } } })}>
                    {SURFACE_KINDS.filter((k) => k.kind !== "lamella").map((k) => (
                      <option key={k.kind} value={k.kind}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={lower.surface.color} onChange={(e) => onChange({ ...value, lower: { ...lower, surface: { ...lower.surface, color: e.target.value } } })} className="h-8 w-10 rounded border border-stone-200 p-0.5" />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" className="accent-emerald-800" checked={!!lower.rail} onChange={(e) => onChange({ ...value, lower: { ...lower, rail: e.target.checked } })} /> Abschlussleiste
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FaceInspector({ faceId }: { faceId: string }) {
  const st = useEditor();
  const f = wallFaceById.get(faceId)!;
  const roomFin = st.project.rooms[f.roomId]?.wall;
  const own = st.project.walls[faceId];
  const value = own ?? roomFin ?? { base: { kind: "paint", color: "#f3f0e8" } };
  const area = f.length * apartment.ceilingHeight * f.wallRatio;
  const roomFaces = Array.from(wallFaceById.values()).filter((x) => x.roomId === f.roomId && x.wallRatio > 0.2).map((x) => x.id);
  return (
    <div>
      <Section title="Wandfläche">
        <div className="text-sm font-semibold">{roomNames[f.roomId]}</div>
        <div className="text-xs text-stone-500">
          Kante {f.index + 1} · Länge {f.length.toLocaleString("de-DE", { maximumFractionDigits: 3 })} m · Fläche ≈ {area.toLocaleString("de-DE", { maximumFractionDigits: 1 })} m² (ohne Öffnungen)
        </div>
        <div className="mt-1 text-xs text-stone-500">{own ? "Individuell gestaltet" : "Raumstandard"}</div>
      </Section>
      <Section title="Gestaltung dieser Wand">
        <SurfaceEditor value={value} onChange={(fin) => st.setWallFinish([faceId], fin)} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => st.setRoomFinish(f.roomId, { wall: value })}>
            Auf ganzen Raum
          </button>
          <button className="btn" onClick={() => st.setWallFinish(roomFaces, value)}>
            Alle Wände einzeln
          </button>
          <button className="btn col-span-2" onClick={() => st.setWallFinish([faceId], null)} disabled={!own}>
            Auf Raumstandard zurücksetzen
          </button>
        </div>
      </Section>
    </div>
  );
}

export function RoomInspector({ roomId }: { roomId: string }) {
  const st = useEditor();
  const r = apartment.rooms.find((x) => x.id === roomId)!;
  const fin = st.project.rooms[roomId];
  if (!fin) return null;
  const items = st.project.items.filter((i) => i.room === roomId && !i.existing);
  const sum = items.reduce((a, i) => a + itemPrice(i), 0);
  return (
    <div>
      <Section title="Raum">
        <div className="text-sm font-semibold">
          {r.name} <span className="font-normal text-stone-500">({r.id})</span>
        </div>
        <div className="text-xs text-stone-500">
          {r.area.toLocaleString("de-DE")} m² · Umfang {r.perimeter.toLocaleString("de-DE")} m · Raumhöhe {apartment.ceilingHeight.toLocaleString("de-DE")} m
        </div>
        <div className="mt-1 text-xs text-stone-600">
          {items.length} Objekte · {fmtEuro(sum)}
        </div>
      </Section>
      <Section title="Boden">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block">
            <span className="text-[11px] text-stone-500">Belag</span>
            <select className="field" value={fin.floor.kind} onChange={(e) => st.setRoomFinish(roomId, { floor: { ...fin.floor, kind: e.target.value as typeof fin.floor.kind, productName: undefined } })}>
              <option value="planks">Dielen (Landhausdiele)</option>
              <option value="herringbone">Fischgrät</option>
              <option value="chevron">Chevron</option>
              <option value="tiles">Fliesen</option>
              <option value="stone">Naturstein</option>
              <option value="microcement">Mikrozement</option>
              <option value="carpet">Teppichboden</option>
              <option value="deck">Holzdeck (außen)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-stone-500">Farbe</span>
            <input type="color" value={fin.floor.color} onChange={(e) => st.setRoomFinish(roomId, { floor: { ...fin.floor, color: e.target.value } })} className="h-8 w-full rounded border border-stone-200 p-0.5" />
          </label>
          <Num label="Verlegerichtung" unit="°" value={fin.floor.angle} onChange={(v) => st.setRoomFinish(roomId, { floor: { ...fin.floor, angle: v } })} />
          {(fin.floor.kind === "planks" || fin.floor.kind === "deck") && (
            <>
              <Num label="Dielenlänge" unit="cm" value={(fin.floor.plankLength ?? 1.9) * 100} onChange={(v) => st.setRoomFinish(roomId, { floor: { ...fin.floor, plankLength: v / 100 } })} />
              <Num label="Dielenbreite" unit="cm" value={(fin.floor.plankWidth ?? 0.19) * 100} onChange={(v) => st.setRoomFinish(roomId, { floor: { ...fin.floor, plankWidth: v / 100 } })} />
            </>
          )}
          {(fin.floor.kind === "tiles" || fin.floor.kind === "stone") && <Num label="Fliesengröße" unit="cm" value={(fin.floor.tileSize ?? 0.6) * 100} onChange={(v) => st.setRoomFinish(roomId, { floor: { ...fin.floor, tileSize: v / 100 } })} />}
        </div>
        {fin.floor.productName && <div className="mt-1 text-xs text-stone-500">{fin.floor.productName}</div>}
      </Section>
      <Section title="Wände (Raumstandard)">
        <SurfaceEditor value={fin.wall} onChange={(w) => st.setRoomFinish(roomId, { wall: w })} />
      </Section>
      <Section title="Decke">
        <div className="flex items-center gap-2">
          <input type="color" value={fin.ceiling} onChange={(e) => st.setRoomFinish(roomId, { ceiling: e.target.value })} className="h-8 w-10 rounded border border-stone-200 p-0.5" />
          <button className="btn" onClick={() => st.setRoomFinish(roomId, { ceiling: fin.wall.base.color })}>
            Wie Wandfarbe
          </button>
          <button className="btn" onClick={() => st.setRoomFinish(roomId, { ceiling: "#f7f5f0" })}>
            Weiß
          </button>
        </div>
      </Section>
    </div>
  );
}

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const items = useEditor((s) => s.project.items);
  const face = useEditor((s) => s.selectedFace);
  const room = useEditor((s) => s.selectedRoom);
  if (selection.length === 1) {
    const it = items.find((i) => i.id === selection[0]);
    if (it) return <ItemInspector key={it.id} it={it} />;
  }
  if (selection.length > 1) return <MultiInspector ids={selection} />;
  if (face) return <FaceInspector key={face} faceId={face} />;
  if (room) return <RoomInspector key={room} roomId={room} />;
  return (
    <div className="p-4 text-sm text-stone-500">
      Objekt, Wand oder Raum anklicken, um Eigenschaften zu bearbeiten.
      <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">
        <li>Ziehen: verschieben (Alt = ohne Fang)</li>
        <li>Drehgriff bzw. R / Umschalt+R: ±15°</li>
        <li>Pfeiltasten: 1 cm, mit Umschalt 10 cm</li>
        <li>Entf: löschen · Strg+D: duplizieren</li>
        <li>Strg+Z / Strg+Y: rückgängig / wiederholen</li>
        <li>M: messen · F: einpassen</li>
      </ul>
    </div>
  );
}

function MultiInspector({ ids }: { ids: string[] }) {
  const st = useEditor();
  const items = st.project.items.filter((i) => ids.includes(i.id));
  const sum = items.reduce((a, i) => a + itemPrice(i), 0);
  return (
    <div>
      <Section title={`${items.length} Objekte ausgewählt`}>
        <div className="text-sm">{fmtEuro(sum)}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => st.duplicateItems(ids)}>
            <Copy size={14} /> Duplizieren
          </button>
          <button className="btn text-red-700" onClick={() => st.removeItems(ids)}>
            <Trash2 size={14} /> Löschen
          </button>
          <button className="btn" onClick={() => st.updateItems(ids, (x) => void (x.locked = true))}>
            <Lock size={14} /> Sperren
          </button>
          <button className="btn" onClick={() => st.updateItems(ids, (x) => void (x.hidden = !x.hidden))}>
            <EyeOff size={14} /> Ein/Aus
          </button>
        </div>
      </Section>
    </div>
  );
}
