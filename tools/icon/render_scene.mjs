// Rendert die Icon-Szene (app/src/dev/iconScene.ts) über den laufenden Vite-Dev-Server (Port 1420).
// Aufruf: node tools/icon/render_scene.mjs <out.png> [chromium-pfad]   (Playwright muss installiert sein)
import { chromium } from "playwright";
import fs from "fs";
const [,, out = "icon_scene.png", exe] = process.argv;
const browser = await chromium.launch({ executablePath: exe, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => m.type() === "warning" || m.type() === "error" ? console.log(m.text()) : null);
await page.goto("http://localhost:1420/?view=plan");
await page.waitForTimeout(4000);
const url = await page.evaluate(async () => (await import("/src/dev/iconScene.ts")).renderIconScene(2048));
fs.writeFileSync(out, Buffer.from(url.split(",")[1], "base64"));
await browser.close();
