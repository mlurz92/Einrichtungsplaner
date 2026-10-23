import apartmentJson from "./apartment.json";
import catalogJson from "./catalog.json";
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

export const concepts: { id: string; title: string; subtitle: string; palette: string[]; project: Project }[] = [
  { id: "concept1", title: "Travertin · Kupfer · Salbei", subtitle: "Konzept 1", palette: ["#d8bc94", "#e3d6c1", "#5e4130", "#b9aa97", "#a7b59e", "#b8703e"], project: c1 as unknown as Project },
  { id: "concept2", title: "Espresso · Petrol · Chrom", subtitle: "Konzept 2", palette: ["#d8bc94", "#e7dccb", "#5e4232", "#2f7074", "#3f5d4e", "#c6cbd0"], project: c2 as unknown as Project },
  { id: "concept3", title: "Stone · Petrol · Salbei", subtitle: "Konzept 3", palette: ["#d8bc94", "#cfc6b8", "#ece5d9", "#2f7074", "#94a98f", "#3b5670"], project: c3 as unknown as Project },
  { id: "concept4", title: "Ivory · Petrol · Messing", subtitle: "Konzept 4", palette: ["#f1ece3", "#d8bc94", "#e8ddcb", "#1f5a60", "#2e3f57", "#c9a55c"], project: c4 as unknown as Project },
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
