import * as THREE from "three";
import { apartment, wallFaces } from "../data";
import type { ApartmentOpening, FloorFinish, Project, Surface, Vec2, WallFinish } from "../model/types";
import { DEG } from "../model/geometry";
import { ceilingMaterial, floorMaterial, surfaceMaterial, wallClipPlanes } from "./surfaces";
import { getMaterial } from "./materials";
import { cutAwareRaycast, patchCutaway } from "./cutaway";

// 3D-Aufbau der Wohnung aus den Vektordaten: Wände (Rohbau), Wandoberflächen je Raumkante,
// Böden, Decken, Fenster, Türen, Geländer. Plan (x, y) → Welt (x, 0, y).

const H = apartment.ceilingHeight;
const SLAB = 0.22;

function shapeFrom(poly: Vec2[]): THREE.Shape {
  return new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, -y)));
}

/** Prisma aus Grundriss-Polygon von y0 bis y1. */
function prism(poly: Vec2[], y0: number, y1: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shapeFrom(poly), { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

function flat(poly: Vec2[], y: number, angleDeg: number, tile: [number, number], down = false): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shapeFrom(poly));
  g.rotateX(-Math.PI / 2);
  if (down) g.rotateX(0);
  g.translate(0, y, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const a = -angleDeg * DEG;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    uv[i * 2] = (x * Math.cos(a) - z * Math.sin(a)) / tile[0];
    uv[i * 2 + 1] = (x * Math.sin(a) + z * Math.cos(a)) / tile[1];
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (down) {
    // Normale nach unten (Decke)
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const t = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, t);
    }
    g.computeVertexNormals();
  }
  return g;
}

/** Wandfläche (Rechteck in der Ebene einer Raumkante, leicht in den Raum versetzt). */
function wallQuad(a: Vec2, u: Vec2, n: Vec2, s0: number, s1: number, y0: number, y1: number, off = 0.0015): THREE.BufferGeometry {
  const p = (s: number, y: number) => [a[0] + u[0] * s + n[0] * off, y, a[1] + u[1] * s + n[1] * off];
  const v = [...p(s0, y0), ...p(s1, y0), ...p(s1, y1), ...p(s0, y1)];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([s0, y0, s1, y0, s1, y1, s0, y1], 2));
  // Normale = n (Raumseite) → Dreiecksreihenfolge passend wählen
  const cross = u[0] * n[1] - u[1] * n[0];
  g.setIndex(cross > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  // Falls Normale falsch: umdrehen
  const nn = g.attributes.normal as THREE.BufferAttribute;
  if (nn.getX(0) * n[0] + nn.getZ(0) * n[1] < 0) {
    g.setIndex(cross > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
  }
  return g;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, cast = false, receive = true): THREE.Mesh {
  const x = new THREE.Mesh(g, m);
  x.castShadow = cast;
  x.receiveShadow = receive;
  return x;
}

const wallSolidMat = new THREE.MeshPhysicalMaterial({ color: "#ebe7df", roughness: 0.95, clippingPlanes: wallClipPlanes });
const wallPocheMat = new THREE.MeshBasicMaterial({ color: "#2f2c29", side: THREE.BackSide, clippingPlanes: wallClipPlanes });
const slabMat = new THREE.MeshPhysicalMaterial({ color: "#d9d5cd", roughness: 0.95 });
const frameMat = new THREE.MeshPhysicalMaterial({ color: "#3b3d40", roughness: 0.55, clippingPlanes: wallClipPlanes });
const glassMat = new THREE.MeshPhysicalMaterial({ color: "#eef4f6", roughness: 0.02, transmission: 0.97, thickness: 0.006, ior: 1.5, transparent: true, clippingPlanes: wallClipPlanes });
const doorMat = new THREE.MeshPhysicalMaterial({ color: "#f4f3ef", roughness: 0.45, clearcoat: 0.1, clearcoatRoughness: 0.4, clippingPlanes: wallClipPlanes });
const entranceMat = new THREE.MeshPhysicalMaterial({ color: "#6e6c69", roughness: 0.5, clippingPlanes: wallClipPlanes });
const handleMat = clipped(getMaterial({ color: "#1d1d1d", material: "blackMetal" }));

/** Kopie eines Katalogmaterials, die mit den Wänden geschnitten wird (Griffe in Türen/Fenstern). */
function clipped(m: THREE.Material): THREE.Material {
  const c = m.clone();
  c.clippingPlanes = wallClipPlanes;
  return c;
}
const handleCache = new Map<string, THREE.Material>();
function doorHandleMat(finish: string): THREE.Material {
  let m = handleCache.get(finish);
  if (!m) {
    m = clipped(getMaterial({ color: { brass: "#c3a160", steel: "#b9bcbf", blackMetal: "#1d1d1d" }[finish] ?? "#1d1d1d", material: finish as "brass" }));
    handleCache.set(finish, m);
  }
  return m;
}
const railMat = new THREE.MeshPhysicalMaterial({ color: "#3b3d40", roughness: 0.5 });

export interface ApartmentBuild {
  group: THREE.Group;
  pickables: THREE.Object3D[];
}

function finishFor(p: Project, faceId: string, roomId: string): WallFinish {
  return p.walls[faceId] ?? p.rooms[roomId]?.wall ?? { base: { kind: "paint", color: "#f3f0e8" } };
}

function addSlats(group: THREE.Group, s: Surface, a: Vec2, u: Vec2, n: Vec2, s0: number, s1: number, y0: number, y1: number) {
  const slat = 0.027, gap = 0.0135;
  const count = Math.floor((s1 - s0 + gap) / (slat + gap));
  if (count <= 0) return;
  const geo = new THREE.BoxGeometry(slat, y1 - y0, 0.012);
  const mat = slatMaterial(s.color, s.pattern === "walnut" ? "walnut" : "oak");
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const used = count * slat + (count - 1) * gap;
  const start = s0 + (s1 - s0 - used) / 2 + slat / 2;
  const rot = Math.atan2(u[1], u[0]);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rot);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const sPos = start + i * (slat + gap);
    m.compose(new THREE.Vector3(a[0] + u[0] * sPos + n[0] * 0.016, (y0 + y1) / 2, a[1] + u[1] * sPos + n[1] * 0.016), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, m);
  }
  inst.castShadow = true;
  inst.receiveShadow = true;
  group.add(inst);
}

