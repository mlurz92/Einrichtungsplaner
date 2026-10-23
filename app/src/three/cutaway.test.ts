import { describe, expect, it } from "vitest";
import { apartment } from "../data";
import { cutUniforms, isCutAway } from "./cutaway";

const room = apartment.rooms.find((r) => r.id === "13.01")!;
const cx = room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length;
const cy = room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length;
const [, , BX1] = apartment.bounds;

describe("Wandmodus Auto", () => {
  it("schneidet nur, wenn hinter der Stelle Wohnfläche liegt", () => {
    cutUniforms.uCutOn.value = 1;
    cutUniforms.uCutCam.value.set(-20, 12, cy);
    expect(isCutAway(cx - 1.5, 1.5, cy)).toBe(true); // Blick über die Stelle in den Raum
    expect(isCutAway(BX1 + 0.5, 1.5, cy)).toBe(false); // dahinter nur noch außen
    expect(isCutAway(cx - 1.5, 0.1, cy)).toBe(false); // Sockel bleibt stehen
  });
  it("Draufsicht: Wandkrone verdeckt nichts", () => {
    cutUniforms.uCutCam.value.set(cx, 200, cy);
    expect(isCutAway(BX1 + 0.5, 1.5, cy)).toBe(false);
  });
  it("aus, wenn Modus inaktiv", () => {
    cutUniforms.uCutOn.value = 0;
    cutUniforms.uCutCam.value.set(-20, 12, cy);
    expect(isCutAway(cx - 1.5, 1.5, cy)).toBe(false);
  });
});
