import * as THREE from "three";
import { BLACK, CHROME, OPAL, num, polyTube, str, type Ctx } from "./common";
import { getMaterial } from "../materials";

/** Unsichtbarer Marker für Lichtquellen (Abendmodus). */
export function lightMarker(x: number, y: number, z: number, lumen = 800, kind: "point" | "down" = "point"): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.userData.light = { lumen, kind };
  return o;
}

const metal = (c: Ctx) => c.m("main", CHROME);
const shadeM = (c: Ctx) => c.m("shade", OPAL);

/** Kabel von der Decke (Pendel). Höhe bis Decke wird über params.ceilingGap gesetzt. */
function cord(c: Ctx, x: number, z: number, y0: number, len: number) {
  if (len <= 0.02) return;
  c.b.cyl(0.003, 0.003, len, getMaterial({ color: "#1d1d1d", material: "plastic" }), x, y0, z, 6);
  c.b.cyl(0.04, 0.045, 0.02, getMaterial(c.slots.frame ?? { color: "#f2f1ed", material: "matte" }), x, y0 + len - 0.02, z, 24);
}

export function lampFloorShade(c: Ctx) {
  const { w, h, p, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  const shape = str(p, "shape", "drum");
  const r = w / 2;
  b.cyl(0.13, 0.14, 0.025, M, 0, 0, 0, 32);
  if (shape === "mushroom") {
    b.cyl(0.012, 0.012, h - r * 0.55, M, 0, 0.025, 0, 12);
    b.lathe([[0, 0], [r, 0], [r * 0.98, r * 0.12], [r * 0.85, r * 0.38], [r * 0.55, r * 0.55], [0, r * 0.6]], S, 0, h - r * 0.6, 0, 48);
    b.object(lightMarker(0, h - r * 0.35, 0, 1500));
  } else if (shape === "cone") {
    // Gubi Multi-Lite (zwei drehbare Halbschalen)
    b.cyl(0.01, 0.01, h - 0.3, M, 0, 0.025, 0, 12);
    b.sphere(r * 0.7, M, 0, h - r * 0.7, 0, 32, 0.95);
    b.object(lightMarker(0, h - r * 0.9, 0.05, 900));
  } else {
    b.cyl(0.012, 0.012, h - 0.25, M, 0, 0.025, 0, 12);
    b.cyl(r * 0.85, r, 0.28, S, 0, h - 0.28, 0, 40);
    b.object(lightMarker(0, h - 0.15, 0, 1200));
  }
}

export function lampFloorGlobe(c: Ctx) {
  const { w, h, p, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  const g = num(p, "globe", 0.2) / 2;
  b.cyl(w / 2, w / 2, 0.012, M, 0, 0, 0, 40);
  b.cyl(0.006, 0.006, h - 2 * g, M, 0, 0.012, 0, 10);
  b.torus(g * 0.45, 0.006, M, 0, h - 2 * g + 0.01, 0);
  b.sphere(g, S, 0, h - g, 0, 40);
  b.object(lightMarker(0, h - g, 0, 1000));
}

export function lampFloorArc(c: Ctx) {
  const { w, d, h, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  b.box(0.3, 0.06, 0.3, getMaterial({ color: "#e7e2d8", material: "marble" }), 0, 0, -d / 2 + 0.2);
  const pts = [new THREE.Vector3(0, 0.06, -d / 2 + 0.2), new THREE.Vector3(0, h * 0.7, -d / 2 + 0.25), new THREE.Vector3(0, h, 0), new THREE.Vector3(0, h * 0.92, d / 2 - 0.2)];
  const curve = new THREE.CatmullRomCurve3(pts);
  const tg = new THREE.TubeGeometry(curve, 40, 0.012, 8, false);
  b.add(tg, M);
  b.lathe([[0.02, 0.18], [Math.max(0.12, w / 2 - 0.05), 0], [Math.max(0.13, w / 2 - 0.04), -0.005], [0.02, 0.17]], S, 0, h * 0.92 - 0.2, d / 2 - 0.2, 40);
  b.object(lightMarker(0, h * 0.92 - 0.25, d / 2 - 0.2, 1500));
}

export function lampFloorTripod(c: Ctx) {
  const { w, h, b } = c;
  const M = c.m("legs", { color: "#6b4a33", material: "walnut" });
  const S = shadeM(c);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const top = new THREE.Vector3(0, h - 0.3, 0);
    const foot = new THREE.Vector3(Math.cos(a) * w * 0.4, 0, Math.sin(a) * w * 0.4);
    b.object(polyTube([foot, top], 0.012, M));
  }
  b.cyl(w * 0.42, w * 0.5, 0.32, S, 0, h - 0.32, 0, 40);
  b.object(lightMarker(0, h - 0.2, 0, 1200));
}

export function lampTableMushroom(c: Ctx) {
  const { w, h, p, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  const r = w / 2;
  const shape = str(p, "shape", "kian");
  if (shape === "flowerpot") {
    b.lathe([[0, 0], [r * 0.95, 0], [r * 0.9, h * 0.08], [0.012, h * 0.48], [0, h * 0.5]], M);
    b.lathe([[0, h * 0.5], [r * 0.9, h * 0.62], [r, h * 0.78], [r * 0.6, h * 0.98], [0, h]], S);
    b.object(lightMarker(0, h * 0.62, 0, 400));
  } else if (shape === "panthella") {
    b.lathe([[0, 0], [r * 0.7, 0], [r * 0.3, h * 0.2], [0.012, h * 0.62], [0, h * 0.62]], M);
    b.lathe([[0, h], [r * 0.5, h * 0.97], [r, h * 0.64], [r * 0.98, h * 0.6], [0.02, h * 0.96]], S);
    b.object(lightMarker(0, h * 0.7, 0, 400));
  } else if (shape === "cone") {
    b.cyl(r * 0.6, r * 0.6, 0.015, M, 0, 0, 0, 24);
    b.cyl(0.006, 0.006, h * 0.6, M, 0, 0, 0, 8);
    b.sphere(r * 0.8, S, 0, h * 0.72, 0, 24, 0.9);
    b.object(lightMarker(0, h * 0.72, 0, 400));
  } else {
    // Kian: kupferfarbener Fuß, Glas-Pilzkopf
    b.lathe([[0, 0], [r * 0.45, 0], [r * 0.42, 0.015], [0.03, h * 0.35], [0.03, h * 0.55], [0, h * 0.55]], M);
    b.lathe([[0, h * 0.5], [r, h * 0.62], [r * 0.95, h * 0.78], [r * 0.6, h * 0.95], [0, h]], S);
    b.object(lightMarker(0, h * 0.65, 0, 450));
  }
}

export function lampTableGlobe(c: Ctx) {
  const { w, h, p, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  const g = num(p, "globe", Math.min(0.25, w)) / 2;
  b.cyl(Math.max(0.07, w / 2 * 0.8), Math.max(0.07, w / 2 * 0.8), 0.012, M, 0, 0, 0, 32);
  b.cyl(0.005, 0.005, h - 2 * g, M, 0, 0.012, 0, 8);
  b.torus(g * 0.45, 0.005, M, 0, h - 2 * g + 0.008, 0);
  b.sphere(g, S, 0, h - g, 0, 32);
  b.object(lightMarker(0, h - g, 0, 450));
}

export function lampTableShade(c: Ctx) {
  const { w, h, p, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  if (str(p, "shape", "") === "bestlite") {
    b.cyl(0.075, 0.075, 0.02, M, 0, 0, 0, 24);
    b.cyl(0.006, 0.006, h * 0.55, c.m("detail", { color: "#c9a55c", material: "brass" }), 0, 0.02, 0, 8);
    b.object(polyTube([new THREE.Vector3(0, h * 0.55, 0), new THREE.Vector3(0, h * 0.8, 0.14)], 0.006, c.m("detail", { color: "#c9a55c", material: "brass" })));
    b.lathe([[0.02, 0.02], [0.08, -0.08], [0.081, -0.085], [0.02, 0.015]], S, 0, h * 0.82, 0.16, 24);
    b.object(lightMarker(0, h * 0.75, 0.18, 500));
    return;
  }
  b.lathe([[0, 0], [w * 0.3, 0], [w * 0.28, 0.02], [w * 0.12, h * 0.25], [0.012, h * 0.62], [0, h * 0.62]], M);
  b.cyl(w * 0.4, w / 2, h * 0.4, S, 0, h * 0.6, 0, 32);
  b.object(lightMarker(0, h * 0.75, 0, 500));
}

/** PH 3½-2½: drei gestaffelte Schirme. */
export function lampTableLayered(c: Ctx) {
  const { w, h, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  const r = w / 2;
  b.cyl(0.09, 0.1, 0.02, M, 0, 0, 0, 32);
  b.cyl(0.007, 0.007, h * 0.7, M, 0, 0.02, 0, 8);
  b.lathe([[r * 0.25, 0.09], [r, 0.0], [r * 0.98, -0.01], [r * 0.24, 0.08]], S, 0, h * 0.72, 0, 40);
  b.lathe([[r * 0.18, 0.05], [r * 0.68, -0.03], [r * 0.67, -0.04], [r * 0.17, 0.04]], S, 0, h * 0.68, 0, 40);
  b.lathe([[r * 0.1, 0.02], [r * 0.4, -0.05], [r * 0.39, -0.06], [r * 0.09, 0.01]], S, 0, h * 0.64, 0, 40);
  b.object(lightMarker(0, h * 0.7, 0, 500));
}

export function pendantGlobe(c: Ctx) {
  const { w, h, p, b } = c;
  const S = shadeM(c);
  const gap = num(p, "ceilingGap", 0);
  const shape = str(p, "shape", "globe");
  const r = w / 2;
  if (shape === "kushi") {
    b.lathe([[0, h], [r * 0.45, h * 0.98], [r, h * 0.55], [r * 0.85, h * 0.12], [0.02, 0]], S);
    b.lathe([[0, h], [r * 0.5, h * 0.98], [r * 0.48, h * 0.9], [0, h * 0.88]], metal(c));
  } else {
    b.sphere(r, S, 0, h / 2, 0, 40, h / w);
    b.cyl(0.02, 0.03, 0.03, c.m("frame", { color: "#f2f1ed", material: "matte" }), 0, h - 0.01, 0, 16);
  }
  cord(c, 0, 0, h, gap);
  b.object(lightMarker(0, h / 2, 0, 900));
}

export function pendantDome(c: Ctx) {
  const { w, h, p, b } = c;
  const M = metal(c);
  const gap = num(p, "ceilingGap", 0);
  const r = w / 2;
  b.lathe([[0.02, h], [r * 0.5, h * 0.92], [r * 0.85, h * 0.55], [r, 0.0], [r * 0.985, 0.0], [r * 0.83, h * 0.52], [r * 0.48, h * 0.88], [0.015, h * 0.96]], M, 0, 0, 0, 56);
  b.sphere(0.05, getMaterial(OPAL), 0, h * 0.35, 0, 16);
  cord(c, 0, 0, h, gap);
  b.object(lightMarker(0, h * 0.2, 0, 1200, "down"));
}

export function pendantCluster(c: Ctx) {
  const { w, h, p, b } = c;
  const S = shadeM(c);
  const gap = num(p, "ceilingGap", 0);
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * w * 0.3;
    const z = Math.sin(a) * w * 0.3;
    const y = (i % 2) * 0.08;
    b.sphere(0.08, S, x, y + 0.08, z, 24);
    cord(c, x, z, y + 0.16, gap + h - y - 0.16);
  }
  b.object(lightMarker(0, 0.1, 0, 1200));
}

export function pendantMirrorBall(c: Ctx) {
  const { w, h, p, b } = c;
  const gap = num(p, "ceilingGap", 0);
  b.sphere(w / 2, getMaterial({ color: "#e8eaec", material: "chrome" }), 0, h / 2, 0, 48);
  cord(c, 0, 0, h, gap);
  b.object(lightMarker(0, h * 0.2, 0, 700, "down"));
}

export function ceilingDome(c: Ctx) {
  const { w, h, p, b } = c;
  const S = shadeM(c);
  const F = c.m("frame", BLACK);
  const shape = str(p, "shape", "dome");
  const r = w / 2;
  if (shape === "lido") {
    b.cyl(0.05, 0.05, 0.02, F, 0, h - 0.02, 0, 24);
    b.cyl(0.012, 0.012, h * 0.3, F, 0, h * 0.68, 0, 8);
    b.lathe([[0.03, h * 0.68], [r, h * 0.62], [r * 0.98, h * 0.2], [r * 0.6, 0.0], [0, 0]], S);
    b.torus(r * 0.99, 0.004, F, 0, h * 0.45, 0);
  } else if (shape === "vanja") {
    b.cyl(0.06, 0.06, 0.03, F, 0, h - 0.03, 0, 24);
    b.cyl(0.02, 0.02, h * 0.15, F, 0, h - 0.06 - h * 0.1, 0, 12);
    b.sphere(Math.min(r, h * 0.45), S, 0, Math.min(r, h * 0.45), 0, 32);
  } else {
    // Eloise / organisch: flache Glasblüte
    b.cyl(0.06, 0.06, 0.02, F, 0, h - 0.02, 0, 24);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.sphere(r * 0.42, S, Math.cos(a) * r * 0.5, h * 0.45, Math.sin(a) * r * 0.5, 24, 0.55);
    }
  }
  b.object(lightMarker(0, h * 0.3, 0, 900));
}

export function ceilingDisc(c: Ctx) {
  const { w, h, p, b } = c;
  const S = shadeM(c);
  const F = c.m("frame", CHROME);
  const r = w / 2;
  if (str(p, "shape", "") === "svep") {
    b.cyl(r * 0.25, r * 0.25, h * 0.4, F, 0, h * 0.6, 0, 24);
    b.lathe([[0, 0], [r, h * 0.35], [r * 0.95, h * 0.45], [0.03, h * 0.62]], F, 0, 0, 0, 48);
    b.cyl(r * 0.92, r * 0.92, 0.006, S, 0, h * 0.34, 0, 48);
  } else {
    b.cyl(r, r, h * 0.2, F, 0, h * 0.8, 0, 40);
    b.lathe([[0, 0], [r * 0.85, h * 0.25], [r * 0.95, h * 0.82], [0, h * 0.82]], S, 0, 0, 0, 40);
  }
  b.object(lightMarker(0, 0, 0, 900, "down"));
}

export function wallGlobe(c: Ctx) {
  const { w, d, h, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  const g = Math.min(w, h) / 2;
  b.cyl(0.06, 0.06, 0.012, M, 0, h / 2 - 0.006, -d / 2 + 0.006, 24, Math.PI / 2);
  b.object(polyTube([new THREE.Vector3(0, h / 2, -d / 2 + 0.01), new THREE.Vector3(0, h / 2, d / 2 - 2 * g)], 0.005, M));
  b.torus(g * 0.45, 0.005, M, 0, h / 2 - g * 0.9, d / 2 - g);
  b.sphere(g, S, 0, h / 2, d / 2 - g, 32);
  b.object(lightMarker(0, h / 2, d / 2 - g, 450));
}

export function wallSconce(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  if (str(p, "shape", "") === "plate") {
    // Flache Wand-/Deckenleuchte: Montageplatte + Diffusor (rund oder eckig)
    const round = Math.abs(w - h) < 0.03;
    if (round) {
      b.cyl(w / 2, w / 2, Math.max(0.01, d * 0.35), M, 0, h / 2, -d / 2 + d * 0.175, 48, Math.PI / 2);
      b.cyl(w / 2 - 0.01, w / 2 - 0.01, d * 0.6, S, 0, h / 2, d * 0.2, 48, Math.PI / 2);
    } else {
      b.box(w, h, d * 0.4, M, 0, 0, -d / 2 + d * 0.2);
      b.box(w - 0.02, h - 0.02, d * 0.6, S, 0, 0.01, d * 0.2);
    }
    b.object(lightMarker(0, h / 2, d / 2 + 0.05, 600));
    return;
  }
  b.box(w * 0.4, h * 0.5, 0.015, M, 0, h * 0.25, -d / 2 + 0.008);
  b.object(polyTube([new THREE.Vector3(0, h * 0.5, -d / 2 + 0.01), new THREE.Vector3(0, h * 0.5, 0)], 0.008, M));
  b.lathe([[0, 0], [w * 0.45, h * 0.15], [w * 0.5, h * 0.7], [w * 0.35, h], [0, h]], S, 0, 0, d * 0.1, 32);
  b.object(lightMarker(0, h * 0.5, d * 0.1, 450));
}

/** Lineare Pendelleuchte (Esstisch): Balken oder Reihe von Schirmen an zwei Abhängungen. */
export function pendantLinear(c: Ctx) {
  const { w, d, h, p, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  const gap = num(p, "ceilingGap", 0);
  const n = Math.max(0, Math.round(num(p, "heads", 0)));
  if (n >= 2) {
    // Schirmreihe an Traverse
    b.box(w, 0.02, 0.03, M, 0, h - 0.02, 0);
    const r = Math.min(d / 2, (w / n) * 0.42);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      b.cyl(0.004, 0.004, h - 2 * r - 0.02, M, x, 2 * r, 0, 6);
      if (str(p, "shape", "globe") === "dome") b.lathe([[0.015, 2 * r], [r * 0.5, 1.8 * r], [r, 0.2 * r], [r * 0.98, 0.2 * r], [r * 0.48, 1.76 * r], [0.012, 1.95 * r]], M, x, 0, 0, 40);
      else b.sphere(r, S, x, r, 0, 32);
      b.object(lightMarker(x, r * 0.6, 0, 600, "down"));
    }
  } else {
    // Leuchtbalken mit Diffusor unten
    b.box(w, h * 0.75, d, M, 0, h * 0.25, 0);
    b.box(w - 0.01, h * 0.25, d - 0.01, S, 0, 0, 0);
    for (const x of [-w * 0.3, 0, w * 0.3]) b.object(lightMarker(x, 0, 0, 900, "down"));
  }
  for (const sx of [-1, 1]) cord(c, sx * w * 0.38, 0, h, gap);
}

/** Gelenkleuchte (Tolomeo-Typ) – Tisch (h < 1 m) oder Boden. */
export function lampTask(c: Ctx) {
  const { w, h, b } = c;
  const M = metal(c);
  const S = shadeM(c);
  const floor = h > 1;
  const baseR = floor ? 0.15 : Math.min(0.11, w * 0.25);
  b.cyl(baseR, baseR, 0.02, M, 0, 0, 0, 40);
  const arm1 = floor ? h - 0.45 : h * 0.55;
  const j1 = new THREE.Vector3(0, 0.02 + arm1, 0);
  b.object(polyTube([new THREE.Vector3(0, 0.02, 0), j1], 0.007, M));
  const reach = Math.max(0.2, w * 0.75);
  const j2 = new THREE.Vector3(0, h - 0.05, reach * 0.85);
  b.object(polyTube([j1, j2], 0.006, M));
  b.sphere(0.012, M, j1.x, j1.y, j1.z, 12);
  // Reflektor (konisch, leicht geneigt)
  const r = floor ? 0.12 : 0.075;
  b.lathe([[0.015, 0], [r * 0.45, -0.02], [r, -0.12 * (r / 0.075)], [r * 0.97, -0.12 * (r / 0.075)], [r * 0.43, -0.018], [0.012, 0.004]], S, 0, j2.y, j2.z, 40);
  b.object(lightMarker(0, j2.y - 0.08, j2.z, floor ? 1200 : 450, "down"));
}
