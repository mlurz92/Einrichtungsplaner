// Gemeinsame Bausteine des Design-Systems „Glas“: Segmentschalter, Menüs, Dialoge, Kontextmenü und Tooltips.
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { create } from "zustand";

// ---------------------------------------------------------------- Segmentschalter

export interface SegOption<T extends string> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

/** Segmentschalter mit gleitender Markierung; Pfeiltasten wechseln (Radiogruppe). */
export function Seg<T extends string>({ value, options, onChange, label, className = "" }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLButtonElement>('button[data-on="true"]');
      setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [value, options.length]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const n = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(n.value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('button[data-on="true"]')?.focus());
  };
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={`seg whitespace-nowrap ${className}`} onKeyDown={onKey}>
      {thumb && <span className="seg-thumb" style={{ left: thumb.left, width: thumb.width }} />}
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1} data-on={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Ausklappmenü

const MenuCtx = createContext<{ close: () => void } | null>(null);

/** Schließt das umgebende Menü (z. B. nach einer Auswahl in einem eingebetteten Formular). */
export const useMenuClose = () => useContext(MenuCtx)?.close;

/**
 * Menüleiste wie in Windows-Programmen: Ist ein Menü offen, öffnet das Überfahren eines anderen
 * Menütitels dieses Menü; ← und → wechseln zum Nachbarmenü.
 */
const MenuBarCtx = createContext<{ open: string | null; setOpen: (id: string | null) => void; el: React.RefObject<HTMLDivElement | null> } | null>(null);

export function MenuBar({ children, label, className = "" }: { children: React.ReactNode; label: string; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const el = useRef<HTMLDivElement>(null);
  return (
    <MenuBarCtx.Provider value={{ open, setOpen, el }}>
      <div ref={el} role="menubar" aria-label={label} className={`flex items-center ${className}`}>
        {children}
      </div>
    </MenuBarCtx.Provider>
  );
}

/** Fokus mit Pfeiltasten durch die Einträge eines Menüs bewegen. */
function menuKeys(e: React.KeyboardEvent<HTMLElement>, close: () => void) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]),[role="menuitemcheckbox"]:not([disabled])')];
  const i = items.indexOf(document.activeElement as HTMLElement);
  const go = (n: number) => {
    e.preventDefault();
    items[(n + items.length) % items.length]?.focus();
  };
  if (e.key === "ArrowDown") go(i + 1);
  else if (e.key === "ArrowUp") go(i < 0 ? items.length - 1 : i - 1);
  else if (e.key === "Home") go(0);
  else if (e.key === "End") go(items.length - 1);
  else if (e.key === "Escape" || e.key === "Tab") {
    if (e.key === "Escape") e.preventDefault();
    e.stopPropagation();
    close();
  } else if (e.key.length === 1 && /\S/.test(e.key)) {
    // Tippen springt zum nächsten Eintrag mit diesem Anfangsbuchstaben
    const k = e.key.toLowerCase();
    const order = [...items.slice(i + 1), ...items.slice(0, i + 1)];
    order.find((el) => el.textContent?.trim().toLowerCase().startsWith(k))?.focus();
  }
}

