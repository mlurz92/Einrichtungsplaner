import type { MaterialKey, SurfaceKind } from "../model/types";

export interface PaintColor {
  brand: string;
  name: string;
  hex: string;
  note?: string;
}

// Farbtöne: Hexwerte sind Bildschirm-Näherungen (Farbfächer/Probeanstrich vor Ort maßgeblich).
export const PAINTS: PaintColor[] = [
  { brand: "Standard", name: "Warmweiß matt (NCS S 0502-Y)", hex: "#f3f0e8" },
  { brand: "Standard", name: "Reinweiß", hex: "#f7f7f5" },
  { brand: "Alpina Feine Farben", name: "No. 36 „Tochter der Antike“", hex: "#f1ece3", note: "Konzept 4" },
  { brand: "Alpina Feine Farben", name: "No. 35 „Wiege des Aromas“", hex: "#cfc6b8", note: "Konzept 3" },
  { brand: "Alpina Feine Farben", name: "No. 38 „Essenz der Natur“", hex: "#c3cfb5", note: "Konzept 1" },
  { brand: "Alpina Feine Farben", name: "No. 5 „Dichter der Erde“", hex: "#75604f", note: "Konzept 2" },
  { brand: "Schöner Wohnen", name: "Designfarbe „Charmantes Petrolblau“", hex: "#1f5a60", note: "Konzept 4" },
  { brand: "KREIDEZEIT", name: "Limewash Sand (Sumpfkalk)", hex: "#e7dccb", note: "Konzept 2" },
  { brand: "Farrow & Ball", name: "Wimborne White No. 239", hex: "#f1ecdd" },
  { brand: "Farrow & Ball", name: "Pointing No. 2003", hex: "#f3efe4" },
  { brand: "Farrow & Ball", name: "School House White No. 291", hex: "#eee8da" },
  { brand: "Farrow & Ball", name: "Slipper Satin No. 2004", hex: "#e8e2d2" },
  { brand: "Farrow & Ball", name: "Shaded White No. 201", hex: "#dedad0" },
  { brand: "Farrow & Ball", name: "Skimming Stone No. 241", hex: "#d8cfc4" },
  { brand: "Farrow & Ball", name: "Dimpse No. 277", hex: "#dad9d2" },
  { brand: "Farrow & Ball", name: "Old White No. 4", hex: "#d9d3c1" },
  { brand: "Farrow & Ball", name: "Cornforth White No. 228", hex: "#cdc9c0" },
  { brand: "Farrow & Ball", name: "Drop Cloth No. 283", hex: "#cfc5b5" },
  { brand: "Farrow & Ball", name: "Elephant's Breath No. 229", hex: "#c2b8ab" },
  { brand: "Farrow & Ball", name: "Jitney No. 293", hex: "#c3b099" },
  { brand: "Farrow & Ball", name: "Purbeck Stone No. 275", hex: "#bdb5a8" },
  { brand: "Farrow & Ball", name: "Charleston Gray No. 243", hex: "#a39c92" },
  { brand: "Farrow & Ball", name: "Mole's Breath No. 276", hex: "#8c8378" },
  { brand: "Farrow & Ball", name: "Setting Plaster No. 231", hex: "#e3c4b1" },
  { brand: "Farrow & Ball", name: "Calamine No. 230", hex: "#e5cfc6" },
  { brand: "Farrow & Ball", name: "Sulking Room Pink No. 295", hex: "#b39190" },
  { brand: "Farrow & Ball", name: "Dead Salmon No. 28", hex: "#b9978a" },
  { brand: "Farrow & Ball", name: "Red Earth No. 64", hex: "#b66a4f" },
  { brand: "Farrow & Ball", name: "Babouche No. 223", hex: "#e6be6a" },
  { brand: "Farrow & Ball", name: "India Yellow No. 66", hex: "#c49b44" },
  { brand: "Farrow & Ball", name: "Mizzle No. 266", hex: "#c1c4b6" },
  { brand: "Farrow & Ball", name: "Pigeon No. 25", hex: "#9da39a" },
  { brand: "Farrow & Ball", name: "Lichen No. 19", hex: "#a1a68d" },
  { brand: "Farrow & Ball", name: "Treron No. 292", hex: "#828269" },
  { brand: "Farrow & Ball", name: "Card Room Green No. 79", hex: "#7e8b79" },
  { brand: "Farrow & Ball", name: "Green Smoke No. 47", hex: "#6d7864" },
  { brand: "Farrow & Ball", name: "Bancha No. 298", hex: "#6e7151" },
  { brand: "Farrow & Ball", name: "Studio Green No. 93", hex: "#2e3b33" },
  { brand: "Farrow & Ball", name: "Inchyra Blue No. 289", hex: "#4c5a5d" },
  { brand: "Farrow & Ball", name: "Stiffkey Blue No. 281", hex: "#3b4a5c" },
  { brand: "Farrow & Ball", name: "Hague Blue No. 30", hex: "#31414e" },
  { brand: "Farrow & Ball", name: "Railings No. 31", hex: "#3b3e41" },
  { brand: "Farrow & Ball", name: "Tanner's Brown No. 255", hex: "#4a3e36" },
  { brand: "Farrow & Ball", name: "Off-Black No. 57", hex: "#353637" },
  { brand: "Little Greene", name: "Slaked Lime 105", hex: "#dcd8c9" },
  { brand: "Little Greene", name: "French Grey 162", hex: "#a9a69a" },
  { brand: "Little Greene", name: "Sage Green 80", hex: "#a8ad94" },
  { brand: "Little Greene", name: "Marine Blue 30", hex: "#2f4553" },
  { brand: "Little Greene", name: "Ochre Brown 290", hex: "#a8814f" },
  { brand: "Caparol Icons", name: "Sandsteingelb (≈)", hex: "#d7c3a1" },
  { brand: "Caparol Icons", name: "Terracotta (≈)", hex: "#b8653f" },
  { brand: "Caparol Icons", name: "Salbei (≈)", hex: "#a7b59e" },
];

