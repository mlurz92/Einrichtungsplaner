import * as THREE from "three";
import { BLACK, OAK, bool, num, str, type Ctx } from "./common";
import { ellipseShape, organicShape, roundRectShape } from "../geom";

const topMat = (c: Ctx) => c.m("top", c.slots.main ?? OAK);
const baseMat = (c: Ctx) => c.m("legs", c.slots.main ?? BLACK);

type V3 = [number, number, number];

/** Ebenes Blechdreieck als dünnes Prisma (flache Normalen → sichtbare Kantung zwischen zwei Dreiecken). */
function plateTri(b: Ctx["b"], p: [V3, V3, V3], th: number, mat: THREE.Material) {
  const [a, c, e] = p.map((q) => new THREE.Vector3(...q));
  const n = c.clone().sub(a).cross(e.clone().sub(a)).normalize().multiplyScalar(th / 2);
  const up = [a, c, e].map((v) => v.clone().add(n));
  const dn = [a, c, e].map((v) => v.clone().sub(n));
  const tris: THREE.Vector3[] = [up[0], up[1], up[2], dn[0], dn[2], dn[1]];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    tris.push(dn[i], dn[j], up[j], dn[i], up[j], up[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tris.flatMap((v) => [v.x, v.y, v.z]), 3));
  b.add(g, mat);
}

/**
 * Gekanteter V-Mittelfuß (DELIFE Edge): zwei verwundene Stahlbleche, je mit der Standkante quer an einem Tischende
 * und der Oberkante diagonal unter der Tischmitte; in der Seitenansicht überkreuzen sie sich (X), stirnseitig trapezförmig
 * (50 cm unten, ca. 31 cm oben). Darüber flacher Rahmen mit Mittelplatte (2 cm), Platte 1 cm.
 */
function edgeBase(c: Ctx, y0: number, L: THREE.Material) {
  const { w, d, b } = c;
  const fx = w * 0.4, fz = d * 0.25, tx = w * 0.14, tz = d * 0.155, yb = y0 - 0.02, th = 0.008;
  for (const sx of [-1, 1]) {
    // Standkante quer am Tischende, Oberkante diagonal: hinten auf der eigenen Seite, vorn auf der Gegenseite
    const A: V3 = [sx * fx, 0, -fz], B: V3 = [sx * fx, 0, fz];
    const C: V3 = [-sx * tx, yb, tz], D: V3 = [sx * tx, yb, -tz];
    // Kantung von der vorderen Standecke zur hinteren Oberecke
    plateTri(b, [A, B, D], th, L);
    plateTri(b, [B, C, D], th, L);
  }
  // Rahmen unter der Platte: Längs-/Querzargen 30 × 20 mm, Mittelplatte über den Blechoberkanten
  const rx = w / 2 - 0.07, rz = d * 0.31;
  for (const sz of [-1, 1]) b.box(2 * rx, 0.02, 0.03, L, 0, yb, sz * rz);
  for (const sx of [-1, 1]) b.box(0.03, 0.02, 2 * rz, L, sx * rx, yb, 0);
  b.box(w * 0.32, 0.008, 2 * rz, L, 0, yb, 0);
}

/** Baumkante (Live-Edge): Längskanten leicht gewellt, Stirnseiten gerade gesägt. */
function liveEdgeShape(w: number, d: number, seed: number): THREE.Shape {
  const n = 40;
  const wob = (t: number, k: number) => 0.012 * Math.sin(t * 7.3 + seed * k) + 0.007 * Math.sin(t * 17.1 + seed * 2.1 * k) + 0.004 * Math.sin(t * 31 + k);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const taper = Math.sin(Math.PI * t) ** 0.35;
    pts.push(new THREE.Vector2(-w / 2 + w * t, -d / 2 - 0.004 + (wob(t, 1) - 0.012) * taper));
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const taper = Math.sin(Math.PI * t) ** 0.35;
    pts.push(new THREE.Vector2(-w / 2 + w * t, d / 2 + 0.004 - (wob(t, 2) - 0.012) * taper));
  }
  return new THREE.Shape(pts);
}

