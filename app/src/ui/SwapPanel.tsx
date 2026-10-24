import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Search, X } from "lucide-react";
import { CATEGORY_LABELS } from "../data";
import { allCatalog, getCatalogItem, itemPrice, swapTargets, useEditor } from "../store/project";
import type { CatalogItem, Category, PlacedItem } from "../model/types";
import { closestVariant, deltaE, primarySlot } from "../model/color";
import { fmtEuro } from "../model/geometry";
import { Thumb } from "./CatalogPanel";
import { Swatch } from "./VariantPicker";

/** Kategorien, die sich an derselben Stelle sinnvoll gegeneinander tauschen lassen. */
const RELATED: Partial<Record<Category, Category[]>> = {
  armchair: ["pouf"],
  pouf: ["armchair", "bench", "sideTable"],
  bench: ["pouf"],
  chair: ["officeChair", "stool"],
  officeChair: ["chair"],
  stool: ["chair"],
  coffeeTable: ["sideTable"],
  sideTable: ["coffeeTable", "nightstand", "pouf"],
  nightstand: ["sideTable", "dresser"],
  desk: ["console", "diningTable"],
  console: ["desk", "sideboard"],
  diningTable: ["desk"],
  sideboard: ["lowboard", "dresser", "cabinet", "console"],
  lowboard: ["sideboard", "dresser"],
  dresser: ["sideboard", "lowboard", "nightstand"],
  cabinet: ["shelf", "wardrobe", "sideboard"],
  shelf: ["cabinet"],
  wardrobe: ["cabinet"],
  pendant: ["ceilingLamp"],
  ceilingLamp: ["pendant"],
  floorLamp: [],
  tableLamp: [],
  mirror: ["art"],
  art: ["mirror"],
};

type Sort = "fit" | "price" | "price-" | "color";

function dimDelta(a: number, b: number) {
  const d = Math.round(a - b);
  if (Math.abs(d) < 1) return null;
  return <span className={Math.abs(d) > 10 ? "text-amber-700" : "text-stone-400"}>{d > 0 ? `+${d}` : `−${-d}`}</span>;
}

/**
 * Tauschen: Alternativen für ein Objekt mit Vorschau im Plan/3D (Maus darüber oder Pfeiltasten),
 * Farbe/Material wird auf die nächstliegende Hersteller-Ausführung übertragen.
 * Bei Mehrfachauswahl werden alle markierten gleichen Objekte gemeinsam getauscht (ein Rückgängig-Schritt).
 */