export const SURFACE_KINDS: { kind: SurfaceKind; label: string; hint: string }[] = [
  { kind: "paint", label: "Wandfarbe", hint: "Dispersion/Silikat, matt bis seidenmatt" },
  { kind: "limewash", label: "Kalkfarbe (Limewash)", hint: "wolkige, mineralische Optik" },
  { kind: "wallpaper", label: "Tapete", hint: "Streifen, Bögen, Raster, Punkte, Blätter, Leinen" },
  { kind: "lamella", label: "Holzlamellen (Akustik)", hint: "Eiche/Walnuss auf Filz, raumhoch" },
  { kind: "woodPanel", label: "Holzpaneele", hint: "vertikale Profilbretter" },
  { kind: "wainscot", label: "Wandvertäfelung", hint: "Kassetten mit Abschlussleiste" },
  { kind: "tiles", label: "Fliesen", hint: "Großformat, Metro, Mosaik" },
  { kind: "stone", label: "Naturstein (Travertin)", hint: "Platten/Verblender" },
  { kind: "microcement", label: "Mikrozement / Beton", hint: "fugenlos" },
  { kind: "fabric", label: "Textil-/Leinentapete", hint: "Stoffbespannung" },
];

export const WALLPAPER_PATTERNS = [
  { id: "stripes", label: "Blockstreifen" },
  { id: "pinstripe", label: "Nadelstreifen" },
  { id: "arches", label: "Bögen" },
  { id: "grid", label: "Raster" },
  { id: "dots", label: "Punkte" },
  { id: "leaves", label: "Blätter" },
  { id: "linen", label: "Leinenstruktur" },
];

export const TILE_PATTERNS = [
  { id: "large", label: "Großformat 60 × 60" },
  { id: "subway", label: "Metro 15 × 7,5" },
  { id: "small", label: "Mosaik 10 × 10" },
];

export const MATERIAL_LABELS: Record<MaterialKey, string> = {
  fabric: "Webstoff",
  boucle: "Bouclé",
  teddy: "Teddy-Bouclé",
  velvet: "Samt",
  cord: "Cord",
  linen: "Leinen",
  leather: "Leder",
  wool: "Wolle",
  oak: "Eiche",
  oakDark: "Eiche dunkel",
  walnut: "Walnuss",
  burl: "Wurzelholz",
  mango: "Mangoholz",
  ash: "Esche",
  lacquer: "Lack seidenmatt",
  matte: "Matt",
  gloss: "Hochglanz",
  travertine: "Travertin",
  marble: "Marmor",
  marbleGreen: "Marmor grün",
  stone: "Stein/Beton",
  ceramic: "Keramik",
  glass: "Glas",
  ribbedGlass: "Riffelglas",
  opal: "Opalglas",
  mirror: "Spiegel",
  brass: "Messing",
  copper: "Kupfer",
  chrome: "Chrom",
  steel: "Edelstahl gebürstet",
  blackMetal: "Metall schwarz",
  rattan: "Rattan/Geflecht",
  plastic: "Kunststoff",
  paper: "Papier",
  canvas: "Leinwand",
  plant: "Pflanze",
};