/**
 * DELIFE-Gestelle unter Esstischen (Maße lt. Datenblatt „Maße Gestell“, frameW/frameD in m):
 * uframe (Kufe breit/schmal), slant (Kufe schräg, unten breiter), spider (Beinpaare aus zwei Knoten diagonal zu den Ecken),
 * glass (Glaswangen), pillars (Säulen), cone (Doppelkonus), ribbon (gebogenes Band: w, infinity, wave, origami).
 */
function delifeBase(c: Ctx, style: string, y0: number, L: THREE.Material) {
  const { w, d, p, b } = c;
  const over = num(p, "overhang", 0.2);
  const fw = num(p, "frameW", 0.075), fd = num(p, "frameD", Math.min(d - 0.3, 0.64));
  const s = num(p, "bar", style === "slant" || style === "uframe" ? 0.04 : 0.06);
  const ex = w / 2 - over - fw / 2;
  if (style === "uframe" || style === "slant") {
    const spread = style === "slant" ? num(p, "slant", 0.08) : 0;
    for (const sx of [-1, 1]) {
      // Rahmen in der Querebene, bei „schräg“ unten weiter außen (in Längsrichtung geneigt)
      const xt = sx * ex, xb = sx * (ex + spread);
      const zt = fd / 2, ztop = y0 - s / 2, ybot = s / 2;
      const corners: [number, number, number][] = [[xb, ybot, -zt], [xb, ybot, zt], [xt, ztop, zt], [xt, ztop, -zt]];
      for (let i = 0; i < 4; i++) {
        const a = corners[i], e = corners[(i + 1) % 4];
        const A = new THREE.Vector3(...a), E = new THREE.Vector3(...e);
        const len = A.distanceTo(E);
        const g = new THREE.BoxGeometry(fw, len + s, s);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), E.clone().sub(A).normalize()));
        const m = A.clone().add(E).multiplyScalar(0.5);
        b.add(g, L, m.x, m.y, m.z);
      }
    }
    return;
  }
  if (style === "spider") {
    // Mittelträger unter der Platte, an beiden Enden je zwei Beine diagonal zu den Ecken (Draufsicht X)
    const hx = num(p, "hubX", 0.18), gx = num(p, "frameW", 1.4) / 2, gz = num(p, "frameD", 0.75) / 2;
    const sq = str(p, "bar", "flat") !== "round";
    const sz = num(p, "legSize", 0.05);
    b.box(2 * hx + 0.1, 0.05, 0.08, L, 0, y0 - 0.05, 0);
    for (const sx of [-1, 1]) for (const zz of [-1, 1]) b.strut([sx * hx, y0 - 0.03, zz * 0.03], [sx * gx, 0, zz * gz], sz, L, sq, sq ? 1 : 0.7);
    return;
  }
  if (style === "glass") {
    const G = c.m("legs", { color: "#e8eef0", material: "glass" });
    for (const sx of [-1, 1]) b.box(0.02, y0, fd, G, sx * (w / 2 - over), 0, 0);
    return;
  }
  if (style === "pillars") {
    const n = Math.max(1, Math.round(num(p, "pillars", w > 2.2 ? 3 : 2)));
    const r = num(p, "pillarD", 0.3) / 2;
    const span = n > 1 ? w - 2 * over - 2 * r : 0;
    for (let i = 0; i < n; i++) b.cyl(r, r, y0, L, n > 1 ? -span / 2 + (span * i) / (n - 1) : 0, 0, 0, 40);
    return;
  }
  if (style === "cone") {
    // Zwei Konen mit gemeinsamer Spitze, elliptisch gestreckt (Cono)
    const gw = num(p, "frameW", 0.77), gd = num(p, "frameD", 0.57);
    const g = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.16, 0.5), new THREE.Vector2(0.5, 1), new THREE.Vector2(0, 1)], 48);
    g.scale(gw, y0, gd);
    b.add(g, L, 0, 0, 0);
    return;
  }
  if (style === "ribbon") {
    // Gebogenes Stahlband (Querschnitt Länge × Höhe), Breite = Gestelltiefe
    const kind = str(p, "ribbon", "w");
    const gw = num(p, "frameW", 1.2) / 2, gd = num(p, "frameD", 0.5), th = 0.012;
    const pts: THREE.Vector2[] = [];
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let x: number, y: number;
      if (kind === "infinity") {
        // Lemniskate (∞) in der Seitenansicht: Band läuft zweimal über den Boden und unter die Platte
        const a = t * Math.PI * 2, q = 1 + Math.sin(a) ** 2;
        x = (gw * Math.cos(a)) / q;
        y = y0 / 2 + ((y0 / 2 - 0.006) * Math.sin(a) * Math.cos(a)) / q / 0.3536;
      } else if (kind === "wave") {
        x = gw * 0.25 * Math.sin(t * Math.PI * 3);
        y = t * y0;
      } else if (kind === "origami") {
        const k = t * 4;
        x = -gw + (2 * gw * t);
        y = (Math.floor(k) % 2 === 0 ? k % 1 : 1 - (k % 1)) * y0;
      } else {
        // W: von der Platte nach unten, Mitte wieder hoch
        x = -gw + 2 * gw * t;
        y = y0 * (0.5 + 0.5 * Math.cos(t * Math.PI * 4));
      }
      pts.push(new THREE.Vector2(x, Math.max(th / 2, Math.min(y0 - th / 2, y))));
    }
    const path = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q.x, q.y, 0)));
    const frames = path.getSpacedPoints(160);
    for (let i = 0; i < frames.length - 1; i++) {
      const A = frames[i], E = frames[i + 1];
      const len = A.distanceTo(E);
      const g = new THREE.BoxGeometry(len + 0.002, th, gd);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), E.clone().sub(A).normalize()));
      const m = A.clone().add(E).multiplyScalar(0.5);
      b.add(g, L, m.x, m.y, m.z);
    }
    if (kind === "wave") b.box(gw * 1.1, 0.012, gd * 1.4, L, 0, 0, 0);
    return;
  }
}

