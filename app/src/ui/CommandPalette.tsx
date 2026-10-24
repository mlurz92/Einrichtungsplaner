import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { allCatalog, getCatalogItem, useEditor } from "../store/project";
import { roomNames } from "../data";
import { fmtEuro } from "../model/geometry";
import { matches, staticCommands, type Command } from "./commands";
import { useUi } from "./prefs";

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
    if (!q.trim()) {
      // Zuletzt benutzte Befehle zuerst, danach die häufigsten
      const recent = useUi
        .getState()
        .recentCommands.map((id) => cmds.find((c) => c.id === id))
        .filter((c): c is Command => !!c)
        .map((c) => ({ ...c, group: "Zuletzt benutzt" }));
      const ids = new Set(recent.map((c) => c.id));
      return [...recent, ...cmds.filter((c) => !ids.has(c.id) && ["Datei", "Bearbeiten", "Ansicht"].includes(c.group)).slice(0, 14 - Math.min(6, recent.length))];
    }
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
    if (!c.id.startsWith("obj-") && !c.id.startsWith("cat-")) useUi.getState().noteCommand(c.id);
    c.run();
  };

  let lastGroup = "";
  return (
    <div className="scrim fixed inset-0 z-[110] flex justify-center p-4 pt-[12vh]" onMouseDown={close}>
      <div role="dialog" aria-modal="true" aria-label="Befehlssuche" className="glass-strong grain pop-in flex max-h-[70vh] w-full max-w-2xl flex-col self-start overflow-hidden rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={18} className="text-accent-ink" />
          <input
            autoFocus
            className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-stone-400"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={`palette-${idx}`}
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
          <kbd>Esc</kbd>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="min-h-0 flex-1 overflow-auto p-1.5">
          {results.length === 0 && <div className="p-4 text-sm text-stone-500">Nichts gefunden.</div>}
          {results.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {head && <div className="menu-label pt-2.5">{head}</div>}
                <button
                  data-i={i}
                  id={`palette-${i}`}
                  role="option"
                  aria-selected={i === idx}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${i === idx ? "bg-accent text-white" : "text-stone-700"}`}
                  onMouseMove={() => i !== idx && setIdx(i)}
                  onClick={() => run(c)}
                >
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.kbd && <span className={`text-[11px] ${i === idx ? "text-white/75" : "text-stone-400"}`}>{c.kbd}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-stone-500">
          <span className="flex items-center gap-1"><kbd>↑</kbd><kbd>↓</kbd> auswählen</span>
          <span className="flex items-center gap-1"><kbd>Enter</kbd> ausführen</span>
          <span className="ml-auto">Katalogtreffer: danach in den Plan klicken</span>
        </div>
      </div>
    </div>
  );
}