export function SwapPanel({ it, onClose }: { it: PlacedItem; onClose: () => void }) {
  const st = useEditor();
  const c0 = getCatalogItem(it.catalogId);
  // Bezugsgrößen beim Öffnen festhalten, damit die Liste nach einem Tausch nicht springt
  const anchor = useRef({ w: it.w * 100, d: it.d * 100, h: it.h * 100, cat: c0?.category, slots: it.slots, price: itemPrice(it), name: it.label ?? c0?.name ?? "" }).current;
  const [q, setQ] = useState("");
  const [related, setRelated] = useState(false);
  const [vendor, setVendor] = useState("");
  const [tol, setTol] = useState(0.25);
  const [maxPrice, setMaxPrice] = useState(0);
  const [keepColor, setKeepColor] = useState(true);
  const [sort, setSort] = useState<Sort>("fit");
  const [all, setAll] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const twins = useMemo(() => st.project.items.filter((x) => x.catalogId === it.catalogId && !x.locked && !x.existing).map((x) => x.id), [st.project.items, it.catalogId]);
  // markierte gleiche Objekte (Mehrfachauswahl), sonst nur dieses
  const selection = useEditor((s) => s.selection);
  const marked = useMemo(() => swapTargets(st.project.items, selection, it.id), [st.project.items, selection, it.id]);
  const selIds = marked && marked.ids.includes(it.id) ? marked.ids : [it.id];
  const targets = all ? twins : selIds;
  const anchorColor = primarySlot(anchor.slots)?.color;

  const alts = useMemo(() => {
    if (!anchor.cat) return [];
    const cats = new Set<Category>([anchor.cat, ...(related ? RELATED[anchor.cat] ?? [] : [])]);
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const W = anchor.w, D = Math.max(anchor.d, 1), H = Math.max(anchor.h, 1);
    const rows = allCatalog()
      .filter((x) => cats.has(x.category) && x.vendor !== "Bestand" && (!vendor || x.vendor === vendor) && (!maxPrice || x.price <= maxPrice))
      .filter((x) => !terms.length || terms.every((t) => `${x.name} ${x.vendor} ${x.brand ?? ""} ${x.series ?? ""} ${x.variants.map((v) => v.name).join(" ")}`.toLowerCase().includes(t)))
      .map((x) => {
        const fit = Math.abs(x.w - W) / W + (Math.abs(x.d - D) / D) * 0.6 + (Math.abs(x.h - H) / H) * 0.25;
        const vi = keepColor ? closestVariant(x, anchor.slots) : 0;
        const col = primarySlot(x.variants[vi]?.slots ?? {})?.color;
        return { x, fit, vi, col };
      })
      .filter((a) => a.fit <= tol * 2.2 || terms.length > 0);
    if (sort === "price") rows.sort((a, b) => a.x.price - b.x.price);
    else if (sort === "price-") rows.sort((a, b) => b.x.price - a.x.price);
    else if (sort === "color" && anchorColor) {
      const dist = (h?: string) => (h ? deltaE(h, anchorColor) : 999);
      rows.sort((a, b) => dist(a.col) - dist(b.col));
    } else rows.sort((a, b) => (a.x.id === c0?.id ? -1 : b.x.id === c0?.id ? 1 : a.fit - b.fit));
    return rows.slice(0, 120);
  }, [anchor, related, q, vendor, tol, maxPrice, keepColor, sort, anchorColor, c0?.id]);

  const vendors = useMemo(() => [...new Set(allCatalog().filter((x) => x.category === anchor.cat && x.vendor !== "Bestand").map((x) => x.vendor))].sort(), [anchor.cat]);

  const variantOf = (x: CatalogItem, vi: number) => picked[x.id] ?? vi;
  const preview = (row?: (typeof alts)[number]) => st.set("swapPreview", row ? { ids: targets, catalogId: row.x.id, variant: variantOf(row.x, row.vi) } : null);
  const apply = (row: (typeof alts)[number]) => {
    st.set("swapPreview", null);
    st.replaceItems(targets, row.x.id, variantOf(row.x, row.vi));
  };

  useEffect(() => () => useEditor.getState().set("swapPreview", null), []);
  useEffect(() => {
    if (cursor >= 0 && alts[cursor]) {
      preview(alts[cursor]);
      listRef.current?.querySelector(`[data-row="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") (e.preventDefault(), setCursor((c) => Math.min(alts.length - 1, c + 1)));
    else if (e.key === "ArrowUp") (e.preventDefault(), setCursor((c) => Math.max(0, c - 1)));
    else if (e.key === "Enter" && alts[cursor]) (e.preventDefault(), apply(alts[cursor]));
    else if (e.key === "Escape") (e.preventDefault(), e.stopPropagation(), onClose());
  };

  return (
    <div className="flex h-full flex-col bg-surface" onKeyDown={onKey}>
      <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2">
        <ArrowLeftRight size={15} className="text-stone-500" />
        <div className="min-w-0 flex-1">
          <div className="panel-title">Tauschen</div>
          <div className="truncate text-xs text-stone-600" title="Vergleichsbasis für Maße und Preise (Stand beim Öffnen)">
            {targets.length > 1 && <span className="font-semibold text-stone-800">{targets.length}× </span>}
            {anchor.name} · {Math.round(anchor.w)} × {Math.round(anchor.d)} × {Math.round(anchor.h)} cm · {fmtEuro(anchor.price)}
          </div>
        </div>
        <button className="btn-ghost" onClick={onClose} title="Schließen (Esc)">
          <X size={16} />
        </button>
      </div>
      {selIds.length > 1 && !all && (
        <div className="border-b border-stone-200 bg-card px-3 py-1.5 text-[11px] text-stone-600">
          {selIds.length} markierte gleiche Objekte werden gemeinsam getauscht; jedes behält Position, Drehung und Bezug (Tischkante, Wand oder Mitte).
          {marked && marked.skipped > 0 && ` ${marked.skipped} andere markierte ${marked.skipped === 1 ? "Objekt bleibt" : "Objekte bleiben"} unverändert.`}
        </div>
      )}
      <div className="space-y-2 border-b border-stone-200 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2 text-stone-400" />
          <input autoFocus className="field pl-7" placeholder="Name, Serie, Stoff, Farbe …" value={q} onChange={(e) => (setQ(e.target.value), setCursor(-1))} />
        </div>
        <div className="flex flex-wrap gap-1">
          {["", ...vendors].map((v) => (
            <button key={v} className="chip" data-on={vendor === v} onClick={() => setVendor(v)}>
              {v || "Alle Händler"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <select className="field py-0.5 text-xs" value={tol} onChange={(e) => setTol(Number(e.target.value))} title="Erlaubte Abweichung von Breite und Tiefe">
            <option value={0.08}>±10 %</option>
            <option value={0.25}>±30 %</option>
            <option value={10}>Maße egal</option>
          </select>
          <select className="field py-0.5 text-xs" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
            <option value={0}>Preis egal</option>
            {[100, 250, 500, 1000, 2000, 4000].map((p) => (
              <option key={p} value={p}>
                ≤ {p.toLocaleString("de-DE")} €
              </option>
            ))}
          </select>
          <select className="field py-0.5 text-xs" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="fit">passend</option>
            <option value="color">Farbe</option>
            <option value="price">Preis ↑</option>
            <option value="price-">Preis ↓</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <label className="flex items-center gap-1.5 text-stone-700" title="Bei jedem Vorschlag die Hersteller-Ausführung wählen, die der jetzigen Farbe und dem Material am nächsten kommt">
            <input type="checkbox" className="" checked={keepColor} onChange={(e) => setKeepColor(e.target.checked)} />
            Farbe beibehalten
          </label>
          {(RELATED[anchor.cat as Category]?.length ?? 0) > 0 && (
            <label className="flex items-center gap-1.5 text-stone-700" title={(RELATED[anchor.cat as Category] ?? []).map((k) => CATEGORY_LABELS[k]).join(", ")}>
              <input type="checkbox" className="" checked={related} onChange={(e) => setRelated(e.target.checked)} />
              verwandte Kategorien
            </label>
          )}
        </div>
      </div>
      <div ref={listRef} className="flex-1 space-y-1 overflow-auto p-2" onMouseLeave={() => (preview(), setCursor(-1))}>
        {alts.map((row, i) => {
          const { x } = row;
          const vi = variantOf(x, row.vi);
          const v = x.variants[vi];
          const price = v?.price ?? x.price;
          const diff = price - anchor.price;
          const isCurrent = x.id === it.catalogId;
          return (
            <div
              key={x.id}
              data-row={i}
              className={`group flex cursor-pointer gap-2 rounded-lg border p-1.5 transition ${i === cursor ? "border-accent bg-card shadow-sm" : "border-transparent hover:border-stone-200 hover:bg-card hover:shadow-sm"}`}
              onMouseEnter={() => (setCursor(i), preview(row))}
              onClick={() => apply(row)}
              title={isCurrent ? "Aktuelles Produkt – Klick übernimmt die gewählte Ausführung" : "Klicken zum Tauschen"}
            >
              <Thumb c={x} variant={vi} size={64} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10.5px] text-stone-500">
                  <span className="font-semibold text-stone-700">{x.vendor}</span>
                  {x.brand && x.brand !== x.vendor && <span className="truncate">{x.brand}</span>}
                  {x.category !== anchor.cat && <span className="rounded bg-stone-200 px-1">{CATEGORY_LABELS[x.category]}</span>}
                  {isCurrent && <span className="rounded bg-accent px-1 text-white">aktuell</span>}
                </div>
                <div className="line-clamp-2 text-[12px] font-medium leading-tight text-stone-800">{x.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[10.5px] tabular-nums text-stone-500">
                  <span>B {Math.round(x.w)} {dimDelta(x.w, anchor.w)}</span>
                  <span>T {Math.round(x.d)} {dimDelta(x.d, anchor.d)}</span>
                  <span>H {Math.round(x.h)} {dimDelta(x.h, anchor.h)}</span>
                </div>
                {x.variants.length > 1 && (
                  <div className="mt-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {x.variants.slice(0, 9).map((vv, k) => (
                      <Swatch
                        key={k}
                        s={primarySlot(vv.slots)}
                        size={14}
                        selected={k === vi}
                        title={vv.name}
                        onClick={() => {
                          setPicked((p) => ({ ...p, [x.id]: k }));
                          st.set("swapPreview", { ids: targets, catalogId: x.id, variant: k });
                        }}
                      />
                    ))}
                    {x.variants.length > 9 && <span className="text-[10px] text-stone-500">+{x.variants.length - 9}</span>}
                    <span className="ml-1 truncate text-[10.5px] text-stone-600">{v?.name}</span>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between py-0.5 text-right">
                <span className="text-[12px] font-semibold">{price > 0 ? fmtEuro(price) : "—"}</span>
                {!isCurrent && Math.abs(diff) >= 1 && <span className={`text-[10.5px] ${diff > 0 ? "text-rose-700" : "text-accent-ink"}`}>{diff > 0 ? "+" : "−"}{fmtEuro(Math.abs(diff))}</span>}
                <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10.5px] font-medium text-white opacity-0 transition group-hover:opacity-100">Tauschen</span>
              </div>
            </div>
          );
        })}
        {!alts.length && <div className="p-3 text-xs text-stone-500">Keine passenden Alternativen – Maßtoleranz erweitern oder verwandte Kategorien einbeziehen.</div>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-stone-200 px-3 py-2 text-[11px] text-stone-500">
        {twins.length > selIds.length ? (
          <label className="flex items-center gap-1.5 text-stone-700">
            <input type="checkbox" className="" checked={all} onChange={(e) => setAll(e.target.checked)} />
            alle {twins.length} gleichen Objekte im Plan tauschen
          </label>
        ) : (
          <span>{alts.length} Vorschläge</span>
        )}
        <span>Maus/↑↓ = Vorschau · Enter = tauschen</span>
      </div>
    </div>
  );
}