/** Bootsform: Längsseiten nach außen gewölbt (Mitte volle Tiefe, Enden 78 %), Stirnseiten gerade mit gerundeten Ecken. */
function boatShape(w: number, d: number): THREE.Shape {
  const s = new THREE.Shape();
  const e = d * 0.39, r = Math.min(0.04, d * 0.05);
  s.moveTo(-w / 2, -e + r);
  s.quadraticCurveTo(-w / 2, -e, -w / 2 + r, -e - r * 0.15);
  s.quadraticCurveTo(0, -d / 2 - (d / 2 - e) * 1.0, w / 2 - r, -e - r * 0.15);
  s.quadraticCurveTo(w / 2, -e, w / 2, -e + r);
  s.lineTo(w / 2, e - r);
  s.quadraticCurveTo(w / 2, e, w / 2 - r, e + r * 0.15);
  s.quadraticCurveTo(0, d / 2 + (d / 2 - e) * 1.0, -w / 2 + r, e + r * 0.15);
  s.quadraticCurveTo(-w / 2, e, -w / 2, e - r);
  s.closePath();
  return s;
}

function rectTopShape(c: Ctx, w: number, d: number): THREE.Shape {
  const shape = str(c.p, "shape", "rect");
  if (bool(c.p, "liveEdge")) return liveEdgeShape(w, d, c.seed % 97);
  if (shape === "oval" || shape === "round") return ellipseShape(w, d);
  if (shape === "boat") return boatShape(w, d);
  return roundRectShape(w, d, num(c.p, "radius", 0.01));
}

