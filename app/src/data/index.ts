import apartmentJson from "./apartment.json";
import catalogJson from "./catalog.json";
import aliasJson from "./catalogAliases.json";
import c1 from "./concepts/concept1.json";
import c2 from "./concepts/concept2.json";
import c3 from "./concepts/concept3.json";
import c4 from "./concepts/concept4.json";
import type { Apartment, CatalogItem, Project } from "../model/types";
import { computeWallFaces, type WallFace } from "../model/geometry";

export const apartment = apartmentJson as unknown as Apartment;
export const wallFaces: WallFace[] = computeWallFaces(apartment);
export const wallFaceById = new Map(wallFaces.map((f) => [f.id, f]));

export const baseCatalog = catalogJson as unknown as CatalogItem[];
/** Frühere Katalog-IDs → aktuelle IDs (gespeicherte Projekte bleiben nach einem Katalog-Neuaufbau gültig). */
export const catalogAliases = aliasJson as Record<string, string>;

export const concepts: { id: string; title: string; subtitle: string; palette: string[]; project: Project }[] = [
  { id: "concept1", title: "Noir · Sand · Nussbaum", subtitle: "Konzept 1", palette: ["#45403c", "#d6c7ae", "#b9aa97", "#c2b8ab", "#5e4130", "#1d1d1d"], project: c1 as unknown as Project },
  { id: "concept2", title: "Noir · Espresso · Emperador", subtitle: "Konzept 2", palette: ["#45403c", "#e7dccb", "#5d4231", "#ede8dc", "#5b4535", "#3b2a22"], project: c2 as unknown as Project },
  { id: "concept3", title: "Noir · Stone · Greige", subtitle: "Konzept 3", palette: ["#45403c", "#cfc6b8", "#e2d5c0", "#d6c7ae", "#2b2b2c", "#ece5d9"], project: c3 as unknown as Project },
  { id: "concept4", title: "Noir · Ivory · Travertin", subtitle: "Konzept 4", palette: ["#45403c", "#f1ece3", "#e8ddcb", "#ebe6de", "#4a3e36", "#1f1e1d"], project: c4 as unknown as Project },
];

export const roomNames: Record<string, string> = Object.fromEntries(apartment.rooms.map((r) => [r.id, r.name]));

export const CATEGORY_LABELS: Record<string, string> = {
  sofa: "Sofas",
  armchair: "Sessel",
  chair: "Stühle",
  stool: "Barhocker",
  bench: "Bänke",
  pouf: "Hocker & Poufs",
  coffeeTable: "Couchtische",
  sideTable: "Beistelltische",
  diningTable: "Esstische",
  desk: "Schreibtische",
  console: "Konsolen",
  sideboard: "Sideboards",
  lowboard: "TV-Lowboards",
  cabinet: "Schränke & Vitrinen",
  shelf: "Regale",
  wardrobe: "Kleiderschränke",
  dresser: "Kommoden",
  bed: "Betten",
  nightstand: "Nachttische",
  officeChair: "Bürostühle",
  floorLamp: "Stehleuchten",
  tableLamp: "Tischleuchten",
  pendant: "Pendelleuchten",
  ceilingLamp: "Deckenleuchten",
  wallLamp: "Wandleuchten",
  rug: "Teppiche",
  curtain: "Vorhänge",
  art: "Bilder & Kunst",
  mirror: "Spiegel",
  plant: "Pflanzen",
  decor: "Deko",
  textile: "Kissen & Plaids",
  wallPanel: "Wandpaneele",
  molding: "Profilleisten & Stuck",
  outdoor: "Balkon & Garten",
  kitchen: "Küche",
  bath: "Bad",
  appliance: "Geräte",
  media: "TV & Medien",
};

export const CATEGORY_GROUPS: { label: string; cats: string[] }[] = [
  { label: "Sitzen", cats: ["sofa", "armchair", "chair", "pouf", "bench", "stool", "officeChair"] },
  { label: "Tische", cats: ["coffeeTable", "sideTable", "diningTable", "desk", "console"] },
  { label: "Stauraum", cats: ["sideboard", "lowboard", "cabinet", "shelf", "wardrobe", "dresser", "nightstand"] },
  { label: "Schlafen", cats: ["bed"] },
  { label: "Licht", cats: ["floorLamp", "tableLamp", "pendant", "ceilingLamp", "wallLamp"] },
  { label: "Textil & Deko", cats: ["rug", "curtain", "textile", "art", "mirror", "plant", "decor"] },
  { label: "Wand & Ausbau", cats: ["wallPanel", "molding", "media"] },
  { label: "Außen", cats: ["outdoor"] },
];
