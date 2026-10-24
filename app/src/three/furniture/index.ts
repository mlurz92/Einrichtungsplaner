import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Archetype, PlacedItem } from "../../model/types";
import { makeCtx, type Ctx } from "./common";
import * as S from "./seating";
import * as T from "./tables";
import * as St from "./storage";
import * as B from "./beds";
import * as L from "./lighting";
import * as D from "./decor";
import * as F from "./fixtures";

type Fn = (c: Ctx) => void;

const REG: Partial<Record<Archetype, Fn>> = {
  sofa: (c) => S.sofa(c),
  sofaModular: S.sofaModular,
  sofaRound: S.sofaRound,
  sofaCorner: S.sofaCorner,
  sofaBed: (c) => S.sofa(c, { bed: true }),
  armchairLounge: S.armchairLounge,
  armchairRound: S.armchairRound,
  armchairWing: S.armchairWing,
  armchairShell: S.armchairShell,
  diningArmchair: S.diningArmchair,
  diningChair: S.diningChair,
  cantilever: S.cantilever,
  chairFlex: S.chairFlex,
  benchFlex: S.benchFlex,
  barStool: S.barStool,
  pouf: S.pouf,
  bench: S.bench,
  officeChair: S.officeChair,
  tableRect: T.tableRect,
  tableRound: T.tableRound,
  tableOval: T.tableOval,
  tablePedestal: T.tablePedestal,
  coffeeDuo: T.coffeeDuo,
  coffeeBlock: T.coffeeBlock,
  coffeeRound: T.coffeeRound,
  sideRound: T.sideRound,
  sideContainer: T.sideContainer,
  desk: T.desk,
  deskStanding: T.deskStanding,
  console: T.console_,
  sideboard: St.sideboard,
  lowboard: St.lowboard,
  vitrine: St.vitrine,
  shelfOpen: St.shelfOpen,
  tylkoStorage: St.tylkoStorage,
  bookcase: St.bookcase,
  wardrobe: St.wardrobe,
  dresser: St.dresser,
  nightstand: St.nightstand,
  bed: B.bed,
  bedWood: B.bedWood,
  cushion: B.cushion,
  throw: B.throwBlanket,
  lampFloorGlobe: L.lampFloorGlobe,
  lampFloorShade: L.lampFloorShade,
  lampFloorArc: L.lampFloorArc,
  lampFloorTripod: L.lampFloorTripod,
  lampTableMushroom: L.lampTableMushroom,
  lampTableGlobe: L.lampTableGlobe,
  lampTableShade: L.lampTableShade,
  lampTableLayered: L.lampTableLayered,
  pendantGlobe: L.pendantGlobe,
  pendantDome: L.pendantDome,
  pendantCluster: L.pendantCluster,
  pendantMirrorBall: L.pendantMirrorBall,
  ceilingDome: L.ceilingDome,
  ceilingDisc: L.ceilingDisc,
  wallGlobe: L.wallGlobe,
  wallSconce: L.wallSconce,
  pendantLinear: L.pendantLinear,
  lampTask: L.lampTask,
  rugRect: D.rugRect,
  rugRound: D.rugRound,
  rugOrganic: D.rugOrganic,
  curtain: D.curtain,
  art: D.art,
  artPair: D.art,
  mirrorRound: D.mirrorRound,
  mirrorArch: D.mirrorArch,
  mirrorRect: D.mirrorRect,
  plantTree: D.plantTree,
  plantBush: D.plantBush,
  plantPot: D.plantPot,
  vase: D.vase,
  books: D.books,
  tray: D.tray,
  bowl: D.bowl,
  candles: D.candles,
  tv: D.tv,
  tvFrame: D.tvFrame,
  lamella: D.lamella,
  molding: D.molding,
  panelWall: D.panelWall,
  outdoorTable: F.outdoorTable,
  outdoorChair: F.outdoorChair,
  outdoorSofa: F.outdoorSofa,
  kitchenRun: F.kitchenRun,
  kitchenAlno: F.kitchenAlno,
  kitchenAlnoSide: F.kitchenAlnoSide,
  bathtub: F.bathtub,
  toilet: F.toilet,
  washbasin: F.washbasin,
  shower: F.shower,
  washer: F.washer,
  box: D.box,
};

export const ARCHETYPES = Object.keys(REG) as Archetype[];

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 10000;
}

// ---------------------------------------------------------------- GLB-Modelle (CC0 bzw. Nutzerimport)
const gltfLoader = new GLTFLoader();
const glbCache = new Map<string, Promise<THREE.Group>>();

function loadGlb(url: string): Promise<THREE.Group> {
  let p = glbCache.get(url);
  if (!p) {
    p = gltfLoader.loadAsync(url).then((g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return g.scene;
    });
    glbCache.set(url, p);
  }
  return p;
}

function glbObject(url: string, w: number, d: number, h: number): THREE.Group {
  const holder = new THREE.Group();
  const resolved = /^(https?:|data:|blob:|asset:|tauri:)/.test(url) ? url : `${import.meta.env.BASE_URL}${url.replace(/^\//, "")}`;
  loadGlb(resolved)
    .then((scene) => {
      const obj = scene.clone(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const s = Math.min(w / (size.x || 1), d / (size.z || 1), h / (size.y || 1));
      obj.scale.setScalar(s);
      const b2 = new THREE.Box3().setFromObject(obj);
      const c = b2.getCenter(new THREE.Vector3());
      obj.position.set(-c.x, -b2.min.y, -c.z);
      holder.add(obj);
    })
    .catch(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: "#bbbbbb", wireframe: true }));
      m.position.y = h / 2;
      holder.add(m);
    });
  return holder;
}

export interface BuildInput {
  archetype: Archetype;
  w: number;
  d: number;
  h: number;
  slots: PlacedItem["slots"];
  params?: PlacedItem["params"];
  model?: string;
  seedKey?: string;
}

/** Erzeugt das 3D-Objekt eines Möbels (lokale Achsen: Ursprung Mitte Grundfläche, Front +Z). */
export function buildFurniture(inp: BuildInput): THREE.Group {
  if (inp.archetype === "glb" && inp.model) return glbObject(inp.model, inp.w, inp.d, inp.h);
  const fn = REG[inp.archetype] ?? D.box;
  const ctx = makeCtx(inp.w, inp.d, inp.h, { ...inp.slots }, { ...(inp.params ?? {}) }, hashSeed(inp.seedKey ?? inp.archetype));
  try {
    fn(ctx);
  } catch (e) {
    console.warn("Archetyp-Fehler", inp.archetype, e);
    ctx.b.parts = [];
    D.box(ctx);
  }
  const g = ctx.b.build();
  g.userData.lights = g.children.filter((o) => o.userData.light);
  return g;
}