const slatCache = new Map<string, THREE.MeshPhysicalMaterial>();
function slatMaterial(color: string, material: "oak" | "walnut") {
  const k = `${color}|${material}`;
  let m = slatCache.get(k);
  if (!m) {
    m = (getMaterial({ color, material }) as THREE.MeshPhysicalMaterial).clone();
    m.clippingPlanes = wallClipPlanes;
    slatCache.set(k, m);
  }
  return m;
}

function addWainscotFrames(group: THREE.Group, color: string, a: Vec2, u: Vec2, n: Vec2, s0: number, s1: number, top: number) {
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, clippingPlanes: wallClipPlanes });
  const L = s1 - s0;
  const cnt = Math.max(1, Math.round(L / 0.55));
  const pw = L / cnt;
  const rot = Math.atan2(u[1], u[0]);
  const add = (s: number, y: number, w: number, h: number, depth = 0.012) => {
    const g = new THREE.BoxGeometry(w, h, depth);
    const mm = new THREE.Mesh(g, mat);
    mm.position.set(a[0] + u[0] * s + n[0] * depth / 2, y, a[1] + u[1] * s + n[1] * depth / 2);
    mm.rotation.y = -rot;
    mm.castShadow = true;
    mm.receiveShadow = true;
    group.add(mm);
  };
  add((s0 + s1) / 2, top - 0.02, L, 0.04, 0.03);
  add((s0 + s1) / 2, 0.05, L, 0.1, 0.015);
  for (let i = 0; i < cnt; i++) {
    const cs = s0 + pw * (i + 0.5);
    const fw = pw - 0.14, fh = top - 0.32;
    if (fw < 0.1 || fh < 0.1) continue;
    add(cs, 0.17 + 0.01, fw, 0.02);
    add(cs, 0.17 + fh - 0.01, fw, 0.02);
    add(cs - fw / 2 + 0.01, 0.17 + fh / 2, 0.02, fh);
    add(cs + fw / 2 - 0.01, 0.17 + fh / 2, 0.02, fh);
  }
}

