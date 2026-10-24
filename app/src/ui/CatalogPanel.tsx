import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LayoutGrid, List, Plus, Search, SlidersHorizontal, Sparkles, Star, X } from "lucide-react";
import { useUi } from "./prefs";
import { Seg } from "./kit";
import { CATEGORY_GROUPS, CATEGORY_LABELS, apartment, roomNames } from "../data";
import { allCatalog, useEditor } from "../store/project";
import type { CatalogItem } from "../model/types";
import { getThumbnail } from "../three/thumbnails";
import { openExternal } from "../platform";
import { fmtEuro, polygonCentroid } from "../model/geometry";
import { DND_TYPE } from "./dnd";
import { VariantPicker, slotSummary } from "./VariantPicker";
import { COLOR_FAMILIES, MATERIAL_GROUPS, matchVariant, primarySlot } from "../model/color";

const VENDORS = ["Westwing", "IKEA", "JYSK", "Designhandel", "Tylko", "Samsung", "lampe.de", "Höffner", "OBI", "Fachhandel"];

export function Thumb({ c, variant = 0, size = 96 }: { c: CatalogItem; variant?: number; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) {
        io.disconnect();
        getThumbnail(c, variant).then((u) => alive && setUrl(u));
      }
    });
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [c, variant]);
  return (
    <div ref={ref} className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-stone-50 to-stone-200/70" style={size ? { width: size, height: size } : { width: "100%" }}>
      {url ? <img src={url} alt="" className="h-full w-full object-contain" draggable={false} /> : <div className="h-6 w-6 animate-pulse rounded-full bg-stone-300/60" />}
    </div>
  );
}

const VENDOR_BADGE: Record<string, string> = {
  Westwing: "bg-[#1f1f1f] text-white ring-1 ring-white/10",
  IKEA: "bg-[#0058a3] text-[#ffdb00]",
  JYSK: "bg-[#143c8a] text-white",
  Tylko: "bg-[#ff3c00] text-white",
  Samsung: "bg-[#1428a0] text-white",
  "lampe.de": "bg-[#f4b400] text-[#1d1d1d]",
  Höffner: "bg-[#e30613] text-white",
};

/** Katalog-Drag & Drop: Vorschau läuft über den Platzierungsmodus, Ablage in 2D/3D. */
function startCatalogDrag(e: React.DragEvent, catalogId: string, variant: number) {
  e.dataTransfer.setData(DND_TYPE, JSON.stringify({ catalogId, variant }));
  e.dataTransfer.setData("text/plain", catalogId);
  e.dataTransfer.effectAllowed = "copy";
  useEditor.getState().set("placing", { catalogId, variant });
}
function endCatalogDrag(e: React.DragEvent) {
  if (e.dataTransfer.dropEffect === "none") useEditor.getState().set("placing", null);
}

