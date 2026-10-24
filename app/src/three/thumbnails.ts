import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CatalogItem, SlotStyle, Slot } from "../model/types";
import { buildFurniture } from "./furniture";
import { texturesIdle } from "./textures";

// Vorschaubilder der Katalogeinträge, gerendert aus denselben 3D-Modellen (offline, konsistent).

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
const cache = new Map<string, string>();
const queue: { key: string; c: CatalogItem; variant: number; resolve: (s: string) => void }[] = [];
let running = false;
let ready: Promise<unknown> | null = null;

function init() {
  if (renderer) return;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 220;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(220, 220, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  const sun = new THREE.DirectionalLight("#fff4e6", 2.2);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight("#ffffff", "#cbbfae", 0.6));
  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  ready = Promise.resolve();
}

export function thumbnailKey(c: CatalogItem, variant: number) {
  return `${c.id}#${variant}`;
}

export function getThumbnail(c: CatalogItem, variant = 0): Promise<string> {
  const key = thumbnailKey(c, variant);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    queue.push({ key, c, variant, resolve });
    pump();
  });
}

export function cancelThumbnails(keep: Set<string>) {
  for (let i = queue.length - 1; i >= 0; i--) if (!keep.has(queue[i].key)) queue.splice(i, 1);
}

function pump() {
  if (running) return;
  running = true;
  init();
  ready!.then(() => {
    const step = async () => {
      const job = queue.shift();
      if (!job) {
        running = false;
        return;
      }
      // Objekt aufbauen (stößt Texturladen an), erst nach vollständigem Laden rendern
      const g = build(job.c, job.variant);
      await texturesIdle();
      const url = render(job.c, g);
      cache.set(job.key, url);
      job.resolve(url);
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  });
}

function build(c: CatalogItem, variantIdx: number): THREE.Group {
  const v = c.variants[variantIdx] ?? c.variants[0];
  const slots = (v?.slots ?? {}) as Partial<Record<Slot, SlotStyle>>;
  const w = Math.max(c.w / 100, 0.02), d = Math.max(c.d / 100, 0.02), h = Math.max(c.h / 100, 0.02);
  const obj = buildFurniture({ archetype: c.archetype, w, d, h, slots, params: v?.params ? { ...c.params, ...v.params } : c.params, model: c.model, seedKey: c.id });
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

function render(c: CatalogItem, g: THREE.Group): string {
  // Wandobjekte von vorn, Rest schräg
  const flatWall = c.mount === "wall" || c.category === "curtain";
  g.rotation.y = flatWall ? 0 : -0.55;
  scene.add(g);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.62;
  const dist = r / Math.tan((camera.fov * Math.PI) / 360) * 1.08;
  const dir = flatWall ? new THREE.Vector3(0, 0.12, 1).normalize() : c.category === "rug" ? new THREE.Vector3(0, 1.4, 1).normalize() : new THREE.Vector3(0.25, 0.42, 1).normalize();
  camera.position.copy(center).add(dir.multiplyScalar(dist));
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  renderer!.setClearColor(0x000000, 0);
  renderer!.render(scene, camera);
  const url = renderer!.domElement.toDataURL("image/webp", 0.82);
  scene.remove(g);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  return url;
}
