import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Plus, Search, Sparkles, X } from "lucide-react";
import { CATEGORY_GROUPS, CATEGORY_LABELS, apartment, roomNames } from "../data";
import { allCatalog, useEditor } from "../store/project";
import type { CatalogItem } from "../model/types";
import { getThumbnail } from "../three/thumbnails";
import { openExternal } from "../platform";
import { fmtEuro, polygonCentroid } from "../model/geometry";

const VENDORS = ["Westwing", "IKEA", "JYSK", "Designhandel", "Tylko", "OBI", "Fachhandel"];

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
    <div ref={ref} className="flex items-center justify-center overflow-hidden rounded-md bg-gradient-to-b from-stone-50 to-stone-200/70" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" className="h-full w-full object-contain" draggable={false} /> : <div className="h-6 w-6 animate-pulse rounded-full bg-stone-300/60" />}
    </div>
  );
}

const Card = memo(function Card({ c, onOpen }: { c: CatalogItem; onOpen: (c: CatalogItem) => void }) {
  const place = useEditor((s) => s.set);
  return (
    <div className="group flex cursor-pointer gap-2.5 rounded-lg border border-transparent p-1.5 transition hover:border-stone-200 hover:bg-white hover:shadow-sm" onClick={() => onOpen(c)}>
      <Thumb c={c} size={76} />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1 text-[10px] font-semibold ${c.vendor === "Westwing" ? "bg-[#1f1f1f] text-white" : c.vendor === "IKEA" ? "bg-[#0058a3] text-[#ffdb00]" : c.vendor === "JYSK" ? "bg-[#143c8a] text-white" : "bg-stone-200 text-stone-700"}`}>{c.vendor}</span>
          {c.concepts?.length ? <span className="text-[10px] text-emerald-800">Konzept {c.concepts.join(", ")}</span> : null}
          {c.premium && !c.concepts?.length ? <Sparkles size={11} className="text-amber-600" /> : null}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-tight text-stone-800">{c.name}</div>
        <div className="mt-0.5 text-[11px] text-stone-500">
          {Math.round(c.w)} × {Math.round(c.d)} × {Math.round(c.h)} cm{c.variants.length > 1 ? ` · ${c.variants.length} Varianten` : ""}
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-stone-900">{c.price > 0 ? fmtEuro(c.price) : "—"}</span>
          <button
            className="rounded-md bg-[#2f5d50] px-1.5 py-0.5 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              place("placing", { catalogId: c.id, variant: 0 });
            }}
          >
            Platzieren
          </button>
        </div>
      </div>
    </div>
  );
});

function Detail({ c, onClose }: { c: CatalogItem; onClose: () => void }) {
  const [variant, setVariant] = useState(0);
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
    <div className="absolute inset-0 z-20 flex flex-col bg-[#faf8f5]">
      <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
        <span className="panel-title">Produkt</span>
        <button className="btn-ghost" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="flex justify-center rounded-xl bg-gradient-to-b from-white to-stone-200/60 p-2">
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
        {c.variants.length > 1 && (
          <div className="mt-3">
            <div className="panel-title mb-1.5">Varianten</div>
            <div className="flex flex-wrap gap-1.5">
              {c.variants.map((vv, i) => {
                const col = vv.slots.main?.color ?? vv.slots.top?.color ?? vv.slots.frame?.color ?? "#ccc";
                return (
                  <button key={i} title={vv.name} onClick={() => setVariant(i)} className={`h-7 w-7 rounded-full border-2 ${i === variant ? "border-stone-900" : "border-white"} shadow ring-1 ring-stone-300`} style={{ background: col }} />
                );
              })}
            </div>
            <div className="mt-1 text-xs text-stone-600">{v?.name}</div>
          </div>
        )}
        {c.description && <p className="mt-3 text-xs leading-relaxed text-stone-600">{c.description}</p>}
        {(v?.url ?? c.url) && (
          <button className="btn mt-3 w-full" onClick={() => openExternal((v?.url ?? c.url)!)}>
            <ExternalLink size={14} /> Im Shop ansehen
          </button>
        )}
        {c.image && (
          <div className="mt-3">
            <div className="panel-title mb-1">Produktfoto (online)</div>
            <img src={c.image.includes("cdn.shopify") ? `${c.image}&width=480` : c.image} alt="" className="w-full rounded-lg bg-white object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-stone-200 p-3">
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
  const [open, setOpen] = useState<CatalogItem | null>(null);
  const customCount = useEditor((s) => s.project.customCatalog?.length ?? 0);
  const placing = useEditor((s) => s.placing);

  const list = useMemo(() => {
    void customCount;
    const terms = dq.toLowerCase().split(/\s+/).filter(Boolean);
    const groupCats = group === "Alle" ? null : new Set(CATEGORY_GROUPS.find((g) => g.label === group)?.cats);
    let l = allCatalog().filter((c) => {
      if (c.vendor === "Bestand") return false;
      if (vendors.length && !vendors.includes(c.vendor)) return false;
      if (groupCats && !groupCats.has(c.category)) return false;
      if (cat && c.category !== cat) return false;
      if (premium && !c.premium && !c.concepts?.length) return false;
      if (maxPrice && c.price > maxPrice) return false;
      if (terms.length) {
        const hay = `${c.name} ${c.vendor} ${c.series ?? ""} ${CATEGORY_LABELS[c.category] ?? ""} ${c.variants.map((v) => v.name).join(" ")} ${c.tags?.join(" ") ?? ""}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
    if (sort === "preis") l = l.sort((a, b) => a.price - b.price);
    else if (sort === "preis-") l = l.sort((a, b) => b.price - a.price);
    else if (sort === "name") l = l.sort((a, b) => a.name.localeCompare(b.name, "de"));
    else l = l.sort((a, b) => (b.concepts?.length ? 1 : 0) - (a.concepts?.length ? 1 : 0) || (b.premium ? 1 : 0) - (a.premium ? 1 : 0));
    return l;
  }, [dq, vendors, group, cat, premium, sort, maxPrice, customCount]);

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
  }, [dq, vendors, group, cat, premium, sort, maxPrice]);
  const ROW = 92;
  const first = Math.max(0, Math.floor(scrollTop / ROW) - 4);
  const last = Math.min(list.length, Math.ceil((scrollTop + viewH) / ROW) + 4);

  const cats = group === "Alle" ? [] : CATEGORY_GROUPS.find((g) => g.label === group)?.cats ?? [];

  return (
    <div className="relative flex h-full flex-col">
      <div className="space-y-2 border-b border-stone-200 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2 text-stone-400" />
          <input className="field pl-7" placeholder="Suchen: Sofa Bouclé, Travertin, Messing …" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
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
        <div className="flex items-center gap-2 whitespace-nowrap text-xs">
          <label className="flex items-center gap-1.5 text-stone-700">
            <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} className="accent-emerald-800" />
            Premium
          </label>
          <select className="field ml-auto w-auto py-0.5 text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="relevanz">Empfohlen</option>
            <option value="preis">Preis ↑</option>
            <option value="preis-">Preis ↓</option>
            <option value="name">Name</option>
          </select>
          <select className="field w-auto py-0.5 text-xs" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
            <option value={0}>alle Preise</option>
            {[100, 250, 500, 1000, 2000].map((p) => (
              <option key={p} value={p}>
                ≤ {p} €
              </option>
            ))}
          </select>
        </div>
        <div className="text-[11px] text-stone-500">{list.length.toLocaleString("de-DE")} Produkte</div>
      </div>
      {placing && (
        <div className="flex items-center justify-between bg-emerald-900 px-3 py-1.5 text-xs text-white">
          <span>Zum Platzieren in Plan/3D klicken (Umschalt = mehrfach)</span>
          <button className="underline" onClick={() => useEditor.getState().set("placing", null)}>
            Abbrechen
          </button>
        </div>
      )}
      <div ref={scroller} className="relative flex-1 overflow-auto px-2 py-1" onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
        <div style={{ height: list.length * ROW, position: "relative" }}>
          {list.slice(first, last).map((c, i) => (
            <div key={c.id} style={{ position: "absolute", top: (first + i) * ROW, left: 0, right: 0, height: ROW }}>
              <Card c={c} onOpen={setOpen} />
            </div>
          ))}
        </div>
      </div>
      {open && <Detail c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
