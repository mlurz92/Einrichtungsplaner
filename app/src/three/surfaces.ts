import * as THREE from "three";
import type { FloorFinish, Surface } from "../model/types";
import { capAlbedo } from "./materials";
import { ALBEDO_GAIN, ROUGH_MEAN, albedoTexture, dataTexture, floorTexture, wallPatternTexture } from "./textures";

// Materialien für Wand-, Boden- und Deckenflächen. Geometrie-UVs sind in Metern angelegt.

const cache = new Map<string, THREE.MeshPhysicalMaterial>();

/** Schnittebene für Wände (immer genau eine Ebene → keine Shader-Neukompilierung beim Umschalten). */
export const wallClipPlanes: THREE.Plane[] = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.3)];

function withRepeat(t: THREE.Texture, size: [number, number] | number): THREE.Texture {
  const c = t.clone();
  const [sx, sy] = typeof size === "number" ? [size, size] : size;
  c.repeat.set(1 / sx, 1 / sy);
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.needsUpdate = true;
  return c;
}

export function surfaceMaterial(s: Surface): THREE.MeshPhysicalMaterial {
  const key = JSON.stringify([s.kind, s.color, s.color2, s.pattern, s.scale, s.sheen]);
  let m = cache.get(key);
  if (m) return m;
  const rough = s.sheen === "glanz" ? 0.25 : s.sheen === "seidenmatt" ? 0.55 : s.sheen === "edelmatt" ? 0.82 : 0.92;
  m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(s.color), roughness: rough, clippingPlanes: wallClipPlanes });
  switch (s.kind) {
    case "paint":
      m.normalMap = withRepeat(dataTexture("plaster", "normal"), 1.6);
      m.normalScale.set(0.25, 0.25);
      break;
    case "limewash":
      m.map = withRepeat(albedoTexture("limewash", 1.6), 1.8 * (s.scale ?? 1));
      capAlbedo(m.color.multiplyScalar(ALBEDO_GAIN));
      m.normalMap = withRepeat(dataTexture("limewash", "normal"), 1.8);
      m.normalScale.set(0.35, 0.35);
      m.roughness = 0.97;
      break;
    case "concrete":
    case "microcement":
      m.map = withRepeat(albedoTexture("concrete", 0.9), 2.2);
      capAlbedo(m.color.multiplyScalar(ALBEDO_GAIN));
      m.normalMap = withRepeat(dataTexture("concrete", "normal"), 2.2);
      m.normalScale.set(0.3, 0.3);
      m.roughness = 0.85;
      break;
    case "stone":
      m.map = withRepeat(albedoTexture("travertine", 1), 1.4);
      capAlbedo(m.color.multiplyScalar(ALBEDO_GAIN));
      m.normalMap = withRepeat(dataTexture("travertine", "normal"), 1.4);
      m.roughness = 0.55;
      break;
    case "fabric":
      m.map = withRepeat(albedoTexture("linen", 0.8), 0.4);
      capAlbedo(m.color.multiplyScalar(ALBEDO_GAIN));
      m.normalMap = withRepeat(dataTexture("linen", "normal"), 0.4);
      m.sheen = 0.3;
      break;
    case "wallpaper":
    case "tiles":
    case "woodPanel":
    case "wainscot": {
      const kind = s.kind === "wainscot" ? "woodPanel" : s.kind;
      const t = wallPatternTexture(kind, s.pattern, s.color, s.color2, s.scale ?? 1);
      m.color.set("#ffffff");
      m.map = withRepeat(t.map, t.size);
      if (t.normal) {
        m.normalMap = withRepeat(t.normal, t.size);
        m.normalScale.set(0.6, 0.6);
      }
      // Glasierte Fliesen: eine glatte Glasur, kein zusätzlicher Klarlack
      m.roughness = s.kind === "tiles" ? 0.18 : 0.8;
      break;
    }
    case "lamella":
      // Geometrie wird separat erzeugt; Grundfläche = Filz
      m.color.set(s.color2 ?? "#141414");
      m.roughness = 1;
      break;
  }
  cache.set(key, m);
  return m;
}

const floorCache = new Map<string, THREE.MeshPhysicalMaterial>();

export function floorMaterial(f: FloorFinish): { mat: THREE.MeshPhysicalMaterial; size: [number, number] } {
  const key = JSON.stringify(f);
  const hit = floorCache.get(key);
  const tex = floorTexture(f.kind, f.color, f.plankLength ?? 1.9, f.plankWidth ?? 0.19, f.color2, f.tileSize ?? 0.6);
  if (hit) return { mat: hit, size: tex.size };
  const m = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: f.kind === "tiles" || f.kind === "terrazzo" ? 0.3 : f.kind === "carpet" ? 1 : 0.5 });
  m.map = tex.map;
  if (tex.normal) {
    m.normalMap = tex.normal;
    m.normalScale.set(0.6, 0.6);
  }
  if (f.kind === "planks" || f.kind === "herringbone" || f.kind === "chevron") {
    // Geölte bzw. matt lackierte Dielen: mittlere Rauheit 0,5 (Textur auf ihren Mittelwert normiert)
    m.clearcoat = 0.05;
    m.clearcoatRoughness = 0.45;
    m.roughnessMap = dataTexture("oak", "rough");
    m.roughness = Math.min(1, 0.5 / ROUGH_MEAN.oak);
  }
  if (f.kind === "carpet") {
    m.color.set(f.color);
    m.map = null;
    m.normalMap = withRepeat(dataTexture("wool", "normal"), 0.4);
    m.sheen = 0.5;
  }
  floorCache.set(key, m);
  return { mat: m, size: tex.size };
}

export function ceilingMaterial(color: string): THREE.MeshPhysicalMaterial {
  const key = `ceil|${color}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, side: THREE.DoubleSide });
    m.normalMap = withRepeat(dataTexture("plaster", "normal"), 2);
    m.normalScale.set(0.15, 0.15);
    cache.set(key, m);
  }
  return m;
}