function addSkin(group: THREE.Group, pickables: THREE.Object3D[], fin: WallFinish, faceId: string, a: Vec2, u: Vec2, n: Vec2, s0: number, s1: number, y0: number, y1: number) {
  const lower = fin.lower && fin.lower.height > 0.01 ? fin.lower : null;
  const split = lower ? Math.min(Math.max(lower.height, y0), y1) : y0;
  const parts: [Surface, number, number][] = [];
  if (lower && split > y0) parts.push([lower.surface, y0, split]);
  if (y1 > split) parts.push([fin.base, split, y1]);
  for (const [s, ya, yb] of parts) {
    const m = mesh(wallQuad(a, u, n, s0, s1, ya, yb), surfaceMaterial(s));
    m.userData.faceId = faceId;
    group.add(m);
    pickables.push(m);
    if (s.kind === "lamella") addSlats(group, s, a, u, n, s0, s1, ya, yb);
    if (s.kind === "wainscot") addWainscotFrames(group, s.color, a, u, n, s0, s1, yb);
  }
  if (lower && lower.rail && split > y0 && lower.surface.kind !== "wainscot") {
    const g = new THREE.BoxGeometry(s1 - s0, 0.035, 0.02);
    const mm = new THREE.Mesh(g, surfaceMaterial({ kind: "paint", color: lower.surface.color }));
    const mid = (s0 + s1) / 2;
    mm.position.set(a[0] + u[0] * mid + n[0] * 0.01, split, a[1] + u[1] * mid + n[1] * 0.01);
    mm.rotation.y = -Math.atan2(u[1], u[0]);
    group.add(mm);
  }
}

function buildWindow(o: ApartmentOpening, group: THREE.Group) {
  const [ax, ay] = o.a;
  const [bx, by] = o.b;
  const L = o.width;
  const u: Vec2 = [(bx - ax) / L, (by - ay) / L];
  const rv = o.reveal!;
  const cx = rv.reduce((s, p) => s + p[0], 0) / rv.length;
  const cy = rv.reduce((s, p) => s + p[1], 0) / rv.length;
  const rot = -Math.atan2(u[1], u[0]);
  const g = new THREE.Group();
  g.position.set(cx, 0, cy);
  g.rotation.y = rot;
  const fh = o.height;
  const prof = 0.07;
  const depth = 0.08;
  const add = (w: number, h: number, d: number, x: number, y: number, mat: THREE.Material, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = mat !== glassMat;
    m.receiveShadow = true;
    g.add(m);
  };
  add(L, prof, depth, 0, fh - prof / 2, frameMat);
  add(L, 0.05, depth, 0, 0.025, frameMat);
  add(prof, fh, depth, -L / 2 + prof / 2, fh / 2, frameMat);
  add(prof, fh, depth, L / 2 - prof / 2, fh / 2, frameMat);
  const sashes = L > 1.4 ? 2 : 1;
  if (sashes === 2) add(prof * 1.2, fh - 0.1, depth, 0, fh / 2, frameMat);
  const sw = (L - 2 * prof - (sashes - 1) * prof * 1.2) / sashes;
  for (let i = 0; i < sashes; i++) {
    const x = -L / 2 + prof + sw / 2 + i * (sw + prof * 1.2);
    add(sw, fh - 0.12 - prof, 0.008, x, 0.05 + (fh - 0.12 - prof) / 2 + 0.01, glassMat);
    add(0.02, 0.12, 0.03, x + (i === 0 ? sw / 2 - 0.06 : -sw / 2 + 0.06), 1.05, handleMat, depth / 2 + 0.01);
  }
  group.add(g);
}

const panelLine = new THREE.MeshPhysicalMaterial({ color: "#c9c6bf", roughness: 0.6, clippingPlanes: wallClipPlanes });

