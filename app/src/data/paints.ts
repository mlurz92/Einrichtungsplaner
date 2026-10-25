import type { CeilingFinish, FloorFinish, MaterialKey, SkirtingFinish, SurfaceKind } from "../model/types";

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
  boucleMel: "Bouclé meliert",
  melange: "Webstoff meliert",
  chenille: "Chenille",
  microfiber: "Mikrofaser",
  fur: "Kunstfell",
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
  granite: "Naturstein poliert",
  marbleGreen: "Marmor grün",
  marbleNoir: "Keramik Noir Désir",
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
  front: "Fronten",
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
  front: { label: "Fronten", options: [["flat", "glatt"], ["frame", "Rahmen"], ["ribbed", "geriffelt"]] },
  handle: { label: "Griffe", options: [["bar", "Stange"], ["knob", "Knopf"], ["pull", "Griffleiste"], ["edge", "Griffkante"], ["none", "grifflos"]] },
};

// ---------------------------------------------------------------- Ausbau-Vorlagen

/** Bodenbeläge (Produktvorlagen). Bestand WE 13: Eichendielen 1,90 m; HWR/Bad/Dusche Feinsteinzeug 60 × 60 „Iron“. */
export const FLOOR_PRESETS: { id: string; label: string; floor: Omit<FloorFinish, "angle"> }[] = [
  { id: "oak", label: "Eiche natur, Diele 1,90 m (Bestand)", floor: { kind: "planks", color: "#cfae84", plankLength: 1.9, plankWidth: 0.19, productName: "Natureiche-Dielen L 1,90 m (Bestand)" } },
  { id: "oakWhite", label: "Eiche weiß geölt, Landhausdiele", floor: { kind: "planks", color: "#e2d3bb", plankLength: 2.2, plankWidth: 0.22, productName: "Landhausdiele Eiche weiß geölt" } },
  { id: "oakSmoked", label: "Eiche geräuchert, Landhausdiele", floor: { kind: "planks", color: "#7d5d43", plankLength: 2.2, plankWidth: 0.22, productName: "Landhausdiele Räuchereiche" } },
  { id: "walnut", label: "Amerik. Nussbaum, Diele", floor: { kind: "planks", color: "#6f4f37", plankLength: 1.9, plankWidth: 0.16, productName: "Diele Amerikanischer Nussbaum" } },
  { id: "herring", label: "Fischgrät Eiche natur", floor: { kind: "herringbone", color: "#c8a57a", productName: "Fischgrätparkett Eiche natur" } },
  { id: "herringSmoked", label: "Fischgrät Eiche geräuchert", floor: { kind: "herringbone", color: "#80614a", productName: "Fischgrätparkett Räuchereiche" } },
  { id: "chevron", label: "Chevron Eiche hell", floor: { kind: "chevron", color: "#d6bc96", productName: "Chevron-Parkett Eiche hell" } },
  { id: "iron", label: "Feinsteinzeug 60 × 60 Iron (Bestand)", floor: { kind: "tiles", color: "#5e5b57", color2: "#46443f", tileSize: 0.6, productName: "Feinsteinzeug 60 × 60 cm, Farbe Iron (Bestand)" } },
  { id: "concreteTile", label: "Feinsteinzeug 120 × 120 Betonoptik", floor: { kind: "tiles", color: "#a7a39c", color2: "#8f8b84", tileSize: 1.2, productName: "Feinsteinzeug 120 × 120 cm Betonoptik" } },
  { id: "travertine", label: "Travertin 60 × 40 geschliffen", floor: { kind: "stone", color: "#dccbb0", color2: "#c9b89c", tileSize: 0.6, productName: "Travertin geschliffen/gespachtelt" } },
  { id: "marble", label: "Marmor Carrara 60 × 60", floor: { kind: "stone", color: "#ebe8e3", color2: "#d4d0c9", tileSize: 0.6, productName: "Marmor Carrara poliert" } },
  { id: "terrazzo", label: "Terrazzo hell", floor: { kind: "terrazzo", color: "#e3ddd2", color2: "#a59a8c", productName: "Terrazzo (Ortbeton geschliffen)" } },
  { id: "terrazzoGreen", label: "Terrazzo Salbei", floor: { kind: "terrazzo", color: "#cdd3c4", color2: "#6c7a63", productName: "Terrazzo Salbei" } },
  { id: "micro", label: "Mikrozement Greige", floor: { kind: "microcement", color: "#c9c2b6", productName: "Mikrozement fugenlos" } },
  { id: "carpet", label: "Wollteppichboden Sand", floor: { kind: "carpet", color: "#cdbfa8", productName: "Wollteppichboden Velours" } },
];