function FavStar({ id, className = "" }: { id: string; className?: string }) {
  const fav = useUi((s) => s.favorites.includes(id));
  return (
    <button
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition hover:bg-stone-500/15 ${fav ? "text-amber-500" : "text-stone-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"} ${className}`}
      title={fav ? "Von der Merkliste entfernen" : "Auf die Merkliste"}
      aria-pressed={fav}
      onClick={(e) => {
        e.stopPropagation();
        useUi.getState().toggleFavorite(id);
      }}
    >
      <Star size={14} fill={fav ? "currentColor" : "none"} />
    </button>
  );
}

/** Kachel der Rasteransicht: großes Vorschaubild, Name, Maße, Preis. */
const Tile = memo(function Tile({ c, vi, onOpen }: { c: CatalogItem; vi: number; onOpen: (c: CatalogItem, vi: number) => void }) {
  return (
    <div
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-line bg-card/60 p-1.5 transition hover:-translate-y-0.5 hover:border-stone-300 hover:bg-card hover:shadow-md"
      onClick={() => onOpen(c, vi)}
      draggable
      onDragStart={(e) => startCatalogDrag(e, c.id, vi)}
      onDragEnd={endCatalogDrag}
      title={`${c.name} – in den Plan oder die 3D-Ansicht ziehen`}
    >
      <div className="relative">
        <Thumb c={c} variant={vi} size={0} />
        <span className={`absolute top-1 left-1 rounded px-1 text-[9.5px] font-semibold ${VENDOR_BADGE[c.vendor] ?? "bg-stone-200 text-stone-700"}`}>{c.vendor}</span>
        <FavStar id={c.id} className="absolute top-0.5 right-0.5 bg-card/80" />
      </div>
      <div className="mt-1 line-clamp-2 min-h-[2.4em] text-[11.5px] font-medium leading-tight text-stone-800">{c.name}</div>
      <div className="mt-auto flex items-end justify-between pt-0.5">
        <span className="text-[10.5px] text-stone-500">
          {Math.round(c.w)}×{Math.round(c.d)}×{Math.round(c.h)}
        </span>
        <span className="text-[11.5px] font-semibold">{c.price > 0 ? fmtEuro(c.price) : "—"}</span>
      </div>
    </div>
  );
});

const Card = memo(function Card({ c, vi, onOpen }: { c: CatalogItem; vi: number; onOpen: (c: CatalogItem, vi: number) => void }) {
  const place = useEditor((s) => s.set);
  return (
    <div
      className="group flex cursor-pointer gap-2.5 rounded-xl border border-transparent p-1.5 transition hover:border-line hover:bg-card hover:shadow-sm"
      onClick={() => onOpen(c, vi)}
      draggable
      onDragStart={(e) => startCatalogDrag(e, c.id, vi)}
      onDragEnd={endCatalogDrag}
      title="In den Plan oder die 3D-Ansicht ziehen"
    >
      <Thumb c={c} variant={vi} size={76} />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1 text-[10px] font-semibold ${VENDOR_BADGE[c.vendor] ?? "bg-stone-200 text-stone-700"}`}>{c.vendor}</span>
          {c.concepts?.length ? <span className="text-[10px] text-accent-ink">Konzept {c.concepts.join(", ")}</span> : null}
          {c.premium && !c.concepts?.length ? <Sparkles size={11} className="text-amber-600" /> : null}
          <FavStar id={c.id} className="-my-1 ml-auto" />
        </div>
        <div className="mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-tight text-stone-800">{c.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-500">
          <span className="shrink-0">
            {Math.round(c.w)} × {Math.round(c.d)} × {Math.round(c.h)} cm
          </span>
          {c.variants.length > 1 && (
            <span className="flex min-w-0 items-center gap-0.5" title={`${c.variants.length} Ausführungen: ${c.variants.slice(0, 12).map((v) => v.name).join(", ")}${c.variants.length > 12 ? " …" : ""}`}>
              {c.variants.slice(0, 7).map((v, k) => (
                <span key={k} className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${k === vi ? "ring-stone-800" : "ring-black/10"}`} style={{ background: primarySlot(v.slots)?.color ?? "#ccc" }} />
              ))}
              {c.variants.length > 7 && <span className="text-[10px]">+{c.variants.length - 7}</span>}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-stone-900">{c.price > 0 ? fmtEuro(c.price) : "—"}</span>
          <button
            className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              place("placing", { catalogId: c.id, variant: vi });
            }}
          >
            Platzieren
          </button>
        </div>
      </div>
    </div>
  );
});

function Detail({ c, initial, onClose }: { c: CatalogItem; initial: number; onClose: () => void }) {
  const [variant, setVariant] = useState(initial);
  const st = useEditor();
  const v = c.variants[variant];
  const placeInRoom = () => {
    const rid = st.selectedRoom ?? "13.01";
    const r = apartment.rooms.find((x) => x.id === rid)!;
    const [cx, cy] = polygonCentroid(r.polygon);
    st.addFromCatalog(c.id, variant, cx, cy);
    onClose();
  };
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface fade-in">
      <div className="flex items-center justify-between border-b border-line px-3 py-2" onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <span className="panel-title">Produkt</span>
        <div className="group flex items-center gap-1">
          <FavStar id={c.id} className="opacity-100" />
          <button className="btn-ghost h-7 w-7 p-0" onClick={onClose} title="Zurück zur Liste (Esc)">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="flex justify-center rounded-xl bg-gradient-to-b from-card to-stone-200/60 p-2">
          <Thumb c={c} variant={variant} size={220} />
        </div>
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          {c.vendor}
          {c.brand && c.brand !== c.vendor ? ` · ${c.brand}` : ""} · {CATEGORY_LABELS[c.category] ?? c.category}
        </div>
        <h3 className="mt-0.5 text-[15px] font-semibold leading-snug">{c.name}</h3>
        <div className="mt-1 text-sm text-stone-600">
          B {c.w} × T {c.d} × H {c.h} cm
        </div>
        <div className="mt-1 text-lg font-semibold">{(v?.price ?? c.price) > 0 ? fmtEuro(v?.price ?? c.price) : "Preis auf Anfrage"}</div>
        {c.delivery && <div className="text-xs text-stone-500">Lieferzeit: {c.delivery}</div>}
        {c.variants.length > 1 ? (
          <div className="mt-3">
            <div className="panel-title mb-1.5">
              Ausführungen des Herstellers <span className="font-normal normal-case text-stone-400">({c.variants.length})</span>
            </div>
            <VariantPicker c={c} value={variant} onChange={setVariant} />
          </div>
        ) : (
          v && <div className="mt-2 text-xs text-stone-600">{v.name !== "Standard" ? `${v.name} · ` : ""}{slotSummary(v)}</div>
        )}
        {c.description && <p className="mt-3 text-xs leading-relaxed text-stone-600">{c.description}</p>}
        {(v?.url ?? c.url) && (
          <button className="btn mt-3 w-full" onClick={() => openExternal((v?.url ?? c.url)!)}>
            <ExternalLink size={14} /> Im Shop ansehen
          </button>
        )}
        {(v?.image ?? c.image) && (
          <div className="mt-3">
            <div className="panel-title mb-1">Produktfoto (online)</div>
            <img key={v?.image ?? c.image} src={(v?.image ?? c.image)!.includes("cdn.shopify") ? `${v?.image ?? c.image}&width=480` : (v?.image ?? c.image)} alt="" className="w-full rounded-lg bg-white object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
        <button className="btn" onClick={placeInRoom} title="In der Mitte des gewählten Raums einfügen">
          <Plus size={14} /> In {roomNames[st.selectedRoom ?? "13.01"]?.split(" ")[0] ?? "Raum"}
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            st.set("placing", { catalogId: c.id, variant });
            onClose();
          }}
        >
          Platzieren
        </button>
      </div>
    </div>
  );
}

export function CatalogPanel() {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [vendors, setVendors] = useState<string[]>([]);
  const [group, setGroup] = useState<string>("Alle");
  const [cat, setCat] = useState<string>("");
  const [premium, setPremium] = useState(true);
  const [sort, setSort] = useState<"relevanz" | "preis" | "preis-" | "name">("relevanz");
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [open, setOpen] = useState<{ c: CatalogItem; vi: number } | null>(null);
  const [colorF, setColorF] = useState("");
  const [matF, setMatF] = useState("");
  const [scope, setScope] = useState<"alle" | "merkliste" | "zuletzt">("alle");
  const [maxW, setMaxW] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(() => {
    try {
      return localStorage.getItem("we13.catalogFilters") !== "0";
    } catch {
      return true;
    }
  });
  const view = useUi((s) => s.catalogView);
  const favorites = useUi((s) => s.favorites);
  const recentPlaced = useUi((s) => s.recentPlaced);
  const toggleFilters = () =>
    setFiltersOpen((o) => {
      try {
        localStorage.setItem("we13.catalogFilters", o ? "0" : "1");
      } catch {
        /* ignorieren */
      }
      return !o;
    });
  const activeFilters = vendors.length + (group !== "Alle" ? 1 : 0) + (cat ? 1 : 0) + (colorF ? 1 : 0) + (matF ? 1 : 0) + (maxPrice ? 1 : 0) + (maxW ? 1 : 0) + (premium ? 0 : 1);
  const customCount = useEditor((s) => s.project.customCatalog?.length ?? 0);
  const placing = useEditor((s) => s.placing);

  const result = useMemo(() => {
    void customCount;
    const terms = dq.toLowerCase().split(/\s+/).filter(Boolean);
    const groupCats = group === "Alle" ? null : new Set(CATEGORY_GROUPS.find((g) => g.label === group)?.cats);
    const vis = new Map<string, number>();
    const scopeIds = scope === "merkliste" ? new Set(favorites) : scope === "zuletzt" ? new Set(recentPlaced) : null;
    let l = allCatalog().filter((c) => {
      if (c.vendor === "Bestand") return false;
      if (scopeIds && !scopeIds.has(c.id)) return false;
      if (maxW && c.w > maxW) return false;
      if (vendors.length && !vendors.includes(c.vendor)) return false;
      if (groupCats && !groupCats.has(c.category)) return false;
      if (cat && c.category !== cat) return false;
      if (premium && !scopeIds && !c.premium && !c.concepts?.length) return false;
      if (maxPrice && c.price > maxPrice) return false;
      if (terms.length) {
        const hay = `${c.name} ${c.vendor} ${c.brand ?? ""} ${c.series ?? ""} ${CATEGORY_LABELS[c.category] ?? ""} ${c.variants.map((v) => v.name).join(" ")} ${c.tags?.join(" ") ?? ""}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      if (colorF || matF) {
        const vi = matchVariant(c, colorF, matF);
        if (vi < 0) return false;
        vis.set(c.id, vi);
      } else if (terms.length && c.variants.length > 1) {
        // Suchbegriff trifft eine Ausführung („Bouclé“, „Walnuss“) → diese zeigen
        const vi = c.variants.findIndex((v) => terms.some((t) => v.name.toLowerCase().includes(t)));
        if (vi > 0) vis.set(c.id, vi);
      }
      return true;
    });
    if (sort === "preis") l = l.sort((a, b) => a.price - b.price);
    else if (sort === "preis-") l = l.sort((a, b) => b.price - a.price);
    else if (sort === "name") l = l.sort((a, b) => a.name.localeCompare(b.name, "de"));
    else if (scope === "zuletzt") l = l.sort((a, b) => recentPlaced.indexOf(a.id) - recentPlaced.indexOf(b.id));
    else if (scope === "merkliste") l = l.sort((a, b) => favorites.indexOf(a.id) - favorites.indexOf(b.id));
    else l = l.sort((a, b) => (b.concepts?.length ? 1 : 0) - (a.concepts?.length ? 1 : 0) || (b.premium ? 1 : 0) - (a.premium ? 1 : 0));
    // Treffer, die nur der Premium-Filter verbirgt (Hinweis bei leerer/kurzer Liste)
    const hiddenPremium = premium && !scopeIds && l.length < 8 ? allCatalog().filter((c) => !c.premium && !c.concepts?.length && c.vendor !== "Bestand" && (!terms.length || terms.every((t) => `${c.name} ${c.vendor} ${c.brand ?? ""} ${c.series ?? ""} ${CATEGORY_LABELS[c.category] ?? ""} ${c.variants.map((v) => v.name).join(" ")}`.toLowerCase().includes(t))) && (!groupCats || groupCats.has(c.category)) && (!cat || c.category === cat) && (!vendors.length || vendors.includes(c.vendor))).length : 0;
    return { l, vis, hiddenPremium };
  }, [dq, vendors, group, cat, premium, sort, maxPrice, customCount, colorF, matF, scope, favorites, recentPlaced, maxW]);
  const list = result.l;

  // Fensterung (nur sichtbare Karten rendern)
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [dq, vendors, group, cat, premium, sort, maxPrice, colorF, matF, scope, maxW, view]);
  // Raster: Spaltenzahl nach Leistenbreite, Zeilenhöhe aus Kachelbreite
  const [viewW, setViewW] = useState(320);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols = view === "grid" ? Math.max(2, Math.floor((viewW - 16) / 140)) : 1;
  const ROW = view === "grid" ? Math.round((viewW - 16) / cols - 8 + 64) : 92;
  const rows = Math.ceil(list.length / cols);
  const first = Math.max(0, Math.floor(scrollTop / ROW) - 3);
  const last = Math.min(rows, Math.ceil((scrollTop + viewH) / ROW) + 3);

  const onOpen = useCallback((c: CatalogItem, vi: number) => setOpen({ c, vi }), []);
  const cats = group === "Alle" ? [] : CATEGORY_GROUPS.find((g) => g.label === group)?.cats ?? [];

  return (
    <div className="relative flex h-full flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-stone-400" />
            <input className="field pr-7 pl-8" placeholder="Suchen: Sofa Bouclé, Travertin …" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} aria-label="Katalog durchsuchen" />
            {q && (
              <button className="absolute top-1/2 right-1.5 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-stone-400 hover:bg-stone-500/15 hover:text-stone-700" title="Suche leeren" onClick={() => setQ("")}>
                <X size={12} />
              </button>
            )}
          </div>
          <button className={`btn relative h-[30px] px-2 ${filtersOpen ? "border-accent/40 text-accent-ink" : ""}`} onClick={toggleFilters} title={filtersOpen ? "Filter ausblenden" : "Filter einblenden"} aria-expanded={filtersOpen}>
            <SlidersHorizontal size={14} />
            {activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9.5px] font-bold text-white">{activeFilters}</span>}
          </button>
          <button className="btn h-[30px] px-2" onClick={() => useUi.getState().setPref("catalogView", view === "grid" ? "list" : "grid")} title={view === "grid" ? "Listenansicht" : "Rasteransicht (große Vorschaubilder)"}>
            {view === "grid" ? <List size={14} /> : <LayoutGrid size={14} />}
          </button>
        </div>
        <Seg
          label="Bereich"
          className="flex w-full [&>button]:flex-1"
          value={scope}
          onChange={setScope}
          options={[
            { value: "alle", label: "Alle Produkte" },
            { value: "merkliste", label: <span className="flex items-center justify-center gap-1"><Star size={11} /> Merkliste{favorites.length ? ` (${favorites.length})` : ""}</span>, title: "Mit dem Stern gemerkte Produkte" },
            { value: "zuletzt", label: `Zuletzt${recentPlaced.length ? ` (${recentPlaced.length})` : ""}`, title: "Zuletzt platzierte Produkte" },
          ]}
        />
        {filtersOpen && (
        <div className="fade-in space-y-2">
        <div className="flex flex-wrap gap-1">
          {VENDORS.map((v) => (
            <button key={v} className="chip" data-on={vendors.includes(v)} onClick={() => setVendors((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}>
              {v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {["Alle", ...CATEGORY_GROUPS.map((g) => g.label)].map((g) => (
            <button key={g} className="chip" data-on={group === g} onClick={() => (setGroup(g), setCat(""))}>
              {g}
            </button>
          ))}
        </div>
        {cats.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <button key={c} className="chip" data-on={cat === c} onClick={() => setCat(cat === c ? "" : c)}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="Farbe">
          {COLOR_FAMILIES.map((f) => (
            <button
              key={f.id}
              title={`Ausführung in ${f.label}`}
              onClick={() => setColorF(colorF === f.id ? "" : f.id)}
              className={`h-[18px] w-[18px] shrink-0 rounded-full ring-1 transition ${colorF === f.id ? "ring-2 ring-stone-900 ring-offset-1" : "ring-black/15 hover:ring-stone-500"}`}
              style={{ background: f.swatch }}
            />
          ))}
          <select className="field ml-auto py-0.5 text-xs" style={{ width: 118 }} value={matF} onChange={(e) => setMatF(e.target.value)} title="Material (Bezug, Platte, Korpus oder Gestell)">
            <option value="">Material</option>
            {MATERIAL_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap text-xs">
          <label className="flex items-center gap-1.5 text-stone-700">
            <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} className="" />
            Premium
          </label>
          <select className="field ml-auto w-auto py-0.5 text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="relevanz">Empfohlen</option>
            <option value="preis">Preis ↑</option>
            <option value="preis-">Preis ↓</option>
            <option value="name">Name</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <select className="field py-0.5 text-xs" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} aria-label="Höchstpreis">
            <option value={0}>alle Preise</option>
            {[100, 250, 500, 1000, 2000].map((p) => (
              <option key={p} value={p}>
                ≤ {p} €
              </option>
            ))}
          </select>
          <select className="field py-0.5 text-xs" value={maxW} onChange={(e) => setMaxW(Number(e.target.value))} aria-label="Höchstbreite" title="Passt in die Lücke: höchstens so breit">
            <option value={0}>jede Breite</option>
            {[40, 60, 80, 100, 140, 180, 220, 260].map((w) => (
              <option key={w} value={w}>
                ≤ {w} cm
              </option>
            ))}
          </select>
        </div>
        </div>
        )}
        <div className="flex items-center justify-between text-[11px] text-stone-500">
          <span>
            {list.length.toLocaleString("de-DE")} Produkte
            {colorF || matF ? ` in ${[COLOR_FAMILIES.find((f) => f.id === colorF)?.label, MATERIAL_GROUPS.find((g) => g.id === matF)?.label].filter(Boolean).join(" · ")}` : ""}
          </span>
          {activeFilters > 0 && (
            <button
              className="font-medium text-accent-ink hover:underline"
              onClick={() => {
                setVendors([]);
                setGroup("Alle");
                setCat("");
                setColorF("");
                setMatF("");
                setMaxPrice(0);
                setMaxW(0);
                setPremium(true);
              }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>
      {placing && (
        <div className="slide-up flex items-center justify-between bg-accent px-3 py-1.5 text-xs text-white">
          <span>Zum Platzieren in Plan/3D klicken (Umschalt = mehrfach)</span>
          <button className="underline" onClick={() => useEditor.getState().set("placing", null)}>
            Abbrechen
          </button>
        </div>
      )}
      {result.hiddenPremium > 0 && (
        <button className="mx-3 mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-left text-xs text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100" onClick={() => setPremium(false)}>
          {result.hiddenPremium.toLocaleString("de-DE")} weitere Treffer außerhalb der Premium-Auswahl – <span className="underline">anzeigen</span>
        </button>
      )}
      <div ref={scroller} className="relative flex-1 overflow-auto px-2 py-1" onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
        <div style={{ height: rows * ROW, position: "relative" }}>
          {view === "grid"
            ? Array.from({ length: last - first }, (_, r) => {
                const row = first + r;
                return (
                  <div key={row} className="grid gap-2 px-1" style={{ position: "absolute", top: row * ROW, left: 0, right: 0, height: ROW - 8, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {list.slice(row * cols, row * cols + cols).map((c) => (
                      <Tile key={c.id} c={c} vi={result.vis.get(c.id) ?? 0} onOpen={onOpen} />
                    ))}
                  </div>
                );
              })
            : list.slice(first, last).map((c, i) => (
                <div key={c.id} style={{ position: "absolute", top: (first + i) * ROW, left: 0, right: 0, height: ROW }}>
                  <Card c={c} vi={result.vis.get(c.id) ?? 0} onOpen={onOpen} />
                </div>
              ))}
        </div>
        {list.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-stone-500">
            {scope === "merkliste" ? (
              <>
                <Star size={22} className="mx-auto mb-2 text-stone-300" />
                Noch nichts gemerkt – den Stern an einem Produkt anklicken.
              </>
            ) : scope === "zuletzt" ? (
              "Noch keine Produkte platziert."
            ) : (
              "Keine Produkte für diese Suche und Filter."
            )}
          </div>
        )}
      </div>
      {open && <Detail key={open.c.id} c={open.c} initial={open.vi} onClose={() => setOpen(null)} />}
    </div>
  );
}
