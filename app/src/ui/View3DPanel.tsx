import { useMemo, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Compass, Eye, Pause, Play, Plus, SlidersHorizontal, X } from "lucide-react";
import { useEditor } from "../store/project";
import { apartment } from "../data";
import type { ProjectSettings, SavedView3D } from "../model/types";
import { DEFAULT_SITE, fmtClock, parseDate, sunPosition, sunTimes } from "../three/solar";
import { fovToMm, mmToFov, useView3D } from "../three/viewStore";
import { roomView } from "../three/views";
import { dataUrlToBytes, saveBinary } from "../platform";

// Ansichtsleiste der 3D-Ansicht: Sonnenstudie, Abendlicht, Kamera, gespeicherte Ansichten, Foto.

const CITIES: [string, number, number][] = [
  ["Mitte Deutschland", DEFAULT_SITE.latitude, DEFAULT_SITE.longitude],
  ["Berlin", 52.52, 13.41],
  ["Dresden", 51.05, 13.74],
  ["Düsseldorf", 51.23, 6.78],
  ["Frankfurt am Main", 50.11, 8.68],
  ["Hamburg", 53.55, 9.99],
  ["Hannover", 52.37, 9.73],
  ["Köln", 50.94, 6.96],
  ["Leipzig", 51.34, 12.37],
  ["München", 48.14, 11.58],
  ["Nürnberg", 49.45, 11.08],
  ["Stuttgart", 48.78, 9.18],
];

const NO_VIEWS: SavedView3D[] = [];
const DIRS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
const dirName = (az: number) => DIRS[Math.round(az / 45) % 8];

