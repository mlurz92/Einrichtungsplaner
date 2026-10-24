// Domänenmodell des Einrichtungsplaners.
// Koordinaten: Meter, Planachsen x → rechts (Ost), y → unten (Süd). 3D: X = x, Z = y, Y = Höhe.
// Rotation: Grad, im Plan im Uhrzeigersinn (y nach unten). Lokale Möbelachsen: Breite entlang x,
// Tiefe entlang y, Vorderseite zeigt bei rot = 0 nach +y (Süden).

export type Vec2 = [number, number];

export type Vendor =
  | "Westwing"
  | "IKEA"
  | "JYSK"
  | "Designhandel"
  | "Tylko"
  | "OBI"
  | "Samsung"
  | "lampe.de"
  | "Fachhandel"
  | "Bestand";

export type Category =
  | "sofa"
  | "armchair"
  | "chair"
  | "stool"
  | "bench"
  | "pouf"
  | "coffeeTable"
  | "sideTable"
  | "diningTable"
  | "desk"
  | "console"
  | "sideboard"
  | "lowboard"
  | "cabinet"
  | "shelf"
  | "wardrobe"
  | "dresser"
  | "bed"
  | "nightstand"
  | "officeChair"
  | "floorLamp"
  | "tableLamp"
  | "pendant"
  | "ceilingLamp"
  | "wallLamp"
  | "rug"
  | "curtain"
  | "art"
  | "mirror"
  | "plant"
  | "decor"
  | "textile"
  | "wallPanel"
  | "molding"
  | "outdoor"
  | "kitchen"
  | "bath"
  | "appliance"
  | "media";

export type Mount = "floor" | "wall" | "ceiling" | "surface";

/** Benannte Materialvorlagen (prozedural/PBR, siehe three/materials.ts). */
export type MaterialKey =
  | "fabric"
  | "melange"
  | "chenille"
  | "boucleMel"
  | "fur"
  | "boucle"
  | "teddy"
  | "velvet"
  | "cord"
  | "linen"
  | "leather"
  | "wool"
  | "oak"
  | "oakDark"
  | "walnut"
  | "burl"
  | "mango"
  | "ash"
  | "lacquer"
  | "matte"
  | "gloss"
  | "travertine"
  | "marble"
  | "marbleGreen"
  | "stone"
  | "ceramic"
  | "glass"
  | "ribbedGlass"
  | "opal"
  | "mirror"
  | "brass"
  | "copper"
  | "chrome"
  | "steel"
  | "blackMetal"
  | "rattan"
  | "plastic"
  | "paper"
  | "canvas"
  | "plant";

/** Farb-/Materialslots, die ein Archetyp verwendet. */
export type Slot = "main" | "secondary" | "accent" | "legs" | "top" | "frame" | "shade" | "detail";

export interface SlotStyle {
  color: string;
  material: MaterialKey;
}

export type Archetype =
  | "sofa"
  | "sofaModular"
  | "sofaRound"
  | "sofaCorner"
  | "sofaBed"
  | "armchairLounge"
  | "armchairRound"
  | "armchairWing"
  | "armchairShell"
  | "diningArmchair"
  | "diningChair"
  | "cantilever"
  | "barStool"
  | "pouf"
  | "bench"
  | "tableRect"
  | "tableRound"
  | "tableOval"
  | "tablePedestal"
  | "coffeeDuo"
  | "coffeeBlock"
  | "coffeeRound"
  | "sideRound"
  | "sideContainer"
  | "desk"
  | "deskStanding"
  | "console"
  | "sideboard"
  | "lowboard"
  | "vitrine"
  | "shelfOpen"
  | "bookcase"
  | "wardrobe"
  | "dresser"
  | "nightstand"
  | "bed"
  | "bedWood"
  | "officeChair"
  | "lampFloorGlobe"
  | "lampFloorShade"
  | "lampFloorArc"
  | "lampFloorTripod"
  | "lampTableMushroom"
  | "lampTableGlobe"
  | "lampTableShade"
  | "lampTableLayered"
  | "pendantGlobe"
  | "pendantDome"
  | "pendantCluster"
  | "pendantMirrorBall"
  | "ceilingDome"
  | "ceilingDisc"
  | "wallGlobe"
  | "wallSconce"
  | "rugRect"
  | "rugRound"
  | "rugOrganic"
  | "curtain"
  | "art"
  | "artPair"
  | "mirrorRound"
  | "mirrorArch"
  | "mirrorRect"
  | "plantTree"
  | "plantBush"
  | "plantPot"
  | "vase"
  | "books"
  | "tray"
  | "bowl"
  | "candles"
  | "cushion"
  | "throw"
  | "tv"
  | "tvFrame"
  | "tylkoStorage"
  | "pendantLinear"
  | "lampTask"
  | "lamella"
  | "molding"
  | "panelWall"
  | "outdoorTable"
  | "outdoorChair"
  | "outdoorSofa"
  | "kitchenRun"
  | "bathtub"
  | "toilet"
  | "washbasin"
  | "shower"
  | "washer"
  | "box"
  | "glb";

