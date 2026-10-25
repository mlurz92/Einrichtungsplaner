// Referenzaufnahmen der 3D-Ansicht aus festen Blickwinkeln (Tag/Abend) zur Prüfung der Bildwirkung.
// Aufruf: npx vite build && node scripts/render-shots.mjs <Zielordner> [Konzept-ID]
// Rendert per Software-WebGL (SwiftShader) in höchster Qualitätsstufe und misst je Bild
// mittlere Helligkeit und Anteil ausgebrannter Pixel.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 4174);
const OUT = process.argv[2] ?? "shots";
const CONCEPT = process.argv[3] ?? "concept1";
const URL = `http://localhost:${PORT}/?view=3d&q=hoch&concept=${CONCEPT}`;
// Optional: SHOTS=kueche,essen (Auswahl), WIDTH=800 (schnellere Probeläufe), NIGHT=0|1 (nur Tag/Abend)
const ONLY = process.env.SHOTS?.split(",");
const WIDTH = Number(process.env.WIDTH ?? 1280);
// MODES=tag,abend,kunst: Tageslicht, Abendlicht, Kunstlicht bei Tag (Leuchten an am späten Nachmittag)
const ALL_MODES = { tag: { night: false }, abend: { night: true }, kunst: { night: false, lamps: true, time: 17.75 } };
const MODES = (process.env.MODES?.split(",") ?? (process.env.NIGHT === "0" ? ["tag"] : process.env.NIGHT === "1" ? ["abend"] : ["tag", "abend"])).map((id) => ({ id, ...ALL_MODES[id] }));

// Blickwinkel: Position und Ziel in Metern (x, Höhe, y des Grundrisses)
const VIEWS = [
  { id: "uebersicht", pos: [15.5, 13, 20], target: [7.5, 0, 8.5], fov: 42, time: 11 },
  { id: "wohnen", pos: [6.6, 1.62, 11.3], target: [4.8, 0.9, 5.6], fov: 62, time: 14 },
  { id: "kueche", pos: [5.4, 1.62, 10.2], target: [1.2, 0.95, 11.6], fov: 62, time: 11 },
  { id: "essen", pos: [5.0, 1.55, 6.9], target: [6.6, 0.75, 10.2], fov: 58, time: 16 },
  { id: "gegenlicht", pos: [4.2, 1.2, 6.6], target: [8.0, 1.0, 9.2], fov: 62, time: 15 },
  { id: "schlafen", pos: [4.4, 1.62, 12.9], target: [6.0, 0.7, 15.4], fov: 66, time: 12 },
  // Nahaufnahmen Essplatz: Tischplatte (Dekor) und Stühle
  { id: "tisch", pos: [4.5, 1.75, 9.75], target: [6.1, 0.74, 9.6], fov: 50, time: 14 },
  { id: "stuehle", pos: [6.1, 1.25, 7.7], target: [6.0, 0.55, 9.6], fov: 55, time: 14 },
  { id: "stuhl", pos: [7.2, 1.05, 8.45], target: [7.5, 0.5, 7.34], fov: 50, time: 14 },
];

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--strictPort", "--outDir", process.env.DIST ?? "dist"], { stdio: "ignore" });
const ready = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Vorschau-Server startet nicht");
};

mkdirSync(OUT, { recursive: true });
const stats = [];
try {
  await ready();
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem("we13.ui.v1", JSON.stringify({ theme: "light" })));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("Seitenfehler:", e.message));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__we13store && globalThis.__we13view?.getState().api, null, { timeout: 60000 });
  await page.evaluate(() => {
    const st = globalThis.__we13store.getState();
    st.set("startOpen", false);
    globalThis.__we13view.getState().set("panelOpen", false);
  });
  await page.waitForTimeout(4000);
  for (const mode of MODES) {
    for (const v of VIEWS.filter((x) => !ONLY || ONLY.includes(x.id))) {
      await page.evaluate(
        ({ v, mode }) => {
          const st = globalThis.__we13store.getState();
          st.set("night", mode.night);
          globalThis.__we13view.getState().lampsDay !== undefined && globalThis.__we13view.getState().set("lampsDay", !!mode.lamps);
          const s = st.project.settings;
          const time = mode.night ? 21 : mode.time ?? v.time;
          if (s.timeOfDay !== time) st.setSettings({ timeOfDay: time });
          globalThis.__we13view.getState().set("goto", { pos: v.pos, target: v.target, fov: v.fov, t: performance.now() });
        },
        { v, mode },
      );
      // Warten, bis Umgebungssonde und Belichtung zur Ansicht passen (Software-Rendering ist langsam)
      let prev = "";
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(3000);
        const cur = await page.evaluate(() => JSON.stringify([globalThis.__we13probe, globalThis.__we13.gl.toneMappingExposure]));
        // Innenansichten: Sonde muss am Kamerastandort stehen
        const at = await page.evaluate((p) => { const q = globalThis.__we13probe?.pos; return !q || p[1] > 3 || Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.05; }, v.pos);
        if (cur === prev && at) break;
        prev = cur;
      }
      const data = await page.evaluate((w) => globalThis.__we13view.getState().api.capture(w), WIDTH);
      if (!data) throw new Error(`Aufnahme ${v.id} fehlgeschlagen`);
      const name = `${v.id}_${mode.id}.png`;
      writeFileSync(join(OUT, name), Buffer.from(data.split(",")[1], "base64"));
      // Helligkeitsstatistik im Browser (Luma, Anteil > 250 = ausgebrannt)
      const m = await page.evaluate(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let sum = 0, clip = 0;
        for (let i = 0; i < d.length; i += 4) {
          const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          sum += y;
          if (y > 250) clip++;
        }
        const n = d.length / 4;
        return { mean: +(sum / n).toFixed(1), clipped: +((clip / n) * 100).toFixed(2) };
      }, data);
      m.exposure = await page.evaluate(() => +globalThis.__we13.gl.toneMappingExposure.toFixed(2));
      m.probe = await page.evaluate(() => globalThis.__we13probe);
      stats.push({ name, ...m });
      console.log(`${name}: Helligkeit ${m.mean}, ausgebrannt ${m.clipped} %, Belichtung ${m.exposure}, Sonde ${JSON.stringify(m.probe)}`);
    }
  }
  writeFileSync(join(OUT, "stats.json"), JSON.stringify(stats, null, 2));
  await browser.close();
} finally {
  server.kill();
}