export const CEILING_KINDS: { kind: CeilingFinish["kind"]; label: string; color?: string }[] = [
  { kind: "paint", label: "Anstrich" },
  { kind: "woodSlats", label: "Holzlamellen (akustisch)", color: "#b88d5f" },
  { kind: "woodPanel", label: "Holzpaneele", color: "#c9a477" },
  { kind: "concrete", label: "Sichtbeton", color: "#a9a6a0" },
];

export const CORNICE_SIZES: [number, string][] = [[0, "kein"], [0.04, "schmal 4 cm"], [0.07, "mittel 7 cm"], [0.11, "Altbau 11 cm"]];

export const SKIRTING_PRESETS: { label: string; skirting: SkirtingFinish }[] = [
  { label: "keine", skirting: { height: 0, color: "wall" } },
  { label: "6 cm wie Wand (Bestand)", skirting: { height: 0.06, color: "wall" } },
  { label: "10 cm weiß", skirting: { height: 0.1, color: "#f4f2ec", material: "lacquer" } },
  { label: "12 cm Altbau weiß", skirting: { height: 0.12, color: "#f4f2ec", material: "lacquer" } },
  { label: "6 cm Eiche", skirting: { height: 0.06, color: "#c9a477", material: "oak" } },
  { label: "4 cm Schattenfuge schwarz", skirting: { height: 0.04, color: "#1d1d1d", material: "blackMetal" } },
];

export const DOOR_COLORS: [string, string][] = [
  ["#f4f3ef", "Weißlack"], ["#e9e4da", "Cremeweiß"], ["#cfc6b8", "Greige"], ["#8c9a85", "Salbei"], ["#2f4a3a", "Tannengrün"],
  ["#3a3b3c", "Anthrazit"], ["#1d1d1d", "Schwarz"], ["#c9a477", "Eiche furniert"], ["#6b4a33", "Nussbaum furniert"],
];
export const FRAME_COLORS: [string, string][] = [["#3b3d40", "Anthrazit (Bestand)"], ["#f2f1ec", "Weiß"], ["#1d1d1d", "Schwarz"], ["#8a7a62", "Bronze"]];

/** Farbstimmungen für „Neue Einrichtung“ und „auf alle Räume“. */
export const WALL_MOODS: { label: string; color: string; ceiling: string; productName: string }[] = [
  { label: "Warmweiß", color: "#f3f0e8", ceiling: "#f7f5f0", productName: "Warmweiß matt" },
  { label: "Kalkweiß", color: "#ece6da", ceiling: "#f4f1ea", productName: "Kalkfarbe Naturweiß" },
  { label: "Greige", color: "#d8cfc2", ceiling: "#f2efe8", productName: "Greige (Schöner Wohnen Kashmir)" },
  { label: "Salbei", color: "#c3cfb5", ceiling: "#f4f3ee", productName: "Salbeigrün (Alpina Essenz der Natur)" },
  { label: "Terrakotta hell", color: "#e2c4ad", ceiling: "#f5efe8", productName: "Terrakotta hell" },
  { label: "Taubenblau", color: "#b9c4cc", ceiling: "#f3f4f4", productName: "Taubenblau (F&B Light Blue)" },
];