export interface CatalogVariant {
  name: string;
  slots: Partial<Record<Slot, SlotStyle>>;
  price?: number;
  url?: string;
  image?: string;
  /** Wert je Ausführungsachse (Reihenfolge wie CatalogItem.axes). */
  opts?: string[];
  /** Original-Stoffmuster des Herstellers (Bild-URL). */
  swatch?: string;
  /** Laut Shop derzeit ausverkauft. */
  soldOut?: boolean;
  /** Ausführungsabhängige Parameter (z. B. Frontstil). */
  params?: Record<string, number | string | boolean>;
}

/** Ausführungsachse des Herstellers, z. B. „Bezug“ oder „Farbe Gestell“. */
export interface CatalogAxis {
  name: string;
  values: string[];
}

export interface CatalogItem {
  id: string;
  vendor: Vendor;
  brand?: string;
  name: string;
  series?: string;
  category: Category;
  /** Außenmaße in Zentimetern (B × T × H bzw. Ø). */
  w: number;
  d: number;
  h: number;
  price: number;
  url?: string;
  image?: string;
  archetype: Archetype;
  params?: Record<string, number | string | boolean>;
  mount: Mount;
  /** Montagehöhe Unterkante (m) für Wand-/Aufsatzobjekte. */
  elev?: number;
  variants: CatalogVariant[];
  /** Kombinierbare Ausführungsachsen (nur wenn der Hersteller mehrere Wahlmöglichkeiten trennt). */
  axes?: CatalogAxis[];
  tags?: string[];
  premium?: boolean;
  /** Konzepte, in denen das Produkt verwendet wird. */
  concepts?: number[];
  delivery?: string;
  description?: string;
  /** Konfigurierbare Maße (z. B. PAX, Tylko, Teppiche, Lamellen). */
  resizable?: boolean;
  /** Glb-Datei (CC0) für Pflanzen/Deko. */
  model?: string;
}

export interface PlacedItem {
  id: string;
  catalogId: string;
  /** Positionsnummer aus dem Möblierungskonzept (z. B. "W1"). */
  pos?: string;
  label?: string;
  x: number;
  y: number;
  rot: number;
  /** Unterkante über Fertigfußboden in m. */
  elev: number;
  /** Maße in m (überschreiben Katalogwerte). */
  w: number;
  d: number;
  h: number;
  variant?: string;
  slots: Partial<Record<Slot, SlotStyle>>;
  params?: Record<string, number | string | boolean>;
  mount: Mount;
  room?: string;
  locked?: boolean;
  hidden?: boolean;
  note?: string;
  /** Preis je Stück (überschreibt Katalog). */
  price?: number;
  /** Fenster-ID für Vorhänge. */
  opening?: string;
  /** Kennzeichnet Bestand (nicht im Budget). */
  existing?: boolean;
  /** Stückliste (Kaufpositionen), aus denen das Objekt besteht – z. B. PAX-Korpus + Türen + Einsätze. */
  parts?: ItemPart[];
  /** Kaufstatus (fehlt = geplant). */
  status?: PurchaseStatus;
}

export type PurchaseStatus = "geplant" | "bestellt" | "geliefert" | "aufgebaut";

export interface ItemPart {
  pos?: string;
  name: string;
  variant?: string;
  vendor: Vendor;
  qty: number;
  unit: number;
  url?: string | null;
  dims?: string;
  delivery?: string;
}

/** Budgetposition ohne eigene Geometrie (Farbe, Kleber, Innenkissen, Montage …). */
export interface BudgetLine {
  id: string;
  pos?: string;
  room: string;
  name: string;
  vendor: Vendor;
  qty: number;
  unit: number;
  url?: string | null;
  note?: string;
  variant?: string;
  category?: string;
  status?: PurchaseStatus;
}

export type SurfaceKind =
  | "paint"
  | "limewash"
  | "wallpaper"
  | "lamella"
  | "woodPanel"
  | "wainscot"
  | "tiles"
  | "stone"
  | "concrete"
  | "microcement"
  | "fabric";