/** Rechteck-, Oval-, Rund- oder Bootsplatte (shape) auf Beinen bzw. DELIFE-/Edge-Gestell (legStyle). */
export function tableRect(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = num(p, "top", h < 0.5 ? 0.04 : 0.035);
  b.extrudeXZ(rectTopShape(c, w, d), t, T, h - t, 0.002);
  const leg = num(p, "leg", h < 0.5 ? 0.035 : 0.045);
  const inset = num(p, "inset", 0.06);
  const lx = w / 2 - inset, lz = d / 2 - inset;
  const style = str(p, "legStyle", "round");
  const y0 = h - t;
  if (style === "edge") {
    edgeBase(c, y0, L);
    return;
  }
  if (["uframe", "slant", "spider", "glass", "pillars", "cone", "ribbon"].includes(style)) {
    delifeBase(c, style, y0, L);
    return;
  }
  if (str(p, "base", "legs") === "panel") {
    for (const sx of [-1, 1]) b.box(0.05, h - t, d * 0.8, L, sx * (w / 2 - 0.15), 0, 0);
  } else if (style === "xframe") {
    // Kufen-/X-Gestell (bert plantagie Aiven): je Ende zwei Beinpaare, die vom Scheitel unter der Platte zu beiden Seiten
    // in Längsrichtung auslaufen, Querstange zwischen den Scheiteln
    const ax = w / 2 - inset, z = d / 2 - 0.12, spread = 0.26;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.strut([sx * ax, y0, sz * (z - 0.02)], [sx * (ax + spread), 0, sz * z], leg, L, true);
        b.strut([sx * ax, y0, sz * (z - 0.02)], [sx * (ax - spread), 0, sz * z], leg, L, true);
      }
      b.box(leg, leg, 2 * z - 0.04, L, sx * ax, y0 - leg, 0);
    }
    b.box(2 * ax, leg, leg, L, 0, y0 - leg * 1.2, 0);
  } else if (style === "cross") {
    // Gekreuzte Schrägbeine (connubia Master): je Ende und Seite zwei Beine, die sich in der Seitenansicht überkreuzen
    const ax = w / 2 - inset, z = d / 2 - 0.16, s2 = 0.2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.strut([sx * (ax - s2), y0, sz * (z - 0.06)], [sx * (ax + s2 * 0.6), 0, sz * z], leg, L, false, 0.8);
        b.strut([sx * (ax + s2 * 0.5), y0, sz * (z - 0.1)], [sx * (ax - s2 * 1.1), 0, sz * (z + 0.04)], leg, L, false, 0.8);
      }
    }
  } else if (num(p, "splay", 0) > 0) {
    // Leicht schräg ausgestellte, konische Beine (Mobitec Terra)
    const sp = num(p, "splay", 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.strut([sx * (lx - sp), y0, sz * (lz - sp * 0.6)], [sx * lx, 0, sz * lz], leg, L, false, 0.6);
  } else if (style === "square") {
    b.legsSquare([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], h - t, leg, L);
  } else {
    b.legs([[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]], h - t, leg / 2, L, 0.75);
  }
  if (h > 0.6 && !bool(p, "noApron")) {
    b.box(w - 2 * inset, 0.07, 0.02, L, 0, h - t - 0.07, -lz);
    b.box(w - 2 * inset, 0.07, 0.02, L, 0, h - t - 0.07, lz);
  }
}

export function tableRound(c: Ctx) {
  const { w, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const r = w / 2;
  const t = num(p, "top", 0.035);
  b.cyl(r, r, t, T, 0, h - t, 0, 64);
  const lr = r * 0.62;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.cyl(0.018, 0.024, h - t, L, Math.cos(a) * lr, 0, Math.sin(a) * lr, 16);
  }
}

export function tableOval(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = num(p, "top", h < 0.5 ? 0.05 : 0.035);
  const shape = bool(p, "organic") ? organicShape(w, d, 3) : ellipseShape(w, d);
  b.extrudeXZ(shape, t, T, h - t, 0.003);
  if (h < 0.5) {
    // Couchtisch: geschlossener Sockel
    b.extrudeXZ(bool(p, "organic") ? organicShape(w * 0.72, d * 0.66, 5) : ellipseShape(w * 0.7, d * 0.62), h - t, L, 0);
  } else {
    for (const sx of [-1, 1]) b.cyl(0.05, 0.08, h - t, L, sx * w * 0.28, 0, 0, 24);
  }
}

