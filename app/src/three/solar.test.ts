import { describe, expect, it } from "vitest";
import { sunDirection, sunPosition, sunTimes, utcOffset } from "./solar";

const BERLIN = { latitude: 52.52, longitude: 13.405 };

describe("Sonnenstand", () => {
  it("Sommerzeit nach europäischer Regel", () => {
    expect(utcOffset(2026, 2, 28)).toBe(1); // 28.03.2026: noch MEZ
    expect(utcOffset(2026, 2, 29)).toBe(2); // letzter Sonntag im März
    expect(utcOffset(2026, 9, 24)).toBe(2);
    expect(utcOffset(2026, 9, 25)).toBe(1); // letzter Sonntag im Oktober
  });

  it("Mittagshöhe Berlin zur Sommer- und Wintersonnenwende", () => {
    // Höchststand ≈ 90° − 52,5° ± 23,44°; wahrer Mittag in Berlin ≈ 13:07 MESZ bzw. 12:05 MEZ
    let maxS = 0;
    let maxW = 0;
    for (let m = 600; m < 900; m++) {
      maxS = Math.max(maxS, sunPosition("2026-06-21", m / 60, BERLIN).elevation);
      maxW = Math.max(maxW, sunPosition("2026-12-21", m / 60, BERLIN).elevation);
    }
    expect(maxS).toBeCloseTo(60.9, 0);
    expect(maxW).toBeCloseTo(14.1, 0);
  });

  it("Azimut: vormittags Ost-/Südost, nachmittags West-/Südwest", () => {
    expect(sunPosition("2026-09-23", 8, BERLIN).azimuth).toBeGreaterThan(90);
    expect(sunPosition("2026-09-23", 8, BERLIN).azimuth).toBeLessThan(130);
    const noon = sunPosition("2026-09-23", 13.1, BERLIN).azimuth;
    expect(Math.abs(noon - 180)).toBeLessThan(5);
    expect(sunPosition("2026-09-23", 18, BERLIN).azimuth).toBeGreaterThan(240);
  });

  it("Sonnenauf-/untergang Berlin (21.06.: ≈ 4:43 / 21:33 MESZ)", () => {
    const t = sunTimes("2026-06-21", BERLIN)!;
    expect(Math.abs(t.rise - (4 + 43 / 60))).toBeLessThan(0.12);
    expect(Math.abs(t.set - (21 + 33 / 60))).toBeLessThan(0.12);
  });

  it("Richtung: Süden zeigt bei Norden = Plan oben nach Plan unten (+z)", () => {
    const [x, y, z] = sunDirection({ elevation: 0, azimuth: 180 }, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(1);
    // Norden um 90° gedreht (Nord zeigt im Plan nach rechts) → Süden nach links
    const [x2, , z2] = sunDirection({ elevation: 0, azimuth: 180 }, 90);
    expect(x2).toBeCloseTo(-1);
    expect(z2).toBeCloseTo(0);
  });
});
