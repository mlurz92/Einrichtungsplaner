import { useMemo, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Compass, Eye, Images, Pause, Play, Plus, SlidersHorizontal, X } from "lucide-react";
import { useEditor } from "../store/project";
import { apartment } from "../data";
import type { ProjectSettings, SavedView3D } from "../model/types";
import { DEFAULT_SITE, fmtClock, parseDate, sunPosition, sunTimes } from "../three/solar";
import { fovToMm, gotoView, mmToFov, paneFov, setPaneFov, useView3D } from "../three/viewStore";
import { useLayout } from "./layout";
import { createContext, useContext } from "react";
import { roomView } from "../three/views";
import { dataUrlToBytes, isTauri, pickFolder, saveBinary, writeBinaryTo } from "../platform";
import roomShots from "../data/roomShots.json";

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

type SectionId = "sun" | "lamp" | "camera" | "shots" | "photo";

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

/** 3D-Fenster, zu dem die Ansichtsleiste gehört. */
const PanelPane = createContext(1);

/** Ansichtsleiste eines 3D-Fensters; ein- und ausblenden über die Kopfzeile des Fensters. */
export function View3DPanel({ pane }: { pane: number }) {
  return (
    <PanelPane.Provider value={pane}>
    <div className="view3d-panel absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-60 flex-col overflow-hidden rounded-lg border border-stone-200 bg-card/92 text-xs text-stone-700 shadow-lg backdrop-blur @max-[380px]:hidden">
      <div className="flex items-center gap-1.5 border-b border-stone-100 px-3 py-1.5">
        <SlidersHorizontal size={13} className="text-stone-500" />
        <span className="font-semibold">Ansicht</span>
        <button className="btn-ghost ml-auto px-1 py-0.5" onClick={() => useLayout.getState().setPane(pane, { panel: false })} title="Ansichtsleiste ausblenden (wieder einblenden über die Kopfzeile des Fensters)">
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto">
        <SunSection />
        <LampSection />
        <CameraSection />
        <ShotsSection />
        <PhotoSection />
      </div>
    </div>
    </PanelPane.Provider>
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
        <input type="checkbox" className="" checked={v.realDaylight} onChange={(e) => v.set("realDaylight", e.target.checked)} />
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
  const lampsDay = useView3D((s) => s.lampsDay);
  const k = useEditor((s) => s.project.settings.lampKelvin ?? 2900);
  const opts: [number, string][] = [
    [2700, "2700 K"],
    [2900, "2900 K"],
    [3500, "3500 K"],
    [4000, "4000 K"],
  ];
  return (
    <Section id="lamp" title="Kunstlicht" hint={night ? `Abend · ${k} K` : lampsDay ? `Tag · ${k} K` : "aus"}>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" className="" checked={night} onChange={(e) => useEditor.getState().set("night", e.target.checked)} />
        Abendlicht (dunkel, Leuchten an)
      </label>
      <label className={`mt-1 flex items-center gap-1.5 ${night ? "opacity-40" : ""}`}>
        <input type="checkbox" className="" disabled={night} checked={lampsDay || night} onChange={(e) => useView3D.getState().set("lampsDay", e.target.checked)} />
        Leuchten auch bei Tageslicht
      </label>
      {(night || lampsDay) && (
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
  const pane = useContext(PanelPane);
  const camera3d = useLayout((s) => s.panes[pane].camera);
  const views = useEditor((s) => s.project.settings.views3d) ?? NO_VIEWS;
  const v = useView3D();
  const walk = camera3d === "walk";
  const fov = paneFov(v.fov, pane, walk);
  const toOrbit = () => camera3d === "top" && useLayout.getState().setPane(pane, { camera: "orbit" });
  const goRoom = (id: string) => {
    const rv = roomView(id, useEditor.getState().project.items, v.eyeHeight);
    if (!rv) return;
    toOrbit();
    // Kleine Räume brauchen mehr Weitwinkel (≈ 18 mm statt 22 mm)
    const area = apartment.rooms.find((r) => r.id === id)?.area ?? 20;
    gotoView(pane, { ...rv, fov: walk ? undefined : Math.max(paneFov(v.fov, pane, false), area < 16 ? 67 : 57) });
  };
  const saveView = () => {
    const cur = v.apis[pane]?.getView();
    if (!cur) return;
    const n = views.length + 1;
    const view: SavedView3D = { id: Math.random().toString(36).slice(2, 9), name: `Ansicht ${n}`, pos: cur.pos, target: cur.target, fov: cur.fov };
    patch({ views3d: [...views, view] }, true);
  };
  const goView = (sv: SavedView3D) => {
    toOrbit();
    gotoView(pane, { pos: sv.pos, target: sv.target, fov: sv.fov });
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
          onChange={(e) => setPaneFov(pane, walk, mmToFov(Number(e.target.value)))}
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
              className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 outline-none hover:bg-stone-100 focus:bg-card focus:ring-1 focus:ring-accent/30"
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

export type RoomShot = { id: string; room: string; name: string; pos: [number, number, number]; target: [number, number, number]; fov: number };
export const ROOM_SHOTS = roomShots as unknown as RoomShot[];

/** Kamera zur Fotoansicht schwenken (Kamerafahrt der Orbit-Kamera). */
export function flyToShot(s: RoomShot, pane: number) {
  if (useLayout.getState().panes[pane].camera !== "orbit") useLayout.getState().setPane(pane, { camera: "orbit" });
  gotoView(pane, { pos: s.pos, target: s.target, fov: s.fov });
}

/** Warten, bis die Kamerafahrt angekommen ist (höchstens 4 s). */
async function settle(s: RoomShot, pane: number) {
  const t0 = performance.now();
  while (performance.now() - t0 < 4000) {
    await new Promise((r) => setTimeout(r, 120));
    const cur = useView3D.getState().apis[pane]?.getView();
    if (cur && Math.hypot(cur.pos[0] - s.pos[0], cur.pos[1] - s.pos[1], cur.pos[2] - s.pos[2]) < 0.01 && Math.abs(cur.fov - s.fov) < 0.2) break;
  }
  // Umgebungslicht und Schatten an die neue Ansicht anpassen lassen
  await new Promise((r) => setTimeout(r, 600));
}

const fileBase = () => useEditor.getState().project.name.replace(/[^\wäöüÄÖÜß ·-]+/g, "").replace(/\s*·\s*/g, " - ").trim() || "WE13";
const shotFile = (s: RoomShot) => `${fileBase()} - ${s.name.replace(/\s*·\s*/g, " - ").replace(/[\\/:*?"<>|]+/g, "-")}.png`;

/** Fotoansichten je Raum: anschwenken, einzeln oder alle als Full-HD-Bild speichern. */
function ShotsSection() {
  const pane = useContext(PanelPane);
  const api = useView3D((s) => s.apis[pane]);
  const [busy, setBusy] = useState<string | null>(null);
  const shoot = async (s: RoomShot) => {
    if (!api || busy) return;
    setBusy(s.id);
    try {
      flyToShot(s, pane);
      await settle(s, pane);
      const url = await api.capture(1920);
      if (!url) return useEditor.getState().showToast("Foto konnte nicht erstellt werden");
      const path = await saveBinary(dataUrlToBytes(url), shotFile(s), [{ name: "PNG", extensions: ["png"] }]);
      if (path) useEditor.getState().showToast(`Foto gespeichert: ${path.split(/[\\/]/).pop()}`);
    } finally {
      setBusy(null);
    }
  };
  const shootAll = async () => {
    if (!api || busy) return;
    const folder = await pickFolder("Ordner für die Raumfotos wählen");
    if (folder === null && isTauri) return;
    setBusy("all");
    let n = 0;
    try {
      for (const s of ROOM_SHOTS) {
        setBusy(`all:${s.id}`);
        flyToShot(s, pane);
        await settle(s, pane);
        const url = await api.capture(1920);
        if (!url) continue;
        await writeBinaryTo(folder, shotFile(s), dataUrlToBytes(url));
        n++;
      }
      useEditor.getState().showToast(`${n} Raumfotos gespeichert${folder ? ` in ${folder.split(/[\\/]/).pop()}` : ""}`);
    } catch (e) {
      useEditor.getState().showToast(`Raumfotos: ${e instanceof Error ? e.message : String(e)}`, { kind: "error" });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Section id="shots" title="Raumfotos" hint={`${ROOM_SHOTS.length} Ansichten`}>
      <div className="mb-1 text-stone-500">Ausgesuchte Blickwinkel je Raum: anklicken zum Hinschwenken, Kamera-Symbol speichert das Bild (Full HD).</div>
      <div className="space-y-0.5">
        {ROOM_SHOTS.map((s) => (
          <div key={s.id} className="flex items-center gap-1">
            <button className="btn-ghost min-w-0 flex-1 justify-start! truncate px-1 py-0.5 text-left" disabled={!!busy} onClick={() => flyToShot(s, pane)} title={`${s.name} anschwenken`}>
              <Eye size={13} className="shrink-0" />
              <span className={`truncate ${busy === `all:${s.id}` ? "font-semibold" : ""}`}>{s.name}</span>
            </button>
            <button className="btn-ghost px-1 py-0.5" disabled={!!busy} onClick={() => shoot(s)} title="Anschwenken und als PNG speichern">
              <Camera size={13} />
            </button>
          </div>
        ))}
      </div>
      <button className="btn mt-1.5 w-full px-1.5 py-1 text-xs" disabled={!!busy} onClick={shootAll} title="Alle Raumansichten nacheinander anschwenken und als PNG in einen Ordner speichern">
        <Images size={13} /> {busy?.startsWith("all") ? "Fotos werden erstellt …" : "Alle Raumfotos speichern"}
      </button>
    </Section>
  );
}

function PhotoSection() {
  const pane = useContext(PanelPane);
  const api = useView3D((s) => s.apis[pane]);
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
