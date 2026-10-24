import * as THREE from "three";
import type { MaterialKey, SlotStyle } from "../model/types";
import { ALBEDO_GAIN, ROUGH_MEAN, albedoTexture, colorTexture, dataTexture, graniteTexture, ribNormal, type TexKey } from "./textures";

// Physikalisch basierte Materialvorlagen. UVs der Möbelgeometrien sind in Metern angelegt
// (siehe geom.ts → worldUV); "scale" gibt die Kachelgröße der Textur in Metern an.

interface MatDef {
  tex?: TexKey;
  /** Fertig eingefärbte Textur (public/assets/textures/<name>_color.webp); Slotfarbe dient nur 2D-Plan und Listen */
  colorTex?: string;
  normalTex?: TexKey;
  roughTex?: TexKey;
  scale: number;
  roughness: number;
  metalness?: number;
  sheen?: number;
  sheenRoughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  normalScale?: number;
  contrast?: number;
  transmission?: number;
  opacity?: number;
  emissive?: number;
  ribs?: number;
  side?: THREE.Side;
}

export const MAT_DEFS: Record<MaterialKey, MatDef> = {
  fabric: { tex: "fabric", normalTex: "fabric", scale: 0.25, roughness: 0.92, sheen: 0.35, sheenRoughness: 0.8, normalScale: 0.8, contrast: 0.6 },
  // Melierter Webstoff (IKEA Gunnared, Remmarn, Tonerud): gröbere Struktur, stärkere Farbstreuung
  melange: { tex: "weave", normalTex: "weave", scale: 0.18, roughness: 0.95, sheen: 0.3, sheenRoughness: 0.85, normalScale: 1.1, contrast: 1.0 },
  // Chenille (Kilanda, Westwing Chenille): weicher Flor mit leichtem Glanz
  chenille: { tex: "velvet", normalTex: "fabric", scale: 0.3, roughness: 0.85, sheen: 0.8, sheenRoughness: 0.55, normalScale: 0.7, contrast: 0.55 },
  // Mikrofaser in Velours-/Vintage-Optik (DELIFE Flex): matter, kurzer Flor, leicht wolkige Farbstreuung
  microfiber: { tex: "fabric", normalTex: "fabric", scale: 0.4, roughness: 0.95, sheen: 0.3, sheenRoughness: 0.8, normalScale: 0.4, contrast: 0.5 },
  // Bouclé meliert: Bouclé mit deutlicherer Farbstreuung
  boucleMel: { tex: "boucle", normalTex: "boucle", scale: 0.1, roughness: 1, sheen: 0.5, sheenRoughness: 0.9, normalScale: 1.7, contrast: 1.6 },
  // Kunstfell: langer, dichter Flor
  fur: { tex: "boucle", normalTex: "boucle", scale: 0.04, roughness: 1, sheen: 1, sheenRoughness: 1, normalScale: 2.8, contrast: 0.9 },
  boucle: { tex: "boucle", normalTex: "boucle", scale: 0.1, roughness: 1, sheen: 0.55, sheenRoughness: 0.9, normalScale: 1.6, contrast: 1.1 },
  teddy: { tex: "boucle", normalTex: "boucle", scale: 0.06, roughness: 1, sheen: 0.9, sheenRoughness: 1, normalScale: 2.2, contrast: 1.2 },
  velvet: { tex: "velvet", normalTex: "velvet", scale: 0.6, roughness: 0.78, sheen: 1, sheenRoughness: 0.35, normalScale: 0.3, contrast: 0.45 },
  cord: { tex: "fabric", scale: 0.2, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.5, ribs: 10, normalScale: 1.2, contrast: 0.4 },
  linen: { tex: "linen", normalTex: "linen", scale: 0.3, roughness: 0.95, sheen: 0.2, sheenRoughness: 0.9, normalScale: 0.9, contrast: 0.8 },
  leather: { tex: "leather", normalTex: "leather", roughTex: "leather", scale: 0.35, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.5, normalScale: 0.6, contrast: 0.5 },
  wool: { tex: "wool", normalTex: "wool", scale: 0.35, roughness: 1, sheen: 0.4, sheenRoughness: 1, normalScale: 1.4, contrast: 0.7 },
  oak: { tex: "oakfine", normalTex: "oakfine", roughTex: "oakfine", scale: 1.1, roughness: 0.55, normalScale: 0.5, contrast: 1.1 },
  oakDark: { tex: "oakfine", normalTex: "oakfine", scale: 1.1, roughness: 0.5, clearcoat: 0.12, normalScale: 0.4, contrast: 1.3 },
  walnut: { tex: "walnut", normalTex: "walnut", scale: 1.0, roughness: 0.5, clearcoat: 0.1, normalScale: 0.4, contrast: 1.0 },
  burl: { tex: "burl", normalTex: "burl", scale: 0.7, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.15, normalScale: 0.3, contrast: 1.4 },
  mango: { tex: "darkwood", normalTex: "darkwood", scale: 1.0, roughness: 0.5, normalScale: 0.5, contrast: 1.1 },
  ash: { tex: "oakfine", normalTex: "oakfine", scale: 0.9, roughness: 0.55, normalScale: 0.5, contrast: 0.9 },
  lacquer: { scale: 1, roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.3 },
  matte: { scale: 1, roughness: 0.82 },
  gloss: { scale: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 },
  travertine: { tex: "travertine", normalTex: "travertine", scale: 1.2, roughness: 0.62, normalScale: 0.6, contrast: 0.9 },
  // Polierter Naturstein mit Flocken (Arbeitsplatte der Küche); Textur prozedural aus der Grundfarbe
  granite: { scale: 0.8, roughness: 0.14 },
  marble: { tex: "marble", normalTex: "marble", scale: 1.0, roughness: 0.16, normalScale: 0.2, contrast: 1.1 },
  marbleGreen: { tex: "marblegreen", normalTex: "marblegreen", scale: 0.9, roughness: 0.14, normalScale: 0.2, contrast: 1.6 },
  // Laminam® Noir Désir (Keramik auf Glas): schwarzbraun, ockerfarbene Adern mit hellem Kern, seidenglänzend.
  // Textur: tools/gen_noirdesir.py, 2048 px = 2,0 m, Adern schräg zur Tischlänge
  marbleNoir: { colorTex: "noirdesir", scale: 2.0, roughness: 0.22, clearcoat: 0.25, clearcoatRoughness: 0.12 },
  stone: { tex: "concrete", normalTex: "concrete", scale: 1.2, roughness: 0.75, normalScale: 0.5, contrast: 0.6 },
  ceramic: { scale: 1, roughness: 0.2 },
  glass: { scale: 1, roughness: 0.04, transmission: 0.96, opacity: 0.35 },
  ribbedGlass: { scale: 0.3, roughness: 0.2, transmission: 0.85, opacity: 0.5, ribs: 24, normalScale: 0.8 },
  opal: { scale: 1, roughness: 0.35, transmission: 0.0, emissive: 0.0 },
  mirror: { scale: 1, roughness: 0.02, metalness: 1 },
  brass: { tex: "brushed", normalTex: "brushed", scale: 0.4, roughness: 0.28, metalness: 1, normalScale: 0.15, contrast: 0.25 },
  copper: { tex: "brushed", normalTex: "brushed", scale: 0.4, roughness: 0.3, metalness: 1, normalScale: 0.15, contrast: 0.25 },
  chrome: { scale: 1, roughness: 0.06, metalness: 1 },
  steel: { tex: "brushed", normalTex: "brushed", scale: 0.4, roughness: 0.32, metalness: 1, normalScale: 0.2, contrast: 0.3 },
  // Pulverbeschichteter Stahl: Lack ist ein Dielektrikum (metalness 0)
  blackMetal: { scale: 1, roughness: 0.5 },
  rattan: { tex: "rattan", normalTex: "rattan", scale: 0.3, roughness: 0.75, normalScale: 1, contrast: 1.0 },
  plastic: { scale: 1, roughness: 0.4 },
  paper: { scale: 1, roughness: 0.9 },
  canvas: { tex: "linen", scale: 0.3, roughness: 0.95, contrast: 0.25 },
  plant: { scale: 1, roughness: 0.65, side: THREE.DoubleSide },
};

