import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { allCatalog, getCatalogItem, useEditor } from "../store/project";
import { roomNames } from "../data";
import { fmtEuro } from "../model/geometry";
import { matches, staticCommands, type Command } from "./commands";

/** Befehlssuche (Strg+K): Befehle, Räume, Objekte im Projekt und Katalogprodukte an einem Ort. */
export function CommandPalette() {
  const open = useEditor((s) => s.paletteOpen);
  if (!open) return null;
  return <Palette />;
}

function Palette() {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => useEditor.getState().set("paletteOpen", false);

  const results = useMemo(() => {
    const st = useEditor.getState();
    const out: Command[] = [];
    const cmds = staticCommands().filter((c) => !c.enabled || c.enabled());
    if (!q.trim()) return cmds.filter((c) => ["Datei", "Bearbeiten", "Ansicht"].includes(c.group)).slice(0, 14);
    out.push(...cmds.filter((c) => matches(`${c.group} ${c.label} ${c.keywords ?? ""}`, q)).slice(0, 12));
    // Objekte im Projekt
    const objs = st.project.items.filter((it) => matches(`${it.label ?? ""} ${it.pos ?? ""} ${getCatalogItem(it.catalogId)?.vendor ?? ""} ${roomNames[it.room ?? ""] ?? ""}`, q)).slice(0, 6);
    for (const it of objs) {
      out.push({
        id: `obj-${it.id}`,
        group: "Im Projekt",
        label: `${it.pos ? `${it.pos} · ` : ""}${it.label ?? getCatalogItem(it.catalogId)?.name ?? "Objekt"} – ${roomNames[it.room ?? ""] ?? "außerhalb"}`,
        run: () => {
          st.select([it.id]);
          st.requestFocus(it.x, it.y);
        },
      });
    }
    // Katalog
    if (q.trim().length >= 2) {
      const cat = allCatalog().filter((c) => matches(`${c.name} ${c.vendor} ${c.tags?.join(" ") ?? ""}`, q)).slice(0, 8);
      for (const c of cat) {
        out.push({
          id: `cat-${c.id}`,
          group: "Katalog",
          label: `${c.name} (${c.vendor}, ${Math.round(c.w)} × ${Math.round(c.d)} cm${c.price ? `, ${fmtEuro(c.price)}` : ""})`,
          run: () => {
            st.set("placing", { catalogId: c.id, variant: 0 });
            st.showToast("In den Plan klicken zum Platzieren · Umschalt+Klick: mehrere · Esc: abbrechen");
          },
        });
      }
    }
    return out;
  }, [q]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    close();
    c.run();
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[110] flex justify-center bg-black/25 p-4 pt-[12vh]" onMouseDown={close}>
      <div className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-stone-200 px-3">
          <Search size={16} className="text-stone-400" />
          <input
            autoFocus
            className="w-full bg-transparent py-3 text-sm outline-none"
            placeholder="Befehl, Raum, Objekt oder Produkt suchen …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(results[idx]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            }}
          />
          <kbd className="rounded border border-stone-200 px-1.5 text-[10px] text-stone-400">Esc</kbd>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-auto p-1">
          {results.length === 0 && <div className="p-4 text-sm text-stone-500">Nichts gefunden.</div>}
          {results.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {head && <div className="px-2.5 pb-0.5 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-stone-400">{head}</div>}
                <button
                  data-i={i}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${i === idx ? "bg-stone-800 text-white" : "text-stone-700 hover:bg-stone-100"}`}
                  onMouseMove={() => i !== idx && setIdx(i)}
                  onClick={() => run(c)}
                >
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.kbd && <span className={`text-[11px] ${i === idx ? "text-stone-300" : "text-stone-400"}`}>{c.kbd}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-400">↑ ↓ auswählen · Enter ausführen · Katalogtreffer: danach in den Plan klicken</div>
      </div>
    </div>
  );
}
