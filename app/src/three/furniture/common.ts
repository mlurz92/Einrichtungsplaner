import * as THREE from "three";
import type { Slot, SlotStyle } from "../../model/types";
import { getMaterial } from "../materials";
import { Builder } from "../geom";

export type Params = Record<string, number | string | boolean>;

export interface Ctx {
  w: number;
  d: number;
  h: number;
  p: Params;
  slots: Partial<Record<Slot, SlotStyle>>;
  m: (slot: Slot, fb?: SlotStyle) => THREE.Material;
  b: Builder;
  seed: number;
}

export function makeCtx(w: number, d: number, h: number, slots: Partial<Record<Slot, SlotStyle>>, p: Params, seed = 1): Ctx {
  const m = (slot: Slot, fb?: SlotStyle) => {
    const s = slots[slot] ?? (slot === "legs" || slot === "frame" ? undefined : slots.main) ?? fb;
    return getMaterial(s, fb ?? { color: "#bdb5a8", material: "matte" });
  };
  return { w, d, h, p, slots, m, b: new Builder(), seed };
}

export const num = (p: Params, k: string, def: number) => (typeof p[k] === "number" ? (p[k] as number) : def);
export const str = (p: Params, k: string, def: string) => (typeof p[k] === "string" ? (p[k] as string) : def);
export const bool = (p: Params, k: string, def = false) => (typeof p[k] === "boolean" ? (p[k] as boolean) : def);

export const BLACK: SlotStyle = { color: "#1d1d1d", material: "blackMetal" };
export const OAK: SlotStyle = { color: "#b98d5f", material: "oak" };
export const WHITE: SlotStyle = { color: "#f2f1ed", material: "matte" };
export const OPAL: SlotStyle = { color: "#f6f4ee", material: "opal" };
export const CHROME: SlotStyle = { color: "#d0d4d8", material: "chrome" };

export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Röhre entlang Punkten (Freischwinger, Bügel, Kabel). */
export function tube(points: THREE.Vector3[], r: number, mat: THREE.Material, closed = false, seg = 64): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.1);
  const g = new THREE.TubeGeometry(curve, seg, r, 10, closed);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Feine Polylinie als Röhre ohne Glättung (Kabel, Gestänge). */
export function polyTube(points: THREE.Vector3[], r: number, mat: THREE.Material): THREE.Mesh {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  const g = new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, Math.max(8, points.length * 6), r, 8, false);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

/** C-förmige Schale (Sessel/Tub-Chair) in XZ: Außenkontur abgerundet, vorne offen. */
export function shellShape(w: number, d: number, thick: number, openFront = 0.55): THREE.Shape {
  const s = new THREE.Shape();
  const rx = w / 2;
  const rz = d / 2;
  const a0 = Math.PI * (0.5 - openFront / 2);
  const a1 = Math.PI * (0.5 + openFront / 2);
  // Außenbogen von a1 über hinten bis a0 (Front = +Z, Winkel in XZ: x=cos, z=sin)
  const steps = 48;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a1 + ((Math.PI * 2 - (a1 - a0)) * i) / steps;
    pts.push(new THREE.Vector2(Math.cos(a) * rx, Math.sin(a) * rz));
  }
  for (let i = steps; i >= 0; i--) {
    const a = a1 + ((Math.PI * 2 - (a1 - a0)) * i) / steps;
    pts.push(new THREE.Vector2(Math.cos(a) * (rx - thick), Math.sin(a) * (rz - thick)));
  }
  s.setFromPoints(pts);
  return s;
}