/**
 * Mittlere Albedo einer texturierten Fläche auf 0,85 begrenzen (heller Lack, weißer Stoff):
 * Farbe × ALBEDO_GAIN läge bei sehr hellen Tönen sonst über 1 und die Fläche würde mehr Licht
 * zurückwerfen, als auf sie fällt.
 */
export function capAlbedo(c: THREE.Color, max = 0.85 * ALBEDO_GAIN) {
  const m = Math.max(c.r, c.g, c.b);
  if (m > max) c.multiplyScalar(max / m);
  return c;
}

const cache = new Map<string, THREE.Material>();

/** Lampengläser leuchten im Abendmodus. */
export const emissiveMaterials = new Set<THREE.MeshPhysicalMaterial>();
let nightGlow = 0;

export function setNightGlow(v: number) {
  nightGlow = v;
  for (const m of emissiveMaterials) {
    m.emissiveIntensity = v;
  }
}

export function getMaterial(style: SlotStyle | undefined, fallback: SlotStyle = { color: "#cccccc", material: "matte" }): THREE.Material {
  const s = style ?? fallback;
  const key = `${s.material}|${s.color}`;
  let m = cache.get(key);
  if (m) return m;
  const def = MAT_DEFS[s.material] ?? MAT_DEFS.matte;
  const col = new THREE.Color(s.color);
  const p = new THREE.MeshPhysicalMaterial({
    color: col,
    roughness: def.roughness,
    metalness: def.metalness ?? 0,
    side: def.side ?? THREE.FrontSide,
  });
  if (def.tex) {
    // Helle Lasuren/Beizen (weiß gebeizte Eiche, Birke): Maserung zurücknehmen, sonst wirkt die Fläche grau
    const lum = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
    const woody = ["oak", "oakDark", "ash", "walnut", "mango", "burl"].includes(s.material);
    const contrast = (def.contrast ?? 1) * (woody && lum > 0.55 ? 0.55 : 1);
    const t = albedoTexture(def.tex, Math.round(contrast * 100) / 100).clone();
    t.repeat.set(1 / def.scale, 1 / def.scale);
    t.needsUpdate = true;
    p.map = t;
    p.color.multiplyScalar(ALBEDO_GAIN);
    capAlbedo(p.color);
  }
  if (def.colorTex) {
    const t = colorTexture(def.colorTex).clone();
    t.repeat.set(1 / def.scale, 1 / def.scale);
    t.needsUpdate = true;
    p.map = t;
    p.color.set("#ffffff");
  }
  if (s.material === "granite") {
    const t = graniteTexture(s.color);
    p.map = t.map.clone();
    p.map.repeat.set(1 / t.size, 1 / t.size);
    p.map.needsUpdate = true;
    p.color.set("#ffffff");
  }
  if (def.normalTex) {
    const n = dataTexture(def.normalTex, "normal").clone();
    n.repeat.set(1 / def.scale, 1 / def.scale);
    n.needsUpdate = true;
    p.normalMap = n;
    p.normalScale.set(def.normalScale ?? 1, def.normalScale ?? 1);
  }
  if (def.ribs) {
    const n = ribNormal(def.ribs).clone();
    n.repeat.set(1 / (def.scale * (s.material === "cord" ? 0.08 : 0.5)), 1);
    n.needsUpdate = true;
    p.normalMap = n;
    p.normalScale.set(def.normalScale ?? 1, def.normalScale ?? 1);
  }
  if (def.roughTex) {
    const r = dataTexture(def.roughTex, "rough").clone();
    r.repeat.set(1 / def.scale, 1 / def.scale);
    r.needsUpdate = true;
    p.roughnessMap = r;
    // three multipliziert Rauheit und Textur: auf den Mittelwert der Textur normieren,
    // sonst wird die Fläche deutlich glatter (z. B. Leder 0,5 × 0,37 ≈ 0,18) als vorgesehen
    p.roughness = Math.min(1, def.roughness / ROUGH_MEAN[def.roughTex]);
  }
  if (def.sheen) {
    p.sheen = def.sheen;
    p.sheenRoughness = def.sheenRoughness ?? 0.6;
    p.sheenColor = col.clone().lerp(new THREE.Color("#ffffff"), 0.35);
  }
  if (def.clearcoat) {
    p.clearcoat = def.clearcoat;
    // Möbellack ist meist seidenmatt; ein glatter Klarlack verdoppelt sonst sichtbar die Spiegelung
    p.clearcoatRoughness = def.clearcoatRoughness ?? 0.4;
  }
  if (def.transmission) {
    p.transmission = def.transmission;
    p.thickness = 0.01;
    p.ior = 1.5;
    p.transparent = true;
    p.opacity = 1;
  }
  if (s.material === "opal") {
    p.emissive = new THREE.Color("#fff1d6");
    p.emissiveIntensity = nightGlow;
    p.transmission = 0.15;
    p.thickness = 0.02;
    emissiveMaterials.add(p);
  }
  m = p;
  cache.set(key, m);
  return m;
}

export const highlightMaterial = new THREE.MeshBasicMaterial({ color: "#3b82f6", transparent: true, opacity: 0.18, depthWrite: false });