export const SLOT_LABELS: Record<string, string> = {
  main: "Hauptmaterial",
  secondary: "Zweitmaterial",
  accent: "Akzent",
  legs: "Gestell/Füße",
  top: "Platte",
  frame: "Rahmen",
  shade: "Schirm/Glas",
  detail: "Details/Griffe",
};

export const PARAM_LABELS: Record<string, { label: string; min?: number; max?: number; step?: number }> = {
  seats: { label: "Sitzplätze", min: 1, max: 6, step: 1 },
  modules: { label: "Module", min: 1, max: 6, step: 1 },
  doors: { label: "Türen", min: 1, max: 12, step: 1 },
  drawers: { label: "Schubladen", min: 0, max: 6, step: 1 },
  rows: { label: "Fachböden", min: 2, max: 10, step: 1 },
  cols: { label: "Spalten", min: 1, max: 6, step: 1 },
  doorsBottom: { label: "Türen unten (Reihen)", min: 0, max: 4, step: 1 },
  shelves: { label: "Böden", min: 1, max: 8, step: 1 },
  open: { label: "Vorhang geöffnet", min: 0, max: 1, step: 0.05 },
  layers: { label: "Vorhanglagen", min: 1, max: 2, step: 1 },
  seatHeight: { label: "Sitzhöhe (m)", min: 0.3, max: 0.8, step: 0.01 },
  legHeight: { label: "Fußhöhe (m)", min: 0, max: 0.4, step: 0.01 },
  armWidth: { label: "Armlehnenbreite (m)", min: 0.05, max: 0.4, step: 0.01 },
  headboard: { label: "Kopfteilhöhe (m)", min: 0.4, max: 1.6, step: 0.01 },
  mattressW: { label: "Liegefläche Breite (m)", min: 0.8, max: 2.0, step: 0.1 },
  mattressL: { label: "Liegefläche Länge (m)", min: 1.9, max: 2.2, step: 0.1 },
  fascia: { label: "Deckenblende (m)", min: 0, max: 0.4, step: 0.01 },
  tallUnits: { label: "Hochschränke (m)", min: 0, max: 2.4, step: 0.1 },
  footD: { label: "Fußdurchmesser (m)", min: 0.3, max: 0.9, step: 0.01 },
  profile: { label: "Profilbreite (m)", min: 0.02, max: 0.12, step: 0.005 },
  doorShare: { label: "Anteil Türen", min: 0, max: 1, step: 0.05 },
  drawerShare: { label: "Anteil Schubladen", min: 0, max: 1, step: 0.05 },
  legH: { label: "Beinhöhe (m)", min: 0, max: 0.2, step: 0.01 },
  heads: { label: "Leuchtköpfe", min: 2, max: 12, step: 1 },
};

/** Schalter-Parameter (Ausführung). */
export const BOOL_PARAM_LABELS: Record<string, string> = {
  backs: "Rückwände",
  plywood: "Multiplex-Kanten sichtbar",
  storage: "Bettkasten",
  duvetSingle: "Einzeldecken",
};

/** Auswahl-Parameter (Ausführung). */
export const CHOICE_PARAMS: Record<string, { label: string; options: [string, string][] }> = {
  pattern: { label: "Muster", options: [["slant", "Slant (versetzt)"], ["grid", "Grid (Raster)"], ["gradient", "Gradient"]] },
  front: { label: "Fronten", options: [["flat", "glatt"], ["ribbed", "geriffelt"]] },
  handle: { label: "Griffe", options: [["bar", "Stange"], ["knob", "Knopf"], ["pull", "Griffleiste"], ["edge", "Griffkante"], ["none", "grifflos"]] },
};