function buildDoor(o: ApartmentOpening, group: THREE.Group, open: number, style: string, hMat: THREE.Material) {
  const [ax, ay] = o.a;
  const [bx, by] = o.b;
  const L = o.width;
  const u: Vec2 = [(bx - ax) / L, (by - ay) / L];
  const rv = o.reveal!;
  // Mitte der Leibung quer zur Wand
  const cx = rv.reduce((s, p) => s + p[0], 0) / rv.length;
  const cy = rv.reduce((s, p) => s + p[1], 0) / rv.length;
  const sw = o.swing ?? 1;
  const nOpen: Vec2 = [-u[1] * sw, u[0] * sw];
  // Scharnierpunkt: Wandkopf a, auf der Aufschlagseite der Leibung
  const half = o.depth / 2;
  const midA: Vec2 = [cx + (ax - (ax + bx) / 2), cy + (ay - (ay + by) / 2)];
  const hinge: Vec2 = [midA[0] + nOpen[0] * (half - 0.02), midA[1] + nOpen[1] * (half - 0.02)];
  const leafW = L - 0.05;
  const leafT = 0.04;
  const zarge = new THREE.Group();
  const rot = -Math.atan2(u[1], u[0]);
  zarge.position.set(cx, 0, cy);
  zarge.rotation.y = rot;
  const fm = o.type === "entrance" ? frameMat : doorMat;
  const z = (w: number, h: number, d: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fm);
    m.position.set(x, y, 0);
    m.castShadow = true;
    zarge.add(m);
  };
  z(0.03, o.height, o.depth + 0.04, -L / 2 + 0.015, o.height / 2);
  z(0.03, o.height, o.depth + 0.04, L / 2 - 0.015, o.height / 2);
  z(L, 0.03, o.depth + 0.04, 0, o.height - 0.015);
  group.add(zarge);
  // Türblatt um Scharnier gedreht
  const leaf = new THREE.Group();
  leaf.position.set(hinge[0], 0, hinge[1]);
  const base = Math.atan2(u[1], u[0]);
  const ang = base + sw * open * (Math.PI / 2) * 0.98;
  leaf.rotation.y = -ang;
  const lm = new THREE.Mesh(new THREE.BoxGeometry(leafW, o.height - 0.04, leafT), o.type === "entrance" ? entranceMat : doorMat);
  lm.position.set(0.025 + leafW / 2, (o.height - 0.04) / 2 + 0.01, sw * (-leafT / 2));
  lm.castShadow = true;
  lm.receiveShadow = true;
  leaf.add(lm);
  // Türstil: Kassetten (zwei aufgesetzte Füllungen je Seite) oder horizontale Rillen
  if (o.type !== "entrance" && style !== "flat") {
    const lh = o.height - 0.04;
    for (const side of [-1, 1]) {
      const zf = sw * (-leafT / 2) + side * (leafT / 2 + 0.003);
      if (style === "panel") {
        for (const [y0, y1] of [[0.18, lh * 0.42], [lh * 0.48, lh - 0.18]]) {
          const fw = leafW - 0.24, fh = y1 - y0;
          for (const [w, h, x, y] of [[fw, 0.012, 0, y0], [fw, 0.012, 0, y1], [0.012, fh, -fw / 2, (y0 + y1) / 2], [0.012, fh, fw / 2, (y0 + y1) / 2]] as [number, number, number, number][]) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), doorMat);
            b.position.set(0.025 + leafW / 2 + x, y + 0.01, zf);
            leaf.add(b);
          }
        }
      } else if (style === "groove") {
        for (let y = 0.25; y < lh - 0.1; y += 0.25) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.06, 0.004, 0.002), panelLine);
          b.position.set(0.025 + leafW / 2, y, zf);
          leaf.add(b);
        }
      }
    }
  }
  for (const side of [-1, 1]) {
    const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.02), hMat);
    hnd.position.set(leafW - 0.08, 1.05, sw * (-leafT / 2) + side * (leafT / 2 + 0.03));
    leaf.add(hnd);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 16), hMat);
    rose.rotation.x = Math.PI / 2;
    rose.position.set(leafW - 0.04, 1.05, sw * (-leafT / 2) + side * (leafT / 2 + 0.005));
    leaf.add(rose);
  }
  group.add(leaf);
}

