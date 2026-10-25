import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { adaptationDegree, adaptationGain, adaptingWhite, labOfLinear, luminance, planckColor, ADAPT_LUMINANCE } from "./colorScience";

const chroma = (l: [number, number, number]) => Math.hypot(l[1], l[2]);
const hue = (l: [number, number, number]) => (Math.atan2(l[2], l[1]) * 180) / Math.PI;
/** Linear gerendert: Albedo × Licht, danach Weißabgleich. */
const render = (albedo: string, light: THREE.Color, gain: THREE.Color) => {
  const a = new THREE.Color(albedo);
  return new THREE.Color(a.r * light.r * gain.r, a.g * light.g * gain.g, a.b * light.b * gain.b);
};

describe("Farbtemperatur", () => {
  it("liefert normierte Leuchtdichte und warme bis kalte Farbarten", () => {
    for (const k of [2700, 2900, 3500, 4000, 6500]) expect(luminance(planckColor(k))).toBeCloseTo(1, 5);
    const warm = planckColor(2700), neutral = planckColor(6500);
    expect(warm.r).toBeGreaterThan(warm.b * 5);
    // 6500 K liegt nahe am Weißpunkt D65
    expect(Math.abs(neutral.r - neutral.b)).toBeLessThan(0.12);
  });
});

describe("Weißabgleich (chromatische Adaptation)", () => {
  it("Adaptationsgrad folgt CIECAM02: Abend ≈ 0,84, Tag ≈ 0,95", () => {
    expect(adaptationDegree(ADAPT_LUMINANCE.night)).toBeGreaterThan(0.8);
    expect(adaptationDegree(ADAPT_LUMINANCE.night)).toBeLessThan(0.88);
    expect(adaptationDegree(ADAPT_LUMINANCE.day)).toBeGreaterThan(0.92);
  });

  it("volle Adaptation gibt Katalogfarben exakt wieder", () => {
    const light = planckColor(2900);
    const out = render("#a49482", light, adaptationGain(light, 1));
    const ref = new THREE.Color("#a49482");
    expect(out.r).toBeCloseTo(ref.r, 4);
    expect(out.g).toBeCloseTo(ref.g, 4);
    expect(out.b).toBeCloseTo(ref.b, 4);
  });

  it("Taupe (DELIFE Flex) bleibt im 2900-K-Abendlicht taupe statt braun", () => {
    const light = planckColor(2900);
    const ref = labOfLinear(new THREE.Color("#a49482"));
    const lab = labOfLinear(render("#a49482", light, adaptationGain(light, adaptationDegree(ADAPT_LUMINANCE.night))));
    // Bis v2.0.7: Buntheit 26,9, Farbton 61° (deutlich bräunlich-orange) bei Katalogwert 12 / 76°
    expect(chroma(lab)).toBeLessThan(21);
    expect(hue(lab)).toBeGreaterThan(64);
    // … aber erkennbar wärmer als bei Tageslicht
    expect(chroma(lab)).toBeGreaterThan(chroma(ref) + 3);
    expect(lab[0]).toBeCloseTo(ref[0], 0);
  });

  it("weißes Papier wirkt abends warmweiß, nicht orange", () => {
    const light = planckColor(2700);
    const lab = labOfLinear(render("#f2f2f2", light, adaptationGain(light, adaptationDegree(ADAPT_LUMINANCE.night))));
    expect(chroma(lab)).toBeGreaterThan(6);
    expect(chroma(lab)).toBeLessThan(16);
  });

  it("adaptierendes Weiß liegt zwischen Lichtquelle und Raumlicht", () => {
    const lamp = planckColor(2900), room = new THREE.Color(2.2, 0.8, 0.15);
    const w = adaptingWhite(lamp, room, 0.3);
    expect(luminance(w)).toBeCloseTo(1, 5);
    expect(w.r / w.b).toBeGreaterThan(lamp.r / lamp.b);
    expect(w.r / w.b).toBeLessThan(room.r / room.b);
  });
});
