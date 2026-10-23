import { useMemo, useState } from "react";
import { AlertTriangle, Check, CircleAlert, Info, Pencil, Trash2 } from "lucide-react";
import { concepts, roomNames } from "../data";
import { budgetSummary, useEditor } from "../store/project";
import type { CheckLevel } from "../model/check";
import { useChecks } from "./useChecks";
import { diffVariants, itemName } from "../store/variants";
import { fmtEuro } from "../model/geometry";
import type { ProjectVariant } from "../model/types";

const LEVEL: Record<CheckLevel, { label: string; cls: string; icon: typeof Info }> = {
  fehler: { label: "Fehler", cls: "text-red-700", icon: CircleAlert },
  warnung: { label: "Eng", cls: "text-amber-700", icon: AlertTriangle },
  hinweis: { label: "Hinweis", cls: "text-sky-700", icon: Info },
};

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-stone-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="panel-title">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function CheckSection() {
  const st = useEditor();
  const { findings } = useChecks();
  const [filter, setFilter] = useState<CheckLevel | "alle">("alle");
  const counts = { fehler: 0, warnung: 0, hinweis: 0 } as Record<CheckLevel, number>;
  for (const f of findings) counts[f.level]++;
  const shown = findings.filter((f) => filter === "alle" || f.level === filter);
  return (
    <Section
      title="Planungs-Check"
      right={
        <label className="flex items-center gap-1 text-[11px] text-stone-600" title="Bewegungsflächen und Türschwenkbereiche im Plan einblenden">
          <input type="checkbox" className="accent-emerald-800" checked={st.showClearance} onChange={(e) => st.set("showClearance", e.target.checked)} />
          im Plan zeigen
        </label>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1">
        <button className="chip" data-on={filter === "alle"} onClick={() => setFilter("alle")}>
          alle {findings.length}
        </button>
        {(Object.keys(LEVEL) as CheckLevel[]).map((l) => (
          <button key={l} className="chip" data-on={filter === l} onClick={() => setFilter(l)}>
            {LEVEL[l].label} {counts[l]}
          </button>
        ))}
      </div>
      {findings.length === 0 && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-900">
          <Check size={14} /> Keine Konflikte: Bewegungsflächen, Türen, Balkonzugänge und Lieferweg sind in Ordnung.
        </div>
      )}
      <div className="space-y-1">
        {shown.map((f) => {
          const L = LEVEL[f.level];
          return (
            <button
              key={f.id}
              className="flex w-full items-start gap-2 rounded-md bg-white p-2 text-left text-xs shadow-sm ring-1 ring-stone-200 hover:ring-stone-400"
              onClick={() => {
                st.select(f.itemIds.filter((id) => st.project.items.some((i) => i.id === id)));
                st.requestFocus(f.at[0], f.at[1]);
              }}
            >
              <L.icon size={14} className={`mt-px shrink-0 ${L.cls}`} />
              <span className="min-w-0">
                <span className="font-medium">{f.title}</span>
                <span className="block text-stone-500">{f.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-stone-500">
        Richtwerte nach DIN 18011/18022: vor Schränken 70–90 cm, neben dem Bett 60–70 cm, hinter Esstischstühlen 75–90 cm, vor der Küche 100–120 cm, Couchtisch 30–50 cm vor dem Sofa, Fenstertüren 90 cm frei. Bestand gegen Bestand wird nicht gemeldet.
      </p>
    </Section>
  );
}

type CompareTarget = { kind: "variant"; id: string } | { kind: "concept"; id: string };

function VariantsSection() {
  const st = useEditor();
  const variants = st.project.variants ?? [];
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [target, setTarget] = useState<CompareTarget | null>(null);
  const curTotal = useMemo(() => budgetSummary(st.project).total, [st.project]);
  const ref: Pick<ProjectVariant, "items" | "budget" | "rooms" | "walls"> | undefined =
    target?.kind === "variant" ? variants.find((v) => v.id === target.id) : target ? concepts.find((c) => c.id === target.id)?.project : undefined;
  const refName = target?.kind === "variant" ? variants.find((v) => v.id === target.id)?.name : concepts.find((c) => c.id === target?.id)?.subtitle;
  const diff = useMemo(() => (ref ? diffVariants(st.project, ref, st.project) : null), [ref, st.project]);
  const save = () => {
    const n = name.trim() || `Variante ${variants.length + 1}`;
    st.saveVariant(n);
    setName("");
  };
  return (
    <Section title={`Varianten (${variants.length})`}>
      <div className="flex gap-1">
        <input className="field text-xs" placeholder={`Variante ${variants.length + 1}, z. B. „Sofa an Ostwand“`} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        <button className="btn-primary shrink-0 px-2 text-xs" onClick={save} title="Aktuellen Stand (Möbel, Gestaltung, Budget) als Variante sichern">
          Sichern
        </button>
      </div>
      <div className="mt-2 space-y-1">
        {variants.map((v) => {
          const total = budgetSummary({ ...st.project, items: v.items, budget: v.budget }).total;
          const on = target?.kind === "variant" && target.id === v.id;
          return (
            <div key={v.id} className={`rounded-md bg-white p-2 text-xs shadow-sm ring-1 ${on ? "ring-emerald-800" : "ring-stone-200"}`}>
              <div className="flex items-center gap-1">
                {editing === v.id ? (
                  <input className="field py-0.5 text-xs" autoFocus defaultValue={v.name} onBlur={(e) => (st.renameVariant(v.id, e.target.value.trim() || v.name), setEditing(null))} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                ) : (
                  <span className="min-w-0 flex-1 truncate font-medium" title={v.name}>
                    {v.name}
                  </span>
                )}
                <span className="shrink-0 tabular-nums text-stone-600">{fmtEuro(total).replace(",00", "")}</span>
                <button className="btn-ghost p-1" title="Umbenennen" onClick={() => setEditing(v.id)}>
                  <Pencil size={12} />
                </button>
                <button className="btn-ghost p-1" title="Löschen" onClick={() => confirm(`Variante „${v.name}“ löschen?`) && st.deleteVariant(v.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="mt-0.5 text-[10.5px] text-stone-500">
                {new Date(v.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} · {v.items.filter((i) => !i.existing).length} Objekte
              </div>
              <div className="mt-1.5 flex gap-1">
                <button className="btn flex-1 py-0.5 text-xs" onClick={() => st.loadVariant(v.id)} title="Arbeitsstand durch diese Variante ersetzen (rückgängig mit Strg+Z)">
                  Laden
                </button>
                <button className="btn flex-1 py-0.5 text-xs" onClick={() => confirm(`„${v.name}“ mit dem aktuellen Stand überschreiben?`) && st.overwriteVariant(v.id)}>
                  Überschreiben
                </button>
                <button className={`flex-1 py-0.5 text-xs ${on ? "btn-primary" : "btn"}`} onClick={() => setTarget(on ? null : { kind: "variant", id: v.id })}>
                  Vergleichen
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-stone-600">
        Vergleich mit Konzept:
        {concepts.map((c) => (
          <button key={c.id} className="chip" data-on={target?.kind === "concept" && target.id === c.id} onClick={() => setTarget(target?.kind === "concept" && target.id === c.id ? null : { kind: "concept", id: c.id })}>
            {c.subtitle.replace("Konzept ", "K")}
          </button>
        ))}
      </div>
      {diff && (
        <div className="mt-2 rounded-md bg-stone-50 p-2 text-xs ring-1 ring-stone-200">
          <div className="mb-1 font-semibold">
            Aktueller Stand gegenüber „{refName}“
          </div>
          <table className="w-full tabular-nums">
            <thead>
              <tr className="text-[10.5px] text-stone-500">
                <th className="text-left font-normal" />
                <th className="text-right font-normal">{refName}</th>
                <th className="text-right font-normal">aktuell</th>
                <th className="text-right font-normal">Δ</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold">
                <td>Gesamt</td>
                <td className="text-right">{fmtEuro(diff.totalA).replace(",00", "")}</td>
                <td className="text-right">{fmtEuro(curTotal).replace(",00", "")}</td>
                <td className={`text-right ${diff.totalB > diff.totalA ? "text-red-700" : "text-emerald-800"}`}>{signed(diff.totalB - diff.totalA)}</td>
              </tr>
              <tr>
                <td>Objekte</td>
                <td className="text-right">{diff.countA}</td>
                <td className="text-right">{diff.countB}</td>
                <td className="text-right">{diff.countB - diff.countA > 0 ? "+" : ""}{diff.countB - diff.countA}</td>
              </tr>
              {diff.byRoom
                .filter((r) => Math.abs(r.b - r.a) > 0.5)
                .map((r) => (
                  <tr key={r.room} className="text-stone-600">
                    <td className="truncate pl-2">{(roomNames[r.room] ?? r.room).split(" / ")[0]}</td>
                    <td className="text-right">{fmtEuro(r.a).replace(",00", "")}</td>
                    <td className="text-right">{fmtEuro(r.b).replace(",00", "")}</td>
                    <td className="text-right">{signed(r.b - r.a)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <DiffList title="Neu" color="text-emerald-800" rows={diff.added.map((i) => itemName(i))} />
          <DiffList title="Entfallen" color="text-red-700" rows={diff.removed.map((i) => itemName(i))} />
          <DiffList title="Getauscht" color="text-stone-700" rows={diff.swapped.map((s) => `${itemName(s.a)} → ${itemName(s.b)}`)} />
          <DiffList title="Andere Farbe/Ausführung" color="text-stone-700" rows={diff.restyled.map((s) => `${itemName(s.b)}: ${s.a.variant ?? "–"} → ${s.b.variant ?? "–"}`)} />
          <DiffList title="Verschoben/Maße" color="text-stone-700" rows={diff.moved.map((s) => `${itemName(s.b)}${s.dist > 0.05 ? ` (${Math.round(s.dist * 100)} cm)` : ""}`)} />
          {diff.finishesChanged.length > 0 && (
            <div className="mt-1.5 text-stone-600">
              <span className="font-medium">Gestaltung geändert:</span> {diff.finishesChanged.map((r) => (roomNames[r] ?? r).split(" / ")[0]).join(", ")}
            </div>
          )}
          {!diff.added.length && !diff.removed.length && !diff.swapped.length && !diff.restyled.length && !diff.moved.length && !diff.finishesChanged.length && <div className="mt-1.5 text-stone-500">Keine Unterschiede.</div>}
        </div>
      )}
    </Section>
  );
}

function signed(v: number): string {
  if (Math.abs(v) < 0.5) return "±0";
  return `${v > 0 ? "+" : "−"}${fmtEuro(Math.abs(v)).replace(",00", "")}`;
}

function DiffList({ title, rows, color }: { title: string; rows: string[]; color: string }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const shown = open ? rows : rows.slice(0, 4);
  return (
    <div className="mt-1.5">
      <div className={`font-medium ${color}`}>
        {title} ({rows.length})
      </div>
      {shown.map((r, i) => (
        <div key={i} className="truncate pl-2 text-stone-600" title={r}>
          {r}
        </div>
      ))}
      {rows.length > 4 && (
        <button className="pl-2 text-[11px] text-emerald-800 hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? "weniger" : `alle ${rows.length} zeigen`}
        </button>
      )}
    </div>
  );
}

function RoomStatsSection() {
  const { rooms } = useChecks();
  const project = useEditor((s) => s.project);
  const b = useMemo(() => budgetSummary(project), [project]);
  return (
    <Section title="Raumkennzahlen">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="text-[10.5px] text-stone-500">
            <th className="text-left font-normal">Raum</th>
            <th className="text-right font-normal">Fläche</th>
            <th className="text-right font-normal">frei</th>
            <th className="text-right font-normal">Kosten</th>
            <th className="text-right font-normal">€/m²</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => {
            const cost = b.byRoom[r.roomId] ?? 0;
            const pct = r.area > 0 ? (r.free / r.area) * 100 : 0;
            return (
              <tr key={r.roomId} className="border-t border-stone-100">
                <td className="truncate py-0.5">{(roomNames[r.roomId] ?? r.roomId).split(" / ")[0]}</td>
                <td className="text-right">{r.area.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</td>
                <td className={`text-right ${pct < 45 ? "text-amber-700" : ""}`} title={`${r.free.toLocaleString("de-DE", { maximumFractionDigits: 1 })} m² Bodenfläche frei (ohne Teppiche)`}>
                  {Math.round(pct)} %
                </td>
                <td className="text-right">{fmtEuro(cost).replace(",00", "")}</td>
                <td className="text-right text-stone-500">{r.area > 0 ? Math.round(cost / r.area).toLocaleString("de-DE") : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1.5 text-[10.5px] text-stone-500">„frei“ = Bodenfläche ohne Stellflächen der Möbel. Unter etwa 45 % wirkt ein Wohnraum schnell vollgestellt.</p>
    </Section>
  );
}

export function PlanningPanel() {
  return (
    <div className="h-full overflow-auto">
      <CheckSection />
      <VariantsSection />
      <RoomStatsSection />
    </div>
  );
}
