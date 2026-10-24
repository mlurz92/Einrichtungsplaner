import { useMemo, useState } from "react";
import { Check, ExternalLink, Search } from "lucide-react";
import type { CatalogItem, CatalogVariant, Slot, SlotStyle } from "../model/types";
import { MATERIAL_GROUPS, materialGroup, primarySlot, swatchBackground } from "../model/color";
import { fmtEuro } from "../model/geometry";
import { openExternal } from "../platform";
import { MATERIAL_LABELS, SLOT_LABELS } from "../data/paints";

const SLOT_ORDER: Slot[] = ["main", "top", "frame", "secondary", "shade", "legs", "accent", "detail"];

/** Musterkarte: echtes Stoffmuster (falls vorhanden), sonst Farbe + angedeutete Oberfläche; Zweitbauteil als Ecke. */
export function Swatch({ s, second, img, size = 28, selected, dim, title, onClick, onEnter }: { s?: SlotStyle; second?: SlotStyle; img?: string; size?: number; selected?: boolean; dim?: boolean; title?: string; onClick?: () => void; onEnter?: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={onEnter}
      className={`relative shrink-0 overflow-hidden rounded-md shadow-sm ring-1 transition ${selected ? "ring-2 ring-stone-900 ring-offset-1" : "ring-stone-300 hover:ring-stone-500"} ${dim ? "opacity-35" : ""}`}
      style={{ width: size, height: size, background: s ? swatchBackground(s) : "#ddd" }}
    >
      {img && imgOk && <img src={img} alt="" loading="lazy" draggable={false} onError={() => setImgOk(false)} className="absolute inset-0 h-full w-full object-cover" />}
      {second && <span className="absolute bottom-0 right-0 h-[38%] w-[38%] rounded-tl-md ring-1 ring-white/70" style={{ background: swatchBackground(second) }} />}
      {selected && (
        <span className="absolute left-0.5 top-0.5 rounded-full bg-white/85 p-px text-stone-900">
          <Check size={9} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Kurzbeschreibung der Bauteile einer Ausführung, z. B. „Bezug: Bouclé · Gestell: Messing“. */
export function slotSummary(v: CatalogVariant): string {
  return SLOT_ORDER.filter((k) => v.slots[k])
    .map((k) => `${SLOT_LABELS[k] ?? k}: ${MATERIAL_LABELS[v.slots[k]!.material] ?? v.slots[k]!.material}`)
    .join(" · ");
}

/** Bauteil, in dem sich die Werte einer Achse unterscheiden (z. B. „Bezug“ → main, „Gestell“ → legs). */
function axisSlot(c: CatalogItem, axis: number): Slot {
  let best: Slot = "main";
  let n = 0;
  for (const k of SLOT_ORDER) {
    const per = new Map<string, string>();
    for (const v of c.variants) {
      const s = v.slots[k];
      const a = v.opts?.[axis];
      if (!s || a == null || per.has(a)) continue;
      per.set(a, s.color + s.material);
    }
    const d = new Set(per.values()).size;
    if (d > n) {
      n = d;
      best = k;
    }
  }
  return best;
}

function familyOf(v: CatalogVariant): string {
  const first = v.name.split(/[\s/,]+/)[0]?.toLowerCase() ?? "";
  const known = ["bouclé", "boucle", "cord", "samt", "leder", "kunstleder", "webstoff", "leinen", "leinen-mix", "teddy", "chenille", "strukturstoff", "flachgewebe", "wolle", "kunstfell"];
  if (known.includes(first)) return first.charAt(0).toUpperCase() + first.slice(1);
  const p = primarySlot(v.slots);
  return MATERIAL_GROUPS.find((g) => g.id === (p ? materialGroup(p.material) : ""))?.label ?? "Weitere";
}

/**
 * Ausführungen eines Produkts, wie sie der Hersteller anbietet:
 *  - mit Achsen (z. B. „Bezug“ × „Gestell“): je Achse eine Musterreihe, nicht lieferbare Kombinationen abgeblendet
 *  - ohne Achsen: Musterkarten, nach Stoff-/Materialart gruppiert, mit Suche bei vielen Ausführungen
 */
export function VariantPicker({ c, value, onChange, current, onHover }: { c: CatalogItem; value: number; onChange: (i: number) => void; current?: string; onHover?: (i: number | null) => void }) {
  const [q, setQ] = useState("");
  const sel = c.variants[value] ?? c.variants[0];
  const minPrice = Math.min(...c.variants.map((v) => v.price ?? c.price));
  const axes = (c.axes ?? []).filter((a) => a.values.length > 1);
  const axisSlots = useMemo(() => axes.map((_, i) => axisSlot(c, (c.axes ?? []).indexOf(axes[i]))), [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    const m = new Map<string, number[]>();
    c.variants.forEach((v, i) => {
      if (t && !v.name.toLowerCase().includes(t)) return;
      const f = familyOf(v);
      if (!m.has(f)) m.set(f, []);
      m.get(f)!.push(i);
    });
    return [...m.entries()];
  }, [c, q]);

  const second = (v: CatalogVariant, s?: SlotStyle) => {
    const k = SLOT_ORDER.find((x) => v.slots[x] && v.slots[x] !== s && (v.slots[x]!.color !== s?.color || v.slots[x]!.material !== s?.material));
    return k ? v.slots[k] : undefined;
  };

  return (
    <div onMouseLeave={() => onHover?.(null)}>
      {axes.length > 1 ? (
        <div className="space-y-2.5">
          {axes.map((a, ai) => {
            const axisIdx = (c.axes ?? []).indexOf(a);
            const slot = axisSlots[ai];
            const cur = sel.opts?.[axisIdx];
            return (
              <div key={a.name}>
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="font-semibold text-stone-600">
                    {a.name} <span className="font-normal text-stone-400">({a.values.length})</span>
                  </span>
                  <span className="truncate pl-2 text-stone-700">{cur}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.values.map((val) => {
                    // gleiche Auswahl in den übrigen Achsen, nur diese Achse geändert
                    const want = (sel.opts ?? []).map((o, k) => (k === axisIdx ? val : o));
                    let idx = c.variants.findIndex((v) => v.opts?.every((o, k) => o === want[k]));
                    const exact = idx >= 0;
                    if (!exact) idx = c.variants.findIndex((v) => v.opts?.[axisIdx] === val);
                    const rep = c.variants[idx];
                    const s = rep?.slots[slot] ?? (rep ? primarySlot(rep.slots) : undefined);
                    const price = rep?.price ?? c.price;
                    return (
                      <Swatch
                        key={val}
                        s={s}
                        img={rep?.swatch}
                        size={30}
                        selected={cur === val}
                        dim={!exact}
                        title={`${val}${exact ? "" : " (andere Kombination)"} · ${fmtEuro(price)}`}
                        onClick={() => idx >= 0 && onChange(idx)}
                        onEnter={() => idx >= 0 && onHover?.(idx)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {axes.length === 1 && <div className="mb-1 text-[11px] font-semibold text-stone-600">{axes[0].name}</div>}
          {c.variants.length > 14 && (
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2 top-1.5 text-stone-400" />
              <input className="field py-0.5 pl-6 text-xs" placeholder={`${c.variants.length} Ausführungen durchsuchen …`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            {groups.map(([fam, idxs]) => (
              <div key={fam}>
                {groups.length > 1 && <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-stone-400">{fam}</div>}
                <div className="flex flex-wrap gap-1.5">
                  {idxs.map((i) => {
                    const v = c.variants[i];
                    const p = primarySlot(v.slots);
                    return <Swatch key={i} s={p} second={second(v, p)} img={v.swatch} size={30} selected={i === value} title={`${v.name} · ${fmtEuro(v.price ?? c.price)}${v.soldOut ? " · derzeit ausverkauft" : ""}`} onClick={() => onChange(i)} onEnter={() => onHover?.(i)} />;
                  })}
                </div>
              </div>
            ))}
            {!groups.length && <div className="text-xs text-stone-500">Keine Ausführung gefunden.</div>}
          </div>
        </div>
      )}
      <div className="mt-2 rounded-md bg-white px-2 py-1.5 text-xs shadow-sm ring-1 ring-stone-200">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-stone-800">{current === "Individuell" ? "Individuell angepasst" : sel.name}</span>
          <span className="whitespace-nowrap font-semibold">
            {fmtEuro(sel.price ?? c.price)}
            {(sel.price ?? c.price) > minPrice + 0.5 && <span className="ml-1 font-normal text-stone-500">(+{fmtEuro((sel.price ?? c.price) - minPrice)})</span>}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-stone-500">
          <span className="truncate">{slotSummary(sel)}</span>
          {(sel.url ?? c.url) && (
            <button className="flex shrink-0 items-center gap-0.5 text-accent-ink hover:underline" onClick={() => openExternal((sel.url ?? c.url)!)} title="Diese Ausführung im Shop öffnen">
              Shop <ExternalLink size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