/** Säulen-/Konusfuß (Abby, Noam, Sculpt, Hiray). */
export function tablePedestal(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = num(p, "top", 0.03);
  const round = bool(p, "round", Math.abs(w - d) < 0.01);
  if (round) b.cyl(w / 2, w / 2, t, T, 0, h - t, 0, 72);
  else b.extrudeXZ(ellipseShape(w, d), t, T, h - t);
  const foot = num(p, "footD", Math.min(w, d) * 0.5) / 2;
  const base = str(p, "base", "column");
  if (base === "cone") {
    b.lathe([[0, 0], [foot, 0], [foot, 0.02], [0.07, h * 0.55], [0.09, h - t], [0, h - t]], L);
  } else {
    b.lathe([[0, 0], [foot, 0], [foot * 0.98, 0.04], [foot * 0.62, 0.12], [foot * 0.55, h - t - 0.08], [foot * 0.7, h - t], [0, h - t]], L);
  }
}

/** Couchtisch-Duo (zwei Steinblöcke unterschiedlicher Höhe). */
export function coffeeDuo(c: Ctx) {
  const { p, b } = c;
  const M = c.m("main");
  const parts = [
    { w: num(p, "a_w", 0.8), d: num(p, "a_d", 0.7), h: num(p, "a_h", 0.35), x: num(p, "a_x", -0.3), z: num(p, "a_y", 0), r: num(p, "a_rot", 0) },
    { w: num(p, "b_w", 0.7), d: num(p, "b_d", 0.53), h: num(p, "b_h", 0.23), x: num(p, "b_x", 0.3), z: num(p, "b_y", 0), r: num(p, "b_rot", 0) },
  ];
  for (const q of parts) {
    const s = roundRectShape(q.w, q.d, Math.min(q.w, q.d) * 0.22);
    const g = new THREE.ExtrudeGeometry(s, { depth: q.h - 0.01, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 24 });
    g.rotateX(Math.PI / 2);
    g.translate(0, q.h - 0.008, 0);
    g.rotateY((-q.r * Math.PI) / 180);
    b.add(g, M, q.x, 0, -q.z);
  }
}

/** Monolithischer Couchtisch (Distinct, Marisa): Block mit Sockel bzw. zweistufig. */
export function coffeeBlock(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = c.m("main");
  const t = 0.06;
  b.extrudeXZ(roundRectShape(w, d, 0.04), t, M, h - t, 0.004);
  if (bool(p, "twoLevel")) {
    b.extrudeXZ(roundRectShape(w * 0.48, d, 0.04), h - t, M, 0, 0);
    b.extrudeXZ(roundRectShape(w * 0.46, d * 0.9, 0.04), h * 0.6, M, 0, 0);
    b.box(w * 0.5, 0.05, d * 0.9, M, w * 0.24, h * 0.6 - 0.05, 0);
  } else {
    b.extrudeXZ(roundRectShape(w * 0.62, d * 0.62, 0.05), h - t, M, 0, 0);
  }
}

export function coffeeRound(c: Ctx) {
  const { w, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = num(p, "top", 0.04);
  b.cyl(w / 2, w / 2, t, T, 0, h - t, 0, 64);
  if (str(p, "base", "drum") === "drum") b.cyl(w * 0.38, w * 0.38, h - t, L, 0, 0, 0, 48);
  else {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.cyl(0.02, 0.025, h - t, L, Math.cos(a) * w * 0.33, 0, Math.sin(a) * w * 0.33, 16);
    }
  }
}

