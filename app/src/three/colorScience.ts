import * as THREE from "three";

// Farbwissenschaft für die 3D-Ansicht: Lichtfarben aus der Farbtemperatur und chromatische
// Adaptation (Weißabgleich) wie beim Auge. Alle Farben linear im sRGB-Farbraum (Rec. 709).

const LUMA = [0.2126, 0.7152, 0.0722] as const;

/** Relative Leuchtdichte einer linearen sRGB-Farbe. */
export const luminance = (c: THREE.Color) => LUMA[0] * c.r + LUMA[1] * c.g + LUMA[2] * c.b;

/** Farbe auf Leuchtdichte 1 normieren (Farbart bleibt). */
export function unitLuminance(c: THREE.Color): THREE.Color {
  const l = luminance(c);
  return l > 1e-6 ? c.multiplyScalar(1 / l) : c.setRGB(1, 1, 1);
}

/**
 * Farbe eines Planck-Strahlers (Glühlampe, LED mit Farbtemperatur) als lineares sRGB mit
 * Leuchtdichte 1: Farbort auf dem Planckschen Kurvenzug (Kim et al. 2002, 1667–25000 K) → XYZ → sRGB.
 * Ersetzt die frühere Näherung nach Tanner Helland, die in Gamma-Werten gerechnet war und
 * warme Lichtfarben zu orange lieferte.
 */
export function planckColor(kelvin: number): THREE.Color {
  const T = THREE.MathUtils.clamp(kelvin, 1667, 25000);
  const x =
    T <= 4000
      ? -0.2661239e9 / T ** 3 - 0.2343589e6 / T ** 2 + 0.8776956e3 / T + 0.17991
      : -3.0258469e9 / T ** 3 + 2.1070379e6 / T ** 2 + 0.2226347e3 / T + 0.24039;
  const y =
    T <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : T <= 4000
        ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  const X = x / y, Z = (1 - x - y) / y;
  // XYZ (D65) → lineares sRGB
  const r = 3.2404542 * X - 1.5371385 - 0.4985314 * Z;
  const g = -0.969266 * X + 1.8760108 + 0.041556 * Z;
  const b = 0.0556434 * X - 0.2040259 + 1.0572252 * Z;
  return unitLuminance(new THREE.Color(Math.max(r, 0), Math.max(g, 0), Math.max(b, 0)));
}

/**
 * Adaptationsgrad des Auges nach CIECAM02 (durchschnittliche Umgebung, F = 1) aus der
 * adaptierenden Leuchtdichte in cd/m²: Wohnraum am Abend (~10 cd/m²) ≈ 0,84,
 * Tageslicht im Raum (≥ 100 cd/m²) ≈ 0,95. Warmes Abendlicht bleibt also sichtbar warm,
 * ohne Farben wie Taupe oder Grau ins Bräunliche zu ziehen.
 */
export function adaptationDegree(adaptingLuminance: number): number {
  const L = Math.max(0, adaptingLuminance);
  return THREE.MathUtils.clamp(1 - (1 / 3.6) * Math.exp((-L - 42) / 92), 0, 1);
}

/** Typische adaptierende Leuchtdichten (cd/m²) für Tag und Abend im Wohnraum. */
export const ADAPT_LUMINANCE = { day: 120, night: 10 } as const;

/**
 * Weißabgleich als Verstärkung je Kanal (von-Kries-Adaptation im Rendering-Farbraum): Licht der
 * Farbe `white` erscheint zum Anteil `degree` neutral. Die Szene wird in linearem RGB gerendert
 * (Albedo × Licht je Kanal); die Kanalverstärkung ist dazu die exakte Umkehrung, Materialfarben
 * erscheinen bei voller Adaptation also genau in ihrer Katalogfarbe. Leuchtdichte bleibt erhalten.
 */
export function adaptationGain(white: THREE.Color, degree: number, out = new THREE.Color()): THREE.Color {
  const w = unitLuminance(white.clone());
  const D = THREE.MathUtils.clamp(degree, 0, 1);
  out.setRGB(D / Math.max(w.r, 1e-3) + 1 - D, D / Math.max(w.g, 1e-3) + 1 - D, D / Math.max(w.b, 1e-3) + 1 - D);
  // Weißes Licht behält nach dem Abgleich seine Leuchtdichte
  const l = LUMA[0] * out.r * w.r + LUMA[1] * out.g * w.g + LUMA[2] * out.b * w.b;
  return out.multiplyScalar(1 / l);
}

/**
 * Adaptierendes Weiß aus bekannter Lichtfarbe und gemessenem Raumlicht (Grauwelt der Sonde):
 * geometrisches Mittel mit Gewicht `roomWeight`. Das Auge passt sich überwiegend an die Lichtquelle
 * an, zum Teil aber auch an farbige Rückstrahlung (dunkler Eichenboden, Nussbaumküche).
 */
export function adaptingWhite(illuminant: THREE.Color, room: THREE.Color, roomWeight = 0.3): THREE.Color {
  const a = unitLuminance(illuminant.clone()), b = unitLuminance(room.clone());
  const k = THREE.MathUtils.clamp(roomWeight, 0, 1);
  const mix = (p: number, q: number) => Math.exp((1 - k) * Math.log(Math.max(p, 1e-3)) + k * Math.log(Math.max(q, 1e-3)));
  return unitLuminance(new THREE.Color(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)));
}

/** sRGB-Hex → CIELAB (D65) für Prüfungen der Farbwiedergabe. */
export function labOfLinear(c: THREE.Color): [number, number, number] {
  const X = 0.4124 * c.r + 0.3576 * c.g + 0.1805 * c.b;
  const Y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const Z = 0.0193 * c.r + 0.1192 * c.g + 0.9505 * c.b;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.9505), fy = f(Y), fz = f(Z / 1.089);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
