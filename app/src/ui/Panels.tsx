import { useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Search } from "lucide-react";
import { apartment, concepts, roomNames, CATEGORY_LABELS } from "../data";
import { budgetSummary, getCatalogItem, itemPrice, useEditor } from "../store/project";
import { fmtEuro } from "../model/geometry";
import { RoomInspector } from "./Inspector";
import { exportShoppingList, printBudget } from "./fileops";
import { openExternal } from "../platform";
import { DOOR_COLORS, FRAME_COLORS, WALL_MOODS } from "../data/paints";
import { STATUS_ORDER, STATUS_STYLE, nextStatus } from "./status";

export function ObjectsPanel() {
  const st = useEditor();
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const m = new Map<string, typeof st.project.items>();
    for (const it of st.project.items) {
      const label = `${it.label ?? ""} ${it.pos ?? ""} ${getCatalogItem(it.catalogId)?.vendor ?? ""}`.toLowerCase();
      if (q && !label.includes(q.toLowerCase())) continue;
      const k = it.room ?? "–";
      m.set(k, [...(m.get(k) ?? []), it]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [st.project.items, q]);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2 text-stone-400" />
          <input className="field pl-7" placeholder="Objekte filtern …" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {groups.map(([room, items]) => (
          <div key={room} className="mb-3">
            <div className="panel-title mb-1 px-1">
              {roomNames[room] ?? "Außerhalb"} <span className="font-normal normal-case text-stone-400">({items.length})</span>
            </div>
            {items.map((it) => {
              const sel = st.selection.includes(it.id);
              return (
                <div
                  key={it.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs ${sel ? "bg-inverse text-on-inverse" : "hover:bg-card"}`}
                  onClick={(e) => {
                    st.select([it.id], e.shiftKey || e.ctrlKey);
                    st.requestFocus(it.x, it.y);
                  }}
                  onMouseEnter={() => st.setHover(it.id)}
                  onMouseLeave={() => st.setHover(null)}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: it.slots.main?.color ?? it.slots.top?.color ?? "#ccc" }} />
                  <span className="w-12 shrink-0 font-mono text-[10px] opacity-70">{it.pos ?? ""}</span>
                  <span className="min-w-0 flex-1 truncate">{it.label ?? getCatalogItem(it.catalogId)?.name}</span>
                  {it.locked && <Lock size={11} className="opacity-60" />}
                  <button
                    className="opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      st.updateItems([it.id], (x) => void (x.hidden = !x.hidden));
                    }}
                  >
                    {it.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <span className="w-16 shrink-0 text-right tabular-nums opacity-80">{it.existing ? "Bestand" : fmtEuro(itemPrice(it)).replace(",00", "")}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConceptsPanel() {
  const st = useEditor();
  return (
    <div className="h-full space-y-3 overflow-auto p-3">
      <p className="text-xs leading-relaxed text-stone-600">
        Die vier Möblierungskonzepte sind vollständig übernommen – alle Positionen mit exakten Planpositionen, Maßen, Farben, Preisen und Shop-Links. Ein Konzept laden ersetzt das aktuelle Projekt (rückgängig mit Strg+Z).
      </p>
      <button className="w-full rounded-xl border-2 border-dashed border-accent/40 bg-card p-3 text-left hover:border-accent" onClick={() => st.set("newDialogOpen", true)}>
        <div className="text-sm font-semibold text-accent-ink">Leere Wohnung von Grund auf einrichten</div>
        <div className="mt-0.5 text-xs text-stone-600">Bestand wählen (Küche, Sanitär), Farbstimmung und Boden festlegen, dann frei möblieren und gestalten.</div>
      </button>
      {concepts.map((c) => {
        const b = budgetSummary(c.project).total;
        const active = st.project.conceptId === c.id;
        return (
          <div key={c.id} className={`overflow-hidden rounded-xl border bg-card shadow-sm ${active ? "border-accent ring-2 ring-accent/20" : "border-stone-200"}`}>
            <div className="flex h-8">
              {c.palette.map((p) => (
                <div key={p} className="flex-1" style={{ background: p }} />
              ))}
            </div>
            <div className="p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{c.subtitle}</div>
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="mt-1 text-xs text-stone-600">{c.project.subtitle}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{fmtEuro(b)}</span>
                <span className="text-xs text-stone-500">{c.project.items.filter((i) => !i.existing).length} Objekte</span>
              </div>
              <button className={active ? "btn mt-2 w-full" : "btn-primary mt-2 w-full"} onClick={() => st.loadConcept(c.id)}>
                {active ? "Erneut laden (Original)" : "Konzept laden"}
              </button>
            </div>
          </div>
        );
      })}
      <button className="btn w-full" onClick={() => st.newEmptyProject()}>
        Leere Wohnung (nur Bestand)
      </button>
    </div>
  );
}

function Swatches({ options, value, onPick }: { options: [string, string][]; value?: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([c, l]) => (
        <button key={c} title={l} onClick={() => onPick(c)} className={`h-6 w-6 rounded-full border ${value === c ? "ring-2 ring-accent ring-offset-1" : "border-stone-300"}`} style={{ background: c }} />
      ))}
    </div>
  );
}

/** Ausbau der ganzen Wohnung: Farbstimmung, Türen, Griffe, Fensterrahmen. */
function ApartmentDesign() {
  const st = useEditor();
  const s = st.project.settings;
  const indoor = apartment.rooms.filter((r) => !r.outdoor).map((r) => r.id);
  return (
    <div className="space-y-3 border-b border-stone-200 p-3">
      <div>
        <div className="panel-title mb-1.5">Farbstimmung ganze Wohnung</div>
        <div className="flex flex-wrap gap-1">
          {WALL_MOODS.map((m) => (
            <button
              key={m.label}
              className="chip"
              onClick={() =>
                st.applyToRooms(indoor, (r) => ({ ...r, ceiling: m.ceiling, wall: { ...r.wall, base: { kind: "paint", color: m.color, productName: m.productName } } }))
              }
            >
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-stone-300 align-middle" style={{ background: m.color }} />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="panel-title mb-1.5">Innentüren</div>
        <Swatches options={DOOR_COLORS} value={s.doorColor ?? "#f4f3ef"} onPick={(c) => st.setSettings({ doorColor: c })} />
        <div className="mt-1.5 flex flex-wrap gap-1">
          <div className="seg">
            {(["flat", "panel", "groove"] as const).map((k) => (
              <button key={k} data-on={(s.doorStyle ?? "flat") === k} onClick={() => st.setSettings({ doorStyle: k })}>
                {{ flat: "glatt", panel: "Kassette", groove: "Rillen" }[k]}
              </button>
            ))}
          </div>
          <div className="seg">
            {(["blackMetal", "brass", "steel"] as const).map((k) => (
              <button key={k} data-on={(s.handleFinish ?? "blackMetal") === k} onClick={() => st.setSettings({ handleFinish: k })}>
                {{ blackMetal: "Griff schwarz", brass: "Messing", steel: "Edelstahl" }[k]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div className="panel-title mb-1.5">Fensterrahmen</div>
        <Swatches options={FRAME_COLORS} value={s.windowFrameColor ?? "#3b3d40"} onPick={(c) => st.setSettings({ windowFrameColor: c })} />
      </div>
    </div>
  );
}

export function DesignPanel() {
  const st = useEditor();
  const room = st.selectedRoom ?? "13.01";
  return (
    <div className="flex h-full flex-col overflow-auto">
      <ApartmentDesign />
      <div className="border-b border-stone-200 p-3">
        <div className="panel-title mb-1.5">Raum wählen</div>
        <div className="flex flex-wrap gap-1">
          {apartment.rooms.map((r) => (
            <button key={r.id} className="chip" data-on={room === r.id} onClick={() => (st.selectRoom(r.id), st.selectFace(null))}>
              {r.name.split(" / ")[0]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-stone-500">Einzelne Wand gestalten: Wand im Plan (Innenkante) oder in der 3D-Ansicht anklicken.</p>
      </div>
      <div className="flex-1">
        <RoomInspector roomId={room} />
      </div>
    </div>
  );
}

export function BudgetPanel() {
  const project = useEditor((s) => s.project);
  const setStatus = useEditor((s) => s.setStatus);
  const limit = project.settings.budgetLimit || 40000;
  const b = useMemo(() => budgetSummary(project), [project]);
  const pct = Math.min(100, (b.total / limit) * 100);
  const vendorColors: Record<string, string> = { Westwing: "#1f1f1f", IKEA: "#0058a3", JYSK: "#143c8a", Designhandel: "#b8703e", DELIFE: "#c8a96a", Tylko: "#7f9a86", OBI: "#e35f1d", Fachhandel: "#a8a29e" };
  const [group, setGroup] = useState<"room" | "vendor" | "status">("room");
  const grouped = useMemo(() => {
    const m = new Map<string, typeof b.lines>();
    for (const l of b.lines) {
      const k = group === "room" ? roomNames[l.room] ?? l.room : group === "vendor" ? l.vendor : STATUS_STYLE[l.status].label;
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.entries()].sort((x, y) => y[1].reduce((a, l) => a + l.total, 0) - x[1].reduce((a, l) => a + l.total, 0));
  }, [b, group]);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">{fmtEuro(b.total)}</span>
          <span className="text-xs text-stone-500">Rahmen bis {fmtEuro(limit)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
          <div className={`h-full ${b.total > limit ? "bg-red-600" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full">
          {Object.entries(b.byVendor).map(([v, s]) => (
            <div key={v} title={`${v}: ${fmtEuro(s)}`} style={{ width: `${(s / Math.max(1, b.total)) * 100}%`, background: vendorColors[v] ?? "#999" }} />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-600">
          {Object.entries(b.byVendor)
            .sort((x, y) => y[1] - x[1])
            .map(([v, s]) => (
              <span key={v}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: vendorColors[v] ?? "#999" }} />
                {v} {fmtEuro(s).replace(",00", "")} ({((s / Math.max(1, b.total)) * 100).toFixed(1)} %)
              </span>
            ))}
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-stone-100" title="Kaufstatus">
          {STATUS_ORDER.filter((s) => s !== "geplant").map((s) => (
            <div key={s} style={{ width: `${(b.byStatus[s] / Math.max(1, b.total)) * 100}%`, background: STATUS_STYLE[s].color }} />
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-stone-600">
          {STATUS_ORDER.filter((s) => s !== "geplant").map((s) => (
            <span key={s}>
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[s].color }} />
              {STATUS_STYLE[s].label} {fmtEuro(b.byStatus[s]).replace(",00", "")}
            </span>
          ))}
          <span className="font-medium">offen {fmtEuro(b.byStatus.geplant).replace(",00", "")}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="seg">
            <button data-on={group === "room"} onClick={() => setGroup("room")}>
              Raum
            </button>
            <button data-on={group === "vendor"} onClick={() => setGroup("vendor")}>
              Händler
            </button>
            <button data-on={group === "status"} onClick={() => setGroup("status")}>
              Status
            </button>
          </div>
          <label className="ml-auto flex items-center gap-1 text-xs text-stone-600">
            Budget
            <input
              className="field w-24 py-0.5 text-right text-xs"
              type="number"
              value={limit}
              onChange={(e) => useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, budgetLimit: Number(e.target.value) || 0 } } }))}
            />
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {grouped.map(([k, lines]) => (
          <div key={k} className="mb-3">
            <div className="flex justify-between px-1">
              <span className="panel-title">{k}</span>
              <span className="text-xs font-semibold tabular-nums">{fmtEuro(lines.reduce((a, l) => a + l.total, 0))}</span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="flex items-start gap-2 rounded px-1 py-0.5 text-[11.5px] hover:bg-card">
                <span className="w-10 shrink-0 font-mono text-[10px] text-stone-500">{l.pos ?? ""}</span>
                <span className="min-w-0 flex-1">
                  {l.url ? (
                    <button className="text-left hover:underline" onClick={() => openExternal(l.url!)}>
                      {l.name}
                    </button>
                  ) : (
                    l.name
                  )}
                  <span className="text-stone-400"> · {l.vendor}{group === "vendor" ? ` · ${roomNames[l.room] ?? l.room}` : ""}{l.category && CATEGORY_LABELS[l.category] ? "" : ""}</span>
                </span>
                <span className="shrink-0 tabular-nums text-stone-500">{+l.qty.toFixed(2)}×</span>
                <span className="flex w-20 shrink-0 flex-col items-end gap-0.5">
                  <span className="tabular-nums">{fmtEuro(l.total)}</span>
                  <button
                    className={`rounded-full px-1.5 text-[10px] leading-4 ring-1 ${STATUS_STYLE[l.status].cls}`}
                    title="Kaufstatus weiterschalten: geplant → bestellt → geliefert → aufgebaut"
                    onClick={() => setStatus(l.itemIds, l.budgetId ? [l.budgetId] : [], nextStatus(l.status))}
                  >
                    {STATUS_STYLE[l.status].short}
                  </button>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-stone-200 p-3">
        <button className="btn" onClick={exportShoppingList}>
          Einkaufsliste (CSV)
        </button>
        <button className="btn" onClick={printBudget}>
          Drucken / PDF
        </button>
      </div>
    </div>
  );
}
