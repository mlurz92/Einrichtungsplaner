// Rendert tools/icon/icon.html mit Chromium (Playwright) zu tools/icon/icon_1024.png (transparent).
const path = require("path");
const { chromium } = require("playwright");
(async () => {
  const out = process.argv[2] || path.join(__dirname, "icon_1024.png");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await p.goto("file://" + path.join(__dirname, "icon.html"));
  await p.waitForTimeout(300);
  await p.screenshot({ path: out, omitBackground: true });
  await b.close();
  console.log(out);
})();