export function Menu({
  label,
  icon,
  title,
  keepOpen,
  align = "left",
  chevron = true,
  className = "btn-ghost",
  children,
}: {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
  keepOpen?: boolean;
  align?: "left" | "right";
  chevron?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const bar = useContext(MenuBarCtx);
  const [ownOpen, setOwnOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = bar ? bar.open === id : ownOpen;
  const barRef = useRef(bar);
  barRef.current = bar;
  const setOpen = useCallback(
    (v: boolean | ((o: boolean) => boolean)) => {
      const b = barRef.current;
      if (!b) return setOwnOpen(v);
      const next = typeof v === "function" ? v(b.open === id) : v;
      if (next) b.setOpen(id);
      else if (b.open === id) b.setOpen(null);
    },
    [id],
  );
  const close = useCallback(() => {
    setOpen(false);
    btn.current?.focus();
  }, [setOpen]);
  /** In der Menüleiste zum Nachbarmenü wechseln. */
  const step = (d: number) => {
    const btns = [...(bar?.el.current?.querySelectorAll<HTMLButtonElement>("[data-menubar-btn]") ?? [])];
    const i = btns.indexOf(btn.current!);
    const n = btns[(i + d + btns.length) % btns.length];
    if (!n || !bar) return;
    bar.setOpen(n.dataset.menuId ?? null);
    n.focus();
  };
  useEffect(() => {
    if (!open) return;
    const f = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", f, true);
    // ersten Eintrag fokussieren, damit die Tastatur sofort wirkt
    requestAnimationFrame(() => pop.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled]), input, select')?.focus({ preventScroll: true }));
    return () => window.removeEventListener("pointerdown", f, true);
  }, [open, setOpen]);
  // Menü schwebt über allem (auch über Fenstern mit abgeschnittenem Inhalt) und bleibt im Fenster
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !btn.current) return setPos(null);
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const w = pop.current?.offsetWidth ?? 224;
      let left = align === "right" ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      setPos({ top: r.bottom + 6, left, maxH: window.innerHeight - r.bottom - 20 });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
    };
  }, [open, align]);
  return (
    <div ref={ref} className="relative">
      <button
        ref={btn}
        className={className}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-open={open}
        data-menubar-btn={bar ? "" : undefined}
        data-menu-id={id}
        role={bar ? "menuitem" : undefined}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={() => {
          if (bar?.open && bar.open !== id) bar.setOpen(id);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          } else if (bar && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
            e.preventDefault();
            const btns = [...(bar.el.current?.querySelectorAll<HTMLButtonElement>("[data-menubar-btn]") ?? [])];
            btns[(btns.indexOf(btn.current!) + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length]?.focus();
          }
        }}
      >
        {icon}
        {label}
        {chevron && <ChevronDown size={13} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />}
      </button>
      {open &&
        createPortal(
        <MenuCtx.Provider value={{ close }}>
          <div
            ref={pop}
            id={id}
            role="menu"
            aria-label={typeof label === "string" ? label : title}
            className={`menu pop-in fixed z-[150] overflow-auto ${align === "right" ? "origin-top-right" : "origin-top-left"}`}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxHeight: pos?.maxH }}
            onKeyDown={(e) => {
              if (bar && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !(e.target instanceof HTMLInputElement)) {
                e.preventDefault();
                return step(e.key === "ArrowRight" ? 1 : -1);
              }
              menuKeys(e, close);
            }}
            onClick={(e) => {
              if (!keepOpen && (e.target as HTMLElement).closest('[role^="menuitem"]')) setOpen(false);
            }}
          >
            {children}
          </div>
        </MenuCtx.Provider>,
          document.body,
        )}
    </div>
  );
}