/** Einstellungen ohne Undo-Schritt ändern (Schieberegler), sonst mit. */
function patch(p: Partial<ProjectSettings>, commit = false) {
  if (commit) return useEditor.getState().setSettings(p);
  useEditor.setState((s) => ({ project: { ...s.project, settings: { ...s.project.settings, ...p } }, dirty: true }));
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type SectionId = "sun" | "lamp" | "camera" | "photo";

/** Aufklappbarer Abschnitt; es ist immer nur einer offen, damit die Leiste die Ansicht nicht verdeckt. */
function Section({ id, title, hint, children }: { id: SectionId; title: string; hint?: string; children: React.ReactNode }) {
  const open = useView3D((s) => s.panelSection) === id;
  return (
    <div className="border-t border-stone-100 first:border-t-0">
      <button className="flex w-full items-center gap-1 px-3 py-1.5 text-left hover:bg-stone-50" onClick={() => useView3D.getState().set("panelSection", open ? null : id)}>
        <span className="panel-title">{title}</span>
        {!open && hint && <span className="ml-auto truncate pl-2 text-[11px] text-stone-500">{hint}</span>}
        {open ? <ChevronUp size={12} className="ml-auto text-stone-400" /> : <ChevronDown size={12} className={`${hint ? "ml-1" : "ml-auto"} shrink-0 text-stone-400`} />}
      </button>
      {open && <div className="px-3 pb-2.5">{children}</div>}
    </div>
  );
}

export function View3DPanel() {
  const open = useView3D((s) => s.panelOpen);
  const setV = useView3D((s) => s.set);
  if (!open)
    return (
      <button className="btn absolute right-3 top-3 z-10 bg-white/90 text-xs backdrop-blur" onClick={() => setV("panelOpen", true)} title="Ansichtsleiste: Sonne, Kamera, Foto">
        <SlidersHorizontal size={14} /> Ansicht
      </button>
    );
  return (
    <div className="absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-60 flex-col overflow-hidden rounded-lg border border-stone-200 bg-white/92 text-xs text-stone-700 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1.5 border-b border-stone-100 px-3 py-1.5">
        <SlidersHorizontal size={13} className="text-stone-500" />
        <span className="font-semibold">Ansicht</span>
        <button className="btn-ghost ml-auto px-1 py-0.5" onClick={() => setV("panelOpen", false)} title="Leiste einklappen">
          <ChevronUp size={14} />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto">
        <SunSection />
        <LampSection />
        <CameraSection />
        <PhotoSection />
      </div>
    </div>
  );
}

function SunSection() {
  const s = useEditor((st) => st.project.settings);
  const night = useEditor((st) => st.night);
  const v = useView3D();
  const [more, setMore] = useState(false);
  const site = { latitude: s.latitude ?? DEFAULT_SITE.latitude, longitude: s.longitude ?? DEFAULT_SITE.longitude };
  const [y, m, d] = parseDate(s.sunDate);
  const date = isoDate(y, m, d);
  const time = v.animTime ?? s.timeOfDay ?? 15;
  const pos = sunPosition(date, time, site);
  const times = useMemo(() => sunTimes(date, site), [date, site.latitude, site.longitude]); // eslint-disable-line react-hooks/exhaustive-deps
  const north = s.northDeg ?? 0;
  const city = CITIES.find((c) => Math.abs(c[1] - site.latitude) < 0.01 && Math.abs(c[2] - site.longitude) < 0.01)?.[0] ?? "";
  const togglePlay = () => {
    if (v.sunPlaying) {
      // Angehaltene Uhrzeit übernehmen
      if (v.animTime != null) patch({ timeOfDay: Math.round(v.animTime * 4) / 4 });
      v.set("animTime", null);
      v.set("sunPlaying", false);
    } else {
      if (night) useEditor.getState().set("night", false);
      v.set("sunPlaying", true);
    }
  };
  const quick: [string, string][] = [
    ["Frühling", isoDate(y, 2, 21)],
    ["Sommer", isoDate(y, 5, 21)],
    ["Herbst", isoDate(y, 8, 23)],
    ["Winter", isoDate(y, 11, 21)],
  ];
  return (
    <Section id="sun" title="Sonne" hint={`${date.split("-").reverse().join(".")} · ${fmtClock(time)} Uhr`}>
      <div className="flex items-center gap-1.5">
        <input type="date" className="field w-auto flex-1 py-0.5 text-xs" value={date} onChange={(e) => e.target.value && patch({ sunDate: e.target.value })} title="Datum für den Sonnenstand" />
        <button className="btn px-2 py-1 text-xs" onClick={togglePlay} title={v.sunPlaying ? "Tagesverlauf anhalten" : "Tagesverlauf abspielen (Sonnenaufgang bis -untergang)"}>
          {v.sunPlaying ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {quick.map(([label, iso]) => (
          <button key={label} className="chip" data-on={date === iso} onClick={() => patch({ sunDate: iso })} title={`${label}: ${iso.split("-").reverse().join(".")}`}>
            {label}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={4}
        max={22}
        step={0.25}
        value={time}
        onChange={(e) => {
          if (v.sunPlaying) v.set("sunPlaying", false);
          v.set("animTime", null);
          patch({ timeOfDay: Number(e.target.value) });
          if (night) useEditor.getState().set("night", false);
        }}
        className="mt-1.5 w-full accent-amber-600"
        title="Uhrzeit (Ortszeit)"
      />
      <div className="flex justify-between tabular-nums text-stone-500">
        <span className="font-semibold text-stone-800">{fmtClock(time)} Uhr</span>
        <span>{pos.elevation > -0.8 ? `Sonne ${dirName(pos.azimuth)}, ${Math.round(pos.elevation)}° hoch` : "Sonne unter dem Horizont"}</span>
      </div>
      {times && (
        <div className="text-stone-500">
          Aufgang {fmtClock(times.rise)} · Untergang {fmtClock(times.set)}
        </div>
      )}
      <label className="mt-1.5 flex items-center gap-1.5" title="Decke und Wände werfen immer Schatten, auch wenn sie ausgeblendet sind. Aus: Studiolicht von oben.">
        <input type="checkbox" className="accent-emerald-800" checked={v.realDaylight} onChange={(e) => v.set("realDaylight", e.target.checked)} />
        Sonne nur durch Fenster (realistisch)
      </label>
      <button className="mt-1 flex items-center gap-1 text-stone-500 hover:text-stone-800" onClick={() => setMore(!more)}>
        <Compass size={12} /> Ausrichtung & Standort {more ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {more && (
        <div className="mt-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <NorthRose deg={north} />
            <div className="flex-1">
              <input type="range" min={0} max={359} step={1} value={north} onChange={(e) => patch({ northDeg: Number(e.target.value) })} className="w-full accent-stone-700" title="Lage von Norden im Grundriss" />
              <div className="text-stone-500">
                Norden {north}° {north === 0 ? "(Plan oben)" : "im Uhrzeigersinn"}
              </div>
            </div>
          </div>
          <select
            className="field py-0.5 text-xs"
            value={city}
            onChange={(e) => {
              const c = CITIES.find((x) => x[0] === e.target.value);
              if (c) patch({ latitude: c[1], longitude: c[2] }, true);
            }}
            title="Standort für den Sonnenstand"
          >
            {!city && <option value="">eigener Standort</option>}
            {CITIES.map((c) => (
              <option key={c[0]}>{c[0]}</option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <label className="flex flex-1 items-center gap-1">
              Breite
              <input type="number" step={0.01} className="field py-0.5 text-xs" value={site.latitude} onChange={(e) => patch({ latitude: Number(e.target.value) || 0 })} />
            </label>
            <label className="flex flex-1 items-center gap-1">
              Länge
              <input type="number" step={0.01} className="field py-0.5 text-xs" value={site.longitude} onChange={(e) => patch({ longitude: Number(e.target.value) || 0 })} />
            </label>
          </div>
        </div>
      )}
    </Section>
  );
}

function NorthRose({ deg }: { deg: number }) {
  return (
    <svg width="30" height="30" viewBox="-15 -15 30 30" className="shrink-0">
      <circle r="13.5" fill="#fff" stroke="#d6d3d1" />
      <g transform={`rotate(${deg})`}>
        <path d="M0 -11 L3.5 1 L0 -1.5 L-3.5 1 Z" fill="#b91c1c" />
        <path d="M0 11 L3.5 -1 L0 1.5 L-3.5 -1 Z" fill="#a8a29e" />
      </g>
    </svg>
  );
}

function LampSection() {
  const night = useEditor((s) => s.night);
  const k = useEditor((s) => s.project.settings.lampKelvin ?? 2900);
  const opts: [number, string][] = [
    [2700, "2700 K"],
    [2900, "2900 K"],
    [3500, "3500 K"],
    [4000, "4000 K"],
  ];
  return (
    <Section id="lamp" title="Abendlicht" hint={night ? `an · ${k} K` : "aus"}>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" className="accent-emerald-800" checked={night} onChange={(e) => useEditor.getState().set("night", e.target.checked)} />
        Leuchten an (Abendstimmung)
      </label>
      {night && (
        <div className="mt-1.5">
          <div className="mb-1 text-stone-500">Lichtfarbe: warmweiß bis neutralweiß</div>
          <div className="flex flex-wrap gap-1">
            {opts.map(([v, l]) => (
              <button key={v} className="chip" data-on={k === v} onClick={() => patch({ lampKelvin: v }, true)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function CameraSection() {
  const camera3d = useEditor((s) => s.camera3d);
  const views = useEditor((s) => s.project.settings.views3d) ?? NO_VIEWS;
  const v = useView3D();
  const walk = camera3d === "walk";
  const fov = walk ? v.fovWalk : v.fovOrbit;
  const goRoom = (id: string) => {
    const rv = roomView(id, useEditor.getState().project.items, v.eyeHeight);
    if (!rv) return;
    if (camera3d === "top") useEditor.getState().set("camera3d", "orbit");
    // Kleine Räume brauchen mehr Weitwinkel (≈ 18 mm statt 22 mm)
    const area = apartment.rooms.find((r) => r.id === id)?.area ?? 20;
    v.set("goto", { ...rv, fov: walk ? undefined : Math.max(v.fovOrbit, area < 16 ? 67 : 57), t: performance.now() });
  };
  const saveView = () => {
    const cur = v.api?.getView();
    if (!cur) return;
    const n = views.length + 1;
    const view: SavedView3D = { id: Math.random().toString(36).slice(2, 9), name: `Ansicht ${n}`, pos: cur.pos, target: cur.target, fov: cur.fov };
    patch({ views3d: [...views, view] }, true);
  };
  const goView = (sv: SavedView3D) => {
    if (camera3d === "top") useEditor.getState().set("camera3d", "orbit");
    v.set("goto", { pos: sv.pos, target: sv.target, fov: sv.fov, t: performance.now() });
  };
  return (
    <Section id="camera" title="Kamera & Ansichten" hint={views.length ? `${views.length} gespeichert` : undefined}>
      <div className="mb-1 text-stone-500">Raumansicht auf Augenhöhe</div>
      <div className="flex flex-wrap gap-1">
        {apartment.rooms.map((r) => (
          <button key={r.id} className="chip" onClick={() => goRoom(r.id)} title={`${r.name}: Blick über die Raumdiagonale`}>
            {r.name.split(" / ")[0]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="w-16 shrink-0">Brennweite</span>
        <input
          type="range"
          min={14}
          max={50}
          step={1}
          value={Math.round(fovToMm(fov))}
          onChange={(e) => v.set(walk ? "fovWalk" : "fovOrbit", mmToFov(Number(e.target.value)))}
          className="flex-1 accent-stone-700"
          title="Kleinbild-Brennweite: klein = Weitwinkel"
        />
        <span className="w-12 shrink-0 text-right tabular-nums">{Math.round(fovToMm(fov))} mm</span>
      </div>
      {walk && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-16 shrink-0">Augenhöhe</span>
          <div className="seg">
            <button data-on={v.eyeHeight > 1.4} onClick={() => v.set("eyeHeight", 1.62)}>
              Stehen
            </button>
            <button data-on={v.eyeHeight <= 1.4} onClick={() => v.set("eyeHeight", 1.15)}>
              Sitzen
            </button>
          </div>
        </div>
      )}
      <div className="mb-1 mt-2 flex items-center text-stone-500">
        Gespeicherte Ansichten
        <button className="btn-ghost ml-auto px-1 py-0.5 text-xs" onClick={saveView} title="Aktuelle Kameraposition speichern (wird mit dem Projekt gesichert)">
          <Plus size={13} /> speichern
        </button>
      </div>
      {views.length === 0 && <div className="text-stone-400">Noch keine. Kamera einrichten und „speichern“ drücken.</div>}
      <div className="space-y-0.5">
        {views.map((sv) => (
          <div key={sv.id} className="group flex items-center gap-1">
            <button className="btn-ghost px-1 py-0.5" onClick={() => goView(sv)} title="Ansicht anspringen">
              <Eye size={13} />
            </button>
            <input
              className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 outline-none hover:bg-stone-100 focus:bg-white focus:ring-1 focus:ring-emerald-700/30"
              value={sv.name}
              onChange={(e) => patch({ views3d: views.map((x) => (x.id === sv.id ? { ...x, name: e.target.value } : x)) })}
            />
            <button className="btn-ghost px-1 py-0.5 opacity-0 group-hover:opacity-100" onClick={() => patch({ views3d: views.filter((x) => x.id !== sv.id) }, true)} title="Ansicht löschen">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PhotoSection() {
  const api = useView3D((s) => s.api);
  const [busy, setBusy] = useState(false);
  const shoot = async (width: number) => {
    if (!api || busy) return;
    setBusy(true);
    try {
      const url = await api.capture(width);
      if (!url) return useEditor.getState().showToast("Foto konnte nicht erstellt werden");
      const name = `${useEditor.getState().project.name.replace(/[^\wäöüÄÖÜß -]+/g, "").trim() || "WE13"}_${width}px.png`;
      const path = await saveBinary(dataUrlToBytes(url), name, [{ name: "PNG", extensions: ["png"] }]);
      if (path) useEditor.getState().showToast(`Foto gespeichert: ${path.split(/[\\/]/).pop()}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section id="photo" title="Foto" hint="Full HD · 4K">
      <div className="flex gap-1">
        <button className="btn flex-1 px-1.5 py-1 text-xs" disabled={busy} onClick={() => shoot(1920)} title="PNG mit 1920 Pixel Breite, ohne Auswahlrahmen">
          <Camera size={13} /> Full HD
        </button>
        <button className="btn flex-1 px-1.5 py-1 text-xs" disabled={busy} onClick={() => shoot(3840)} title="PNG mit 3840 Pixel Breite, ohne Auswahlrahmen">
          <Camera size={13} /> 4K
        </button>
      </div>
    </Section>
  );
}
