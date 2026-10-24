import { describe, expect, it } from "vitest";
import { newerVersion } from "./update";
import { sanitize, UI_DEFAULTS, SIDEBAR_LIMITS } from "./prefs";
import { floorTone, shadeHex } from "../plan/floors";

describe("Versionsvergleich (Update-Hinweis)", () => {
  it("erkennt neuere Versionen numerisch, nicht als Text", () => {
    expect(newerVersion("2.0.0", "1.2.0")).toBe(true);
    expect(newerVersion("v1.10.0", "1.9.3")).toBe(true);
    expect(newerVersion("1.2.0", "1.2.0")).toBe(false);
    expect(newerVersion("1.2", "1.2.1")).toBe(false);
    expect(newerVersion("2.0.0-beta", "1.9.0")).toBe(true);
  });
});

describe("Oberflächen-Einstellungen", () => {
  it("begrenzt Werte aus dem Speicher auf gültige Bereiche", () => {
    const p = sanitize({ ...UI_DEFAULTS, theme: "lila" as never, scale: 999, leftWidth: 10, rightWidth: Number.NaN, favorites: ["a", 3 as never, "b"] });
    expect(p.theme).toBe("system");
    expect(p.scale).toBe(150);
    expect(p.leftWidth).toBe(SIDEBAR_LIMITS.left[0]);
    expect(p.rightWidth).toBe(UI_DEFAULTS.rightWidth);
    expect(p.favorites).toEqual(["a", "b"]);
  });
});

describe("Bodenfarben im Plan", () => {
  it("hellt auf bzw. dunkelt ab und bleibt bei ungültigen Werten unverändert", () => {
    expect(shadeHex("#808080", 0.5)).toBe("#404040");
    expect(shadeHex("#000000", 2)).toBe("#ffffff");
    expect(shadeHex("rot", 0.5)).toBe("rot");
    expect(floorTone({ kind: "planks", color: "#cfae84", angle: 0 })).not.toBe("#cfae84");
  });
});
