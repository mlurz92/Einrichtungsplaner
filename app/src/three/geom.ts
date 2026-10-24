import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Geometrie-Baukasten für die prozeduralen Möbelmodelle. Alle Maße in Metern, Ursprung des Objekts
// in der Mitte der Grundfläche auf Bodenhöhe; Breite = X, Höhe = Y, Tiefe = Z, Vorderseite = +Z.

/** Weltmaßstäbliche UVs (Meter) per Box-Projektion je Fläche. */
export function worldUV(g: THREE.BufferGeometry, rotateUV = false): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  g.computeVertexNormals();
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    let u: number, v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    if (rotateUV) [u, v] = [v, u];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

export type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; shadow?: boolean };

export class Builder {
  parts: Part[] = [];
  extra: THREE.Object3D[] = [];

  add(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, shadow = true) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    const gg = geo.index ? geo.toNonIndexed() : geo.clone();
    gg.applyMatrix4(m);
    for (const k of Object.keys(gg.attributes)) if (!["position", "normal", "uv"].includes(k)) gg.deleteAttribute(k);
    if (!gg.attributes.uv) worldUV(gg);
    this.parts.push({ geo: gg, mat, shadow });
    return this;
  }

  /** Quader (Mittelpunkt x, unten y, Mitte z). */
  box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, ry = 0) {
    const g = worldUV(new THREE.BoxGeometry(Math.max(w, 1e-4), Math.max(h, 1e-4), Math.max(d, 1e-4)));
    return this.add(g, mat, x, y + h / 2, z, 0, ry, 0);
  }

  rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 3, rx = 0, ry = 0, rz = 0) {
    const rr = Math.max(0.001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
    const g = worldUV(new RoundedBoxGeometry(Math.max(w, 0.002), Math.max(h, 0.002), Math.max(d, 0.002), seg, rr));
    return this.add(g, mat, x, y + h / 2, z, rx, ry, rz);
  }

  cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 32, rx = 0, rz = 0) {
    const g = worldUV(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1));
    return this.add(g, mat, x, y + h / 2, z, rx, 0, rz);
  }

  sphere(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 32, sy = 1) {
    const g = worldUV(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)));
    if (sy !== 1) g.scale(1, sy, 1);
    return this.add(g, mat, x, y, z);
  }

  lathe(points: [number, number][], mat: THREE.Material, x = 0, y = 0, z = 0, seg = 40) {
    const g = worldUV(new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), seg));
    return this.add(g, mat, x, y, z);
  }

  torus(R: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0, rx = Math.PI / 2, arc = Math.PI * 2) {
    const g = worldUV(new THREE.TorusGeometry(R, r, 12, 48, arc));
    return this.add(g, mat, x, y, z, rx, 0, 0);
  }

  /** Extrudierter 2D-Umriss (in XZ-Ebene), Höhe h ab y. */
  extrudeXZ(shape: THREE.Shape, h: number, mat: THREE.Material, y = 0, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 32 });
    // Shape (sx, sy) → (x = sx, z = sy); Extrusion nach oben von y bis y + h
    g.rotateX(Math.PI / 2);
    g.translate(0, y + h, 0);
    worldUV(g);
    return this.add(g, mat, 0, 0, 0);
  }

  /** Extrusion in Z (Profil in XY), Tiefe d um z zentriert. */
  extrudeXY(shape: THREE.Shape, d: number, mat: THREE.Material, z = 0, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 24 });
    g.translate(0, 0, z - d / 2);
    worldUV(g);
    return this.add(g, mat, 0, 0, 0);
  }

  /** Polsterkissen mit weicher Wölbung. */
  cushion(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, puff = 0.25, rx = 0, ry = 0) {
    const r = Math.min(h, w, d) * 0.45;
    const g = new RoundedBoxGeometry(w, h, d, 4, Math.max(0.004, r));
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const fx = 1 - Math.pow((2 * px) / w, 2);
      const fz = 1 - Math.pow((2 * pz) / d, 2);
      const bulge = Math.max(0, fx) * Math.max(0, fz) * puff * h;
      pos.setY(i, py + Math.sign(py) * bulge * 0.5);
    }
    g.computeVertexNormals();
    worldUV(g);
    return this.add(g, mat, x, y + h / 2, z, rx, ry, 0);
  }

  legs(positions: [number, number][], h: number, r: number, mat: THREE.Material, taper = 0.8, y = 0) {
    for (const [x, z] of positions) this.cyl(r * taper, r, h, mat, x, y, z, 16);
    return this;
  }

  /** Schräge Strebe (Rundrohr bzw. Vierkant) zwischen zwei Punkten. */
  strut(a: [number, number, number], e: [number, number, number], s: number, mat: THREE.Material, square = false, taper = 1) {
    const A = new THREE.Vector3(...a), E = new THREE.Vector3(...e);
    const dir = E.clone().sub(A);
    const len = dir.length();
    const g = square ? new THREE.BoxGeometry(s, len, s) : new THREE.CylinderGeometry((s / 2) * taper, s / 2, len, 16, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    const m = A.clone().add(E).multiplyScalar(0.5);
    return this.add(worldUV(g), mat, m.x, m.y, m.z);
  }

  legsSquare(positions: [number, number][], h: number, s: number, mat: THREE.Material, y = 0) {
    for (const [x, z] of positions) this.box(s, h, s, mat, x, y, z);
    return this;
  }

  object(o: THREE.Object3D) {
    this.extra.push(o);
    return this;
  }

  /** Zusammenführen nach Material → wenige Draw Calls je Objekt. */
  build(): THREE.Group {
    const group = new THREE.Group();
    const byMat = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; shadow: boolean }>();
    for (const p of this.parts) {
      const e = byMat.get(p.mat) ?? { geos: [], shadow: false };
      e.geos.push(p.geo);
      e.shadow = e.shadow || (p.shadow ?? true);
      byMat.set(p.mat, e);
    }
    for (const [mat, { geos, shadow }] of byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      const transparent = (mat as THREE.MeshPhysicalMaterial).transmission > 0 || mat.transparent;
      mesh.castShadow = shadow && !transparent;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const o of this.extra) group.add(o);
    return group;
  }
}

/** Abgerundetes Rechteck (für Tischplatten etc.) als Shape in XZ. */
export function roundRectShape(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  const rr = Math.min(r, w / 2, d / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + d - rr);
  s.quadraticCurveTo(x + w, y + d, x + w - rr, y + d);
  s.lineTo(x + rr, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

export function ellipseShape(w: number, d: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(0, 0, w / 2, d / 2, 0, Math.PI * 2, false, 0);
  return s;
}

/** Organische Form (Kiesel) – für Couchtische/Teppiche "organisch". */
export function organicShape(w: number, d: number, seed = 1): THREE.Shape {
  const s = new THREE.Shape();
  const n = 9;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.08 * Math.sin(a * 2 + seed) + 0.05 * Math.cos(a * 3 + seed * 2);
    pts.push(new THREE.Vector2(Math.cos(a) * (w / 2) * k * 0.97, Math.sin(a) * (d / 2) * k * 0.97));
  }
  const curve = new THREE.SplineCurve([...pts, pts[0]]);
  const ps = curve.getPoints(64);
  s.setFromPoints(ps);
  return s;
}
