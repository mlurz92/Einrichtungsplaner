import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildFurniture } from "../three/furniture";
import { floorMaterial, surfaceMaterial } from "../three/surfaces";
import { texturesIdle } from "../three/textures";
import { getCatalogItem } from "../store/project";
import { getMaterial } from "../three/materials";
import type { Slot, SlotStyle } from "../model/types";

// Quelle des App-Icons: isometrischer Raumausschnitt (wie im Wandmodus „Auto“) mit Möbeln aus dem Katalog.
// Wird nicht in die App gebündelt; tools/render_icon.mjs rendert die Szene im Browser und setzt das Icon zusammen.

const H = 2.56;
const S = 3.0; // Kantenlänge des Raumausschnitts
const T = 0.16; // Wandstärke

interface Place {
  id: string;
  variant?: number;
  x: number;
  z: number;
  rot?: number;
  elev?: number;
  scale?: [number, number, number];
}

const PLACES: Place[] = [
  { id: "wes-runder-wollteppich-eleni-handgetuftet", variant: 1, x: 1.62, z: 1.72, scale: [2.3, 2.3, 1] },
  { id: "wes-tribeca-3-seater-baloo-2076-warm-beige-en-26wes93215", variant: 0, x: 1.66, z: 0.56 },
  { id: "wes-jael-coffee-table-travertine-look-o105-x-h32-en-25wes94318", variant: 2, x: 1.6, z: 1.78 },
  { id: "wes-handgefertigte-design-vase-saki-2-bund-pampas", x: 1.78, z: 1.7, elev: 0.32 },
  { id: "wes-boucl-sessel-sofia", variant: 0, x: 0.64, z: 2.32, rot: 305 },
  { id: "fac-grosspflanze-olivenbaum-oder-ficus-lyrata-150-18", variant: 0, x: 0.36, z: 0.36 },
  { id: "wes-bogenlampe-cora-mit-travertinfuss-146471", x: 0.3, z: 1.2, rot: 90 },
  { id: "wes-runder-beistelltisch-marisa-aus-travertin", x: 2.92, z: 0.5 },
  { id: "wes-gerahmtes-leinwandbild-vibranium-handgemalt-male", x: 0.03, z: 2.25, rot: 270, elev: 1.0 },
];

function furniture(p: Place): THREE.Object3D | null {
  const c = getCatalogItem(p.id);
  if (!c) return null;
  const v = c.variants[p.variant ?? 0] ?? c.variants[0];
  const [sx, sy, sz] = p.scale ?? [1, 1, 1];
  const w = (c.w / 100) * (p.scale ? sx / (c.w / 100) : 1);
  const d = (c.d / 100) * (p.scale ? sy / (c.d / 100) : 1);
  const h = (c.h / 100) * sz;
  const o = buildFurniture({
    archetype: c.archetype,
    w,
    d,
    h,
    slots: (v?.slots ?? {}) as Partial<Record<Slot, SlotStyle>>,
    params: { ...(c.params ?? {}), name: c.name },
    model: c.model,
    seedKey: c.id,
  });
  o.position.set(p.x, p.elev ?? (c.mount === "wall" ? 1.0 : 0), p.z);
  o.rotation.y = (-(p.rot ?? 0) * Math.PI) / 180;
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material | THREE.Material[]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Wandkörper mit Oberfläche zur Raumseite, dunklem Schnitt oben und hellem Rohbau außen. */
function wall(len: number, along: "x" | "z", face: THREE.Material) {
  const shell = new THREE.MeshPhysicalMaterial({ color: "#e6e0d6", roughness: 0.9 });
  const cap = new THREE.MeshPhysicalMaterial({ color: "#2b2724", roughness: 0.8 });
  // BoxGeometry-Reihenfolge: +x, −x, +y, −y, +z, −z
  if (along === "x") return box(len + T, H, T, (len - T) / 2, H / 2, -T / 2, [shell, shell, cap, shell, face, shell]);
  return box(T, H, len, -T / 2, H / 2, len / 2, [face, shell, cap, shell, shell, shell]);
}

export async function renderIconScene(size = 2048): Promise<string> {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight("#fff8ee", "#b8a48c", 0.55));
  const sun = new THREE.DirectionalLight("#fff1dc", 3.0);
  sun.position.set(5.5, 7.5, 3.2);
  sun.target.position.set(S / 2, 0, S / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.015;
  sun.shadow.radius = 6;
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 25 });
  scene.add(sun, sun.target);

  const root = new THREE.Group();
  // Bodenplatte: Eichendielen 1,90 m auf dunkler Schnittkante
  const fm = floorMaterial({ kind: "planks", color: "#d6b285", angle: 0, plankLength: 1.9, plankWidth: 0.19 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(S, S), fm.mat.clone());
  const uv = top.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * S) / fm.size[0], (uv.getY(i) * S) / fm.size[1]);
  top.rotation.x = -Math.PI / 2;
  top.position.set(S / 2, 0.001, S / 2);
  top.receiveShadow = true;
  root.add(top);
  const slab = new THREE.MeshPhysicalMaterial({ color: "#2b2724", roughness: 0.7 });
  root.add(box(S + T, 0.2, S + T, (S - T) / 2, -0.1, (S - T) / 2, slab));
  // Wände: hinten Eiche-Lamellen auf Filz, links Kalkfarbe Salbei
  const lam = { kind: "paint", color: "#ece6da" } as const;
  root.add(wall(S, "x", surfaceMaterial(lam)));
  root.add(wall(S, "z", surfaceMaterial({ kind: "paint", color: "#9fab97" })));
  const felt = new THREE.MeshPhysicalMaterial({ color: "#1c1a18", roughness: 1 });
  root.add(box(2.12, H - 0.002, 0.01, 1.66, H / 2, 0.006, felt));
  const oak = getMaterial({ color: "#c49a6c", material: "oak" });
  for (let x = 0.62; x <= 2.7; x += 0.0405) root.add(box(0.027, H - 0.004, 0.016, x, H / 2, 0.019, oak));
  // Sockelleiste
  const sk = new THREE.MeshPhysicalMaterial({ color: "#f4f1ea", roughness: 0.5 });
  root.add(box(0.014, 0.07, S, 0.007, 0.035, S / 2, sk));
  for (const p of PLACES) {
    const o = furniture(p);
    if (o) root.add(o);
  }
  scene.add(root);
  await texturesIdle();
  await new Promise((r) => setTimeout(r, 400));
  await texturesIdle();

  // Isometrische Kamera (Blick von vorn rechts in die offene Raumecke)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const dir = new THREE.Vector3(1, 0.86, 1).normalize();
  const center = new THREE.Vector3(S / 2 - 0.12, H / 2 - 0.3, S / 2 - 0.12);
  cam.position.copy(center).add(dir.multiplyScalar(20));
  cam.lookAt(center);
  const half = 2.62;
  Object.assign(cam, { left: -half, right: half, top: half, bottom: -half });
  cam.updateProjectionMatrix();
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, cam);
  const url = canvas.toDataURL("image/png");
  renderer.dispose();
  return url;
}