function buildRailing(a: Vec2, b: Vec2, group: THREE.Group) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const g = new THREE.Group();
  g.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
  g.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const top = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.06), railMat);
  top.position.y = 1.0;
  g.add(top);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(L, 0.03, 0.04), railMat);
  bottom.position.y = 0.1;
  g.add(bottom);
  const n = Math.floor(L / 0.11);
  const bar = new THREE.BoxGeometry(0.012, 0.87, 0.012);
  const inst = new THREE.InstancedMesh(bar, railMat, n + 1);
  const m = new THREE.Matrix4();
  for (let i = 0; i <= n; i++) {
    m.makeTranslation(-L / 2 + (L * i) / n, 0.55, 0);
    inst.setMatrixAt(i, m);
  }
  inst.castShadow = true;
  g.add(inst);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  group.add(g);
}

export function buildApartment(p: Project): ApartmentBuild {
  const group = new THREE.Group();
  group.name = "apartment";
  const pickables: THREE.Object3D[] = [];

  // Türblätter/Zargen und Fensterrahmen in der gewählten Ausführung
  doorMat.color.set(p.settings.doorColor ?? "#f4f3ef");
  frameMat.color.set(p.settings.windowFrameColor ?? "#3b3d40");
  // Rohbauwände (mit dunklem Schnitt beim Kappen)
  for (const w of apartment.walls) {
    const g = prism(w, -SLAB, H);
    const m = mesh(g, wallSolidMat, true, true);
    group.add(m);
    group.add(mesh(g, wallPocheMat, false, false));
  }
  // Stürze über Türen
  for (const o of apartment.openings) {
    if (!o.reveal) continue;
    const top = o.height;
    if (H - top > 0.005) {
      const g = prism(o.reveal, top, H);
      group.add(mesh(g, wallSolidMat, true, true));
      group.add(mesh(g, wallPocheMat, false, false));
    }
    if (o.type === "window") buildWindow(o, group);
    else buildDoor(o, group, p.settings.doorsOpen ?? 0, p.settings.doorStyle ?? "flat", doorHandleMat(p.settings.handleFinish ?? "blackMetal"));
  }
  // Böden und Decken je Raum
  for (const r of apartment.rooms) {
    const fin = p.rooms[r.id];
    if (!fin) continue;
    const fm = floorMaterial(fin.floor);
    const fl = mesh(flat(r.polygon, 0, fin.floor.angle ?? 0, fm.size), fm.mat, false, true);
    fl.userData.roomId = r.id;
    group.add(fl);
    pickables.push(fl);
    // Rohdecke/Platte darunter
    group.add(mesh(prism(r.polygon, -SLAB, -0.002), slabMat, false, true));
    if (!r.outdoor) {
      const cf = fin.ceilingFinish;
      let cm: THREE.Material = ceilingMaterial(fin.ceiling);
      let tile: [number, number] = [1, 1];
      if (cf && cf.kind !== "paint") {
        if (cf.kind === "concrete") cm = getMaterial({ color: cf.color ?? "#a9a6a0", material: "stone" });
        else {
          const wf = floorMaterial({ kind: (cf.kind === "woodSlats" ? "slats" : "planks") as FloorFinish["kind"], color: cf.color ?? "#c9a477", angle: 0, plankLength: 2.4, plankWidth: cf.kind === "woodSlats" ? 0.045 : 0.12 });
          cm = wf.mat;
          tile = wf.size;
        }
      }
      const c = mesh(flat(r.polygon, H, (fin.floor.angle ?? 0) + 90, tile, true), cm, false, true);
      c.name = "ceiling";
      c.userData.roomId = r.id;
      c.userData.ceiling = true;
      group.add(c);
    }
  }
  // Schwellen in Türleibungen (Bodenbelag des angrenzenden Raums)
  for (const o of apartment.openings) {
    if (!o.reveal) continue;
    const fin = p.rooms["13.01"];
    const fm = floorMaterial(fin.floor);
    group.add(mesh(flat(o.reveal, 0.001, fin.floor.angle ?? 0, fm.size), o.type === "window" ? slabMat : fm.mat, false, true));
    group.add(mesh(prism(o.reveal, -SLAB, -0.002), slabMat));
  }
  // Wandoberflächen
  for (const f of wallFaces) {
    if (f.wallRatio < 0.01) continue;
    const fin = finishFor(p, f.id, f.roomId);
    const room = apartment.rooms.find((r) => r.id === f.roomId);
    const topH = room?.outdoor ? 1.0 : H;
    for (const s of f.spans) {
      const s0 = s.t0 * f.length;
      const s1 = s.t1 * f.length;
      if (s.kind === "wall") addSkin(group, pickables, fin, f.id, f.a, f.u, f.n, s0, s1, 0, topH);
      else if (s.kind === "door") {
        const o = apartment.openings.find((x) => x.id === s.openingId);
        const top = o ? o.height : apartment.doorHeight;
        if (H - top > 0.005 && !room?.outdoor) addSkin(group, pickables, fin, f.id, f.a, f.u, f.n, s0, s1, top, H);
      } else if (s.kind === "window") {
        const o = apartment.openings.find((x) => x.id === s.openingId);
        if (o && H - o.height > 0.005 && !room?.outdoor) addSkin(group, pickables, fin, f.id, f.a, f.u, f.n, s0, s1, o.height, H);
      }
    }
    // Sockelleiste (Innenräume, Wandspannen; Höhe/Farbe je Raum, Standard 6 cm wie Wand in Dielenräumen)
    const rf = room ? p.rooms[room.id] : undefined;
    const skirt = rf?.skirting ?? (room?.floor === "parkett" ? { height: 0.06, color: "wall" } : { height: 0, color: "wall" });
    if (!room?.outdoor && skirt.height > 0.005) {
      const skm = skirt.color === "wall" ? skirtingMat(fin.base.color) : getMaterial({ color: skirt.color, material: skirt.material ?? "lacquer" });
      for (const s of f.spans) {
        if (s.kind !== "wall") continue;
        const L = (s.t1 - s.t0) * f.length;
        if (L < 0.05) continue;
        const mid = ((s.t0 + s.t1) / 2) * f.length;
        const sk = new THREE.Mesh(new THREE.BoxGeometry(L, skirt.height, 0.014), skm);
        sk.position.set(f.a[0] + f.u[0] * mid + f.n[0] * 0.009, skirt.height / 2, f.a[1] + f.u[1] * mid + f.n[1] * 0.009);
        sk.rotation.y = -Math.atan2(f.u[1], f.u[0]);
        sk.receiveShadow = true;
        group.add(sk);
      }
    }
    // Stuckprofil/Deckenleiste: gestuftes Profil über die ganze Wandlänge
    const cor = rf?.ceilingFinish?.cornice ?? 0;
    if (!room?.outdoor && cor > 0.005 && f.wallRatio > 0.01) {
      const cmat = getMaterial({ color: rf?.ceilingFinish?.corniceColor ?? rf?.ceiling ?? "#f6f4ef", material: "matte" });
      const mid = f.length / 2;
      const rotY = -Math.atan2(f.u[1], f.u[0]);
      for (const [hh, dd, yy] of [[cor, cor * 0.35, H - cor / 2], [cor * 0.55, cor * 0.75, H - cor * 0.275], [cor * 0.25, cor, H - cor * 0.125]] as [number, number, number][]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(f.length, hh, dd), cmat);
        b.position.set(f.a[0] + f.u[0] * mid + f.n[0] * (dd / 2), yy, f.a[1] + f.u[1] * mid + f.n[1] * (dd / 2));
        b.rotation.y = rotY;
        b.userData.ceiling = true;
        group.add(b);
      }
    }
  }
  // Geländer
  for (const r of apartment.railings) buildRailing(r.a, r.b, group);
  // Alles, was mit den Wänden geschnitten wird, auch automatisch kappen (Wandmodus „Auto“)
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (!mats.some((x) => x.clippingPlanes === wallClipPlanes)) return;
    mats.forEach(patchCutaway);
    cutAwareRaycast(m, () => wallClipPlanes[0].constant);
  });
  return { group, pickables };
}

const skirtCache = new Map<string, THREE.Material>();
function skirtingMat(color: string) {
  let m = skirtCache.get(color);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.4), roughness: 0.5, clippingPlanes: wallClipPlanes });
    skirtCache.set(color, m);
  }
  return m;
}