export interface Surface {
  kind: SurfaceKind;
  color: string;
  color2?: string;
  /** Muster/Variante (z. B. "stripes", "arches", "subway", "herringbone"). */
  pattern?: string;
  scale?: number;
  productName?: string;
  sheen?: "matt" | "edelmatt" | "seidenmatt" | "glanz";
}

export interface WallFinish {
  base: Surface;
  /** Unterer Bereich (Sockel, Wandvertäfelung, Zweifarbigkeit). */
  lower?: { height: number; surface: Surface; rail?: boolean };
}

export type FloorKind = "planks" | "herringbone" | "chevron" | "tiles" | "stone" | "deck" | "carpet" | "microcement" | "terrazzo";

export interface FloorFinish {
  kind: FloorKind;
  color: string;
  color2?: string;
  angle: number;
  plankLength?: number;
  plankWidth?: number;
  tileSize?: number;
  productName?: string;
}

export interface CeilingFinish {
  kind: "paint" | "woodSlats" | "woodPanel" | "concrete";
  /** Holzton bzw. Betonfarbe (Anstrichfarbe steht in RoomFinish.ceiling). */
  color?: string;
  /** Stuckprofil/Deckenleiste: Höhe in m (0 = keins). */
  cornice?: number;
  corniceColor?: string;
}

export interface SkirtingFinish {
  /** Höhe in m (0 = keine Sockelleiste). */
  height: number;
  /** "wall" = wie Wandfarbe, sonst Farbwert. */
  color: string;
  material?: "lacquer" | "oak" | "walnut" | "blackMetal";
}

export interface RoomFinish {
  floor: FloorFinish;
  ceiling: string;
  wall: WallFinish;
  ceilingFinish?: CeilingFinish;
  skirting?: SkirtingFinish;
}

export interface Project {
  version: 1;
  name: string;
  subtitle?: string;
  conceptId?: string;
  createdAt: string;
  updatedAt: string;
  items: PlacedItem[];
  budget: BudgetLine[];
  rooms: Record<string, RoomFinish>;
  /** Wandflächen-Überschreibungen: Schlüssel "<raumId>:<kantenindex>". */
  walls: Record<string, WallFinish>;
  settings: ProjectSettings;
  /** Benutzerdefinierte Katalogeinträge (z. B. importierte GLB). */
  customCatalog?: CatalogItem[];
  /** Gespeicherte Planungsvarianten (Momentaufnahmen von Möblierung, Ausbau und Budget). */
  variants?: ProjectVariant[];
}

export interface ProjectVariant {
  id: string;
  name: string;
  createdAt: string;
  items: PlacedItem[];
  budget: BudgetLine[];
  rooms: Record<string, RoomFinish>;
  walls: Record<string, WallFinish>;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  /** Innentüren: Türblattfarbe, Stil, Griff; Fensterrahmen. */
  doorColor?: string;
  doorStyle?: "flat" | "panel" | "groove";
  handleFinish?: "blackMetal" | "brass" | "steel";
  windowFrameColor?: string;
  doorsOpen: number;
  showDimensions: boolean;
  snap: boolean;
  gridSize: number;
  timeOfDay: number;
  budgetLimit: number;
  /** Sonnenstudie: Datum "JJJJ-MM-TT" (fehlt = heute), Lage von Norden im Plan (Grad im Uhrzeigersinn von „oben“), Standort. */
  sunDate?: string;
  northDeg?: number;
  latitude?: number;
  longitude?: number;
  /** Lichtfarbe der Leuchten im Abendlicht (Kelvin). */
  lampKelvin?: number;
  /** Gespeicherte 3D-Ansichten. */
  views3d?: SavedView3D[];
}

export interface SavedView3D {
  id: string;
  name: string;
  pos: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

// ---------- Grundriss ----------
export interface ApartmentOpening {
  id: string;
  type: "window" | "door" | "entrance";
  label: string;
  a: Vec2;
  b: Vec2;
  width: number;
  sill: number;
  height: number;
  depth: number;
  reveal: Vec2[] | null;
  balconyDoor?: boolean;
  hinge?: "a" | "b";
  swing?: number;
  leafWidth?: number;
}

export interface ApartmentRoom {
  id: string;
  name: string;
  floor: string;
  outdoor: boolean;
  polygon: Vec2[];
  area: number;
  perimeter: number;
}

export interface Apartment {
  name: string;
  source: string;
  ceilingHeight: number;
  doorHeight: number;
  wingRotationDeg: number;
  walls: Vec2[][];
  rooms: ApartmentRoom[];
  openings: ApartmentOpening[];
  railings: { a: Vec2; b: Vec2 }[];
  openBoundaries: Vec2[][];
  shaft: Vec2[];
  bounds: [number, number, number, number];
}
