// Oberflächenprüfung im Browser (CI): Kopfleiste passt ohne Überlauf ab 1.200 px Fensterbreite,
// in allen Ansichten und in beiden Designs; Dialoge öffnen; keine Laufzeitfehler.
// Aufruf: npx vite build && node scripts/ui-check.mjs   (startet selbst „vite preview“)
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const WIDTHS = [1200, 1280, 1366, 1440, 1536, 1600, 1680, 1760, 1920];
const MODES = ["plan", "split", "3d"];
const THEMES = ["light", "dark"];

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const ready = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Vorschau-Server startet nicht");
};

let failed = 0;
const fail = (msg) => {
  failed++;
  console.error(`✗ ${msg}`);
};

try {
  await ready();
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem("we13.ui.v1", JSON.stringify({ theme: t })), theme);
    // FONT="DejaVu Sans": Schrift des CI-Runners erzwingen (breiter als Inter/Segoe), um Überlauf lokal zu sehen
    if (process.env.FONT)
      await ctx.addInitScript((f) => addEventListener("DOMContentLoaded", () => document.head.append(Object.assign(document.createElement("style"), { textContent: `*{font-family:"${f}"!important}` }))), process.env.FONT);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.__we13store, null, { timeout: 30000 });
    const got = await page.evaluate(() => document.documentElement.dataset.theme);
    if (got !== theme) fail(`Design ${theme}: data-theme ist ${got}`);
    // 3D mit geringer Qualität: Software-Rendering in CI, geprüft wird nur das Layout
    await page.evaluate(() => {
      const st = globalThis.__we13store.getState();
      st.set("startOpen", false);
      st.set("quality", "niedrig");
    });
    for (const mode of MODES) {
      await page.evaluate((m) => globalThis.__we13layout.getState().preset(m), mode);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(120);
        const r = await page.evaluate(() => {
          const el = document.querySelector("[data-topbar]");
          if (!el) return null;
          const kids = [...el.querySelectorAll(":scope > *")];
          const right = Math.max(...kids.map((k) => k.getBoundingClientRect().right));
          return { over: el.scrollWidth - el.clientWidth, right, edge: el.getBoundingClientRect().right };
        });
        if (!r) fail(`${theme}/${mode}/${w}: Kopfleiste fehlt`);
        else if (r.over > 0 || r.right > r.edge + 0.5) fail(`${theme}/${mode}/${w}: Kopfleiste läuft über (${Math.max(r.over, Math.round(r.right - r.edge))} px)`);
      }
    }
    // Dialoge: Einstellungen (Strg+,), Hilfe (F1), Befehlssuche (Strg+K)
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.evaluate(() => globalThis.__we13layout.getState().preset("plan"));
    for (const [keys, sel, name] of [
      ["Control+Comma", '[role="dialog"] h2:has-text("Einstellungen")', "Einstellungen"],
      ["F1", '[role="dialog"] h2:has-text("Tastenkürzel")', "Hilfe"],
      ["Control+k", '[role="dialog"][aria-label="Befehlssuche"]', "Befehlssuche"],
    ]) {
      await page.locator("body").click({ position: { x: 5, y: 890 - 100 } }).catch(() => {});
      await page.keyboard.press(keys);
      if (!(await page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false))) fail(`${theme}: ${name} öffnet nicht`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }
    // Aufteilungen: Fensterzahl, Kopfzeilen ohne abgeschnittene Bedienelemente, Maximieren, 2D|2D und 3D|3D
    const COUNT = { single: 1, cols: 2, rows: 2, left3: 3, top3: 3, quad: 4 };
    for (const w of [1200, 1600]) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const [id, n] of Object.entries(COUNT)) {
        await page.evaluate((l) => {
          const lay = globalThis.__we13layout.getState();
          lay.reset();
          globalThis.__we13layout.getState().setLayout(l);
        }, id);
        await page.waitForTimeout(250);
        const r = await page.evaluate(() => ({
          n: document.querySelectorAll("[data-pane]").length,
          clipped: [...document.querySelectorAll(".pane-bar")].filter((b) => {
            const box = b.getBoundingClientRect();
            return [...b.querySelectorAll("button")].some((x) => x.offsetParent && x.getBoundingClientRect().right > box.right + 0.5);
          }).length,
        }));
        if (r.n !== n) fail(`${theme}/${w}: Aufteilung ${id} zeigt ${r.n} statt ${n} Fenster`);
        if (r.clipped) fail(`${theme}/${w}: Aufteilung ${id}: ${r.clipped} Kopfzeile(n) abgeschnitten`);
      }
    }
    await page.evaluate(() => {
      const lay = globalThis.__we13layout.getState();
      lay.reset();
      lay.setPane(1, { kind: "plan" });
    });
    await page.waitForTimeout(400);
    if ((await page.locator("[data-pane] svg[data-plan]").count()) !== 2) fail(`${theme}: 2D | 2D zeigt nicht zwei Pläne`);
    await page.evaluate(() => globalThis.__we13layout.getState().toggleMaximize(1));
    await page.waitForTimeout(200);
    const vis = await page.evaluate(() => [...document.querySelectorAll("[data-pane]")].filter((p) => getComputedStyle(p).visibility !== "hidden").length);
    if (vis !== 1) fail(`${theme}: Maximieren zeigt ${vis} Fenster`);
    await page.evaluate(() => globalThis.__we13layout.getState().reset());
    // Menüleiste: Menüs öffnen, Überfahren wechselt das Menü
    await page.getByRole("menuitem", { name: "Datei", exact: true }).click();
    await page.getByRole("menuitem", { name: "Ansicht", exact: true }).hover();
    if (!(await page.locator('[role="menu"][aria-label="Ansicht"]').isVisible({ timeout: 2000 }).catch(() => false))) fail(`${theme}: Menüleiste wechselt beim Überfahren nicht`);
    await page.keyboard.press("Escape");
    if (errors.length) fail(`${theme}: Laufzeitfehler: ${errors.slice(0, 3).join(" | ")}`);
    await ctx.close();
  }
  await browser.close();
} catch (e) {
  fail(String(e?.stack ?? e));
} finally {
  server.kill();
}
if (failed) {
  console.error(`${failed} Fehler`);
  process.exit(1);
}
console.log(`✓ Kopfleiste passt bei ${WIDTHS.join(", ")} px in ${MODES.length} Ansichten und ${THEMES.length} Designs; Aufteilungen, Maximieren und Menüleiste funktionieren; Dialoge öffnen`);
process.exit(0);