export function sideRound(c: Ctx) {
  const { w, h, p, b } = c;
  const M = c.m("main");
  const style = str(p, "style", "column");
  if (style === "drum") {
    b.lathe([[0, 0], [w / 2 - 0.01, 0], [w / 2, 0.02], [w / 2, h - 0.02], [w / 2 - 0.01, h], [0, h]], M);
  } else if (style === "tray") {
    b.cyl(w / 2, w / 2, 0.03, M, 0, h - 0.03, 0, 48);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.cyl(0.008, 0.008, h - 0.03, c.m("legs", BLACK), Math.cos(a) * w * 0.4, 0, Math.sin(a) * w * 0.4, 8);
    }
  } else {
    // Säule mit Platte (Travertin)
    b.cyl(w / 2, w / 2, 0.04, M, 0, h - 0.04, 0, 48);
    b.cyl(w * 0.3, w * 0.34, h - 0.04, M, 0, 0, 0, 40);
  }
}

/** Componibili-Container (gestapelte Zylinder mit Griffloch). */
export function sideContainer(c: Ctx) {
  const { w, h, p, b } = c;
  const M = c.m("main");
  const tiers = Math.max(1, Math.round(num(p, "tiers", 2)));
  const th = (h - 0.02) / tiers;
  for (let i = 0; i < tiers; i++) {
    b.cyl(w / 2, w / 2, th - 0.004, M, 0, 0.01 + i * th, 0, 48);
    b.cyl(w / 2 + 0.001, w / 2 + 0.001, 0.004, c.m("detail", { color: "#202020", material: "plastic" }), 0, 0.01 + (i + 1) * th - 0.004, 0, 48);
  }
  b.cyl(w / 2 - 0.01, w / 2 - 0.01, 0.02, M, 0, h - 0.02, 0, 48);
}

export function desk(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = topMat(c);
  const L = baseMat(c);
  const t = 0.025;
  b.extrudeXZ(roundRectShape(w, d, 0.02), t, T, h - t, 0.002);
  if (str(p, "style", "") === "marte") {
    for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]] as [number, number][]) b.cyl(0.016, 0.025, h - t, L, x, 0, z, 16);
    b.box(w - 0.16, 0.08, d - 0.14, T, 0, h - t - 0.08, -0.01);
  } else {
    b.legs([[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]], h - t, 0.018, L, 1);
  }
}

/** Sitz-/Steh-Schreibtisch mit T-Füßen. */
export function deskStanding(c: Ctx) {
  const { w, d, h, b } = c;
  const T = topMat(c);
  const L = c.m("legs", BLACK);
  const t = 0.025;
  b.extrudeXZ(roundRectShape(w, d, 0.015), t, T, h - t, 0.002);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.12);
    b.box(0.07, 0.03, d - 0.06, L, x, 0, 0);
    b.box(0.06, h - t - 0.03, 0.06, L, x, 0.03, -0.05);
    b.box(0.05, 0.03, d - 0.12, L, x, h - t - 0.03, 0);
  }
  b.box(w - 0.3, 0.04, 0.04, L, 0, h - t - 0.05, -0.05);
}

/** Konsole: "chandler" (Holzgestell mit Steinplatte), "noam" (Metallbeine), Standard. */
export function console_(c: Ctx) {
  const { w, d, h, p, b } = c;
  const T = c.m("top", c.slots.main);
  const M = c.m("main");
  const style = str(p, "style", "chandler");
  const t = 0.035;
  b.extrudeXZ(roundRectShape(w, d, 0.01), t, T, h - t, 0.002);
  if (style === "noam") {
    for (const sx of [-1, 1]) {
      b.cyl(0.015, 0.015, h - t, M, sx * (w / 2 - 0.06), 0, d / 2 - 0.06, 16);
      b.cyl(0.015, 0.015, h - t, M, sx * (w / 2 - 0.06), 0, -d / 2 + 0.06, 16);
    }
    b.box(w - 0.12, 0.02, 0.02, M, 0, 0.12, -d / 2 + 0.06);
  } else {
    for (const sx of [-1, 1]) b.box(0.06, h - t, d - 0.02, M, sx * (w / 2 - 0.04), 0, 0);
    b.box(w - 0.14, 0.03, d - 0.06, M, 0, 0.12, 0);
    b.box(w - 0.14, 0.08, 0.03, M, 0, h - t - 0.08, -d / 2 + 0.03);
  }
}