/** Menüeintrag; mit `checked` als Ein/Aus- bzw. Auswahleintrag (Häkchen statt Symbol). */
export function MenuItem({ onClick, children, kbd, icon, danger, disabled, title, checked }: { onClick: () => void; children: React.ReactNode; kbd?: string; icon?: React.ReactNode; danger?: boolean; disabled?: boolean; title?: string; checked?: boolean }) {
  const check = checked !== undefined;
  return (
    <button role={check ? "menuitemcheckbox" : "menuitem"} aria-checked={check ? checked : undefined} tabIndex={-1} className="menu-item" data-danger={danger} disabled={disabled} title={title} onClick={onClick}>
      {(icon || check) && <span className={`flex w-4 shrink-0 justify-center ${checked ? "text-accent-ink" : "text-stone-500"}`}>{checked ? <Check size={15} strokeWidth={2.4} /> : check ? (icon ?? null) : icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {kbd && <span className="ml-4 shrink-0 text-[11px] text-stone-400">{kbd}</span>}
    </button>
  );
}

export const MenuSep = () => <div role="separator" className="menu-sep" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <div className="menu-label">{children}</div>;

// ---------------------------------------------------------------- Dialog

/**
 * Modaler Glasdialog: Abdunklung mit Unschärfe, Fokus wird im Dialog gehalten,
 * Esc und Klick daneben schließen (sofern `onClose` gesetzt), Fokus kehrt danach zurück.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  width = "max-w-lg",
  z = "z-[100]",
  bare,
  className = "",
  children,
  footer,
}: {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  width?: string;
  z?: string;
  /** Ohne Kopfzeile und Innenabstand (eigener Aufbau). */
  bare?: boolean;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      const el = box.current;
      if (!el || el.contains(document.activeElement)) return;
      (el.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ?? el.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])") ?? el).focus({ preventScroll: true });
    });
    return () => prev?.focus?.({ preventScroll: true });
  }, [open]);
  if (!open) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && onClose) {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      // Fokusfalle
      const f = [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  return createPortal(
    <div className={`scrim fixed inset-0 ${z} grid place-items-center p-6`} onPointerDown={(e) => e.target === e.currentTarget && onClose?.()} onKeyDown={onKey}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1} className={`glass-strong grain pop-in flex max-h-full w-full ${width} flex-col overflow-hidden rounded-2xl outline-none ${className}`}>
        {!bare && (title || onClose) && (
          <div className="flex shrink-0 items-start gap-3 px-5 pt-4 pb-3">
            {icon && <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">{icon}</div>}
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && <div className="mt-0.5 text-[13px] text-stone-500">{subtitle}</div>}
            </div>
            {onClose && (
              <button data-close className="btn-ghost -mr-2 -mt-1 h-8 w-8 p-0" title="Schließen (Esc)" onClick={onClose}>
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className={`min-h-0 flex-1 overflow-auto ${bare ? "" : "px-5 pb-5"}`}>{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-stone-500/5 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Kontextmenü

export type CtxEntry = { label: string; icon?: React.ReactNode; kbd?: string; run: () => void; danger?: boolean; disabled?: boolean } | { sep: true } | { heading: string };

interface CtxState {
  menu: { x: number; y: number; entries: CtxEntry[] } | null;
  open(x: number, y: number, entries: CtxEntry[]): void;
  close(): void;
}

export const useContextMenu = create<CtxState>((set) => ({
  menu: null,
  open: (x, y, entries) => set({ menu: { x, y, entries } }),
  close: () => set({ menu: null }),
}));

export function ContextMenuLayer() {
  const menu = useContextMenu((s) => s.menu);
  const close = useContextMenu((s) => s.close);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null);
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({ x: Math.max(6, Math.min(menu.x, vw - r.width - 6)), y: Math.max(6, menu.y + r.height > vh - 6 ? menu.y - r.height : menu.y) });
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true }));
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const off = (e: Event) => !ref.current?.contains(e.target as Node) && close();
    window.addEventListener("pointerdown", off, true);
    window.addEventListener("wheel", off, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", off, true);
      window.removeEventListener("wheel", off, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [menu, close]);
  if (!menu) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="menu pop-in fixed z-[150] w-64"
      style={{ left: pos?.x ?? menu.x, top: pos?.y ?? menu.y, visibility: pos ? "visible" : "hidden" }}
      onKeyDown={(e) => menuKeys(e, close)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.entries.map((e, i) =>
        "sep" in e ? (
          <MenuSep key={i} />
        ) : "heading" in e ? (
          <MenuLabel key={i}>{e.heading}</MenuLabel>
        ) : (
          <button
            key={i}
            role="menuitem"
            tabIndex={-1}
            className="menu-item"
            data-danger={e.danger}
            disabled={e.disabled}
            onClick={() => {
              close();
              e.run();
            }}
          >
            <span className="flex w-4 shrink-0 justify-center text-stone-500">{e.icon}</span>
            <span className="min-w-0 flex-1 truncate">{e.label}</span>
            {e.kbd && <span className="ml-4 shrink-0 text-[11px] text-stone-400">{e.kbd}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Tooltips

/**
 * Glas-Tooltips für alle Elemente mit `title` oder `data-tip`: Das native `title` wird beim ersten Überfahren
 * nach `data-tip` verschoben (kein doppelter Systemtooltip). Erscheint nach kurzer Verzögerung, bei schnellem
 * Wechsel zwischen Schaltflächen sofort; Tastenkürzel in Klammern werden als Taste dargestellt.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;
    let warmUntil = 0;
    const hide = () => {
      clearTimeout(timer);
      if (current) warmUntil = Date.now() + 400;
      current = null;
      setTip(null);
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const t = e.target as Element | null;
      const el = t?.closest?.("[title], [data-tip]") ?? null;
      if (el === current) return;
      if (!el || el instanceof SVGElement || el.closest("svg title")) return hide();
      const title = el.getAttribute("title");
      if (title !== null) {
        if (title) el.setAttribute("data-tip", title);
        el.removeAttribute("title");
      }
      const text = el.getAttribute("data-tip");
      clearTimeout(timer);
      current = el;
      setTip(null);
      if (!text) return;
      timer = setTimeout(
        () => {
          if (current !== el || !el.isConnected) return;
          setTip({ text, rect: el.getBoundingClientRect() });
        },
        Date.now() < warmUntil ? 40 : 550,
      );
    };
    const out = (e: PointerEvent) => {
      if (!current) return;
      const to = e.relatedTarget as Node | null;
      if (to && current.contains(to)) return;
      hide();
    };
    window.addEventListener("pointerover", over, true);
    window.addEventListener("pointerout", out, true);
    window.addEventListener("pointerdown", hide, true);
    window.addEventListener("keydown", hide, true);
    window.addEventListener("wheel", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointerover", over, true);
      window.removeEventListener("pointerout", out, true);
      window.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("keydown", hide, true);
      window.removeEventListener("wheel", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);
  useLayoutEffect(() => {
    if (!tip || !ref.current) return setPos(null);
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const r = tip.rect;
    const below = r.bottom + h + 10 < window.innerHeight;
    const x = Math.max(6, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 6));
    setPos({ x, y: below ? r.bottom + 7 : r.top - h - 7, below });
  }, [tip]);
  if (!tip) return null;
  const m = /^(.*?)\s*\(([^()]*(?:Strg|Umschalt|Alt|Taste|Entf|Esc|F\d)[^()]*)\)\s*$/.exec(tip.text);
  return createPortal(
    <div ref={ref} role="tooltip" className="tip" style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999 }}>
      {m ? (
        <span className="flex items-center gap-2">
          <span>{m[1]}</span>
          <span className="flex shrink-0 gap-0.5">
            {m[2]
              .replace(/^Taste\s+/, "")
              .split(/\s*\+\s*/)
              .map((k, i) => (
                <kbd key={i}>{k}</kbd>
              ))}
          </span>
        </span>
      ) : (
        tip.text
      )}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Aufklappbarer Abschnitt

export function Section({ title, defaultOpen = true, right, id, children }: { title: React.ReactNode; defaultOpen?: boolean; right?: React.ReactNode; id?: string; children: React.ReactNode }) {
  const key = id ? `we13.sec.${id}` : null;
  const [open, setOpen] = useState(() => {
    if (!key) return defaultOpen;
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultOpen : v === "1";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        if (key) localStorage.setItem(key, o ? "0" : "1");
      } catch {
        /* ignorieren */
      }
      return !o;
    });
  };
  return (
    <section className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-1 pr-3">
        <button className="group flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2.5 text-left" aria-expanded={open} onClick={toggle}>
          <ChevronRight size={13} className={`shrink-0 text-stone-400 transition-transform duration-200 group-hover:text-stone-600 ${open ? "rotate-90" : ""}`} />
          <span className="panel-title truncate">{title}</span>
        </button>
        {right}
      </div>
      {open && <div className="fade-in px-3 pb-3">{children}</div>}
    </section>
  );
}
