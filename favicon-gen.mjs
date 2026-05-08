import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import puppeteer from "puppeteer";

const here = path.dirname(fileURLToPath(import.meta.url));

const FONTS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&display=swap" rel="stylesheet">
`;

// Single design — render at multiple resolutions.
const html = (size, options = {}) => `
<!doctype html><html><head>${FONTS}<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; }
body {
  background: ${options.bg ?? "transparent"};
  display: flex;
  align-items: center;
  justify-content: center;
}
.wrap {
  width: ${size}px;
  height: ${size}px;
  display: flex;
  align-items: baseline;
  justify-content: center;
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 900;
  letter-spacing: -${size * 0.012}px;
}
.p {
  font-size: ${size * 0.78}px;
  color: #fafafa;
  line-height: 1;
}
.e {
  font-size: ${size * 0.42}px;
  color: #f59e0b;
  line-height: 1;
  margin-left: ${size * 0.02}px;
  margin-bottom: ${size * 0.04}px;
}
</style></head><body>
<div class="wrap">
  <span class="p">P</span><span class="e">E</span>
</div>
</body></html>
`;

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const renderTo = async (size, filename, opts = {}) => {
  const page = await browser.newPage();
  await page.setViewport({
    width: size,
    height: size,
    deviceScaleFactor: 1,
  });
  await page.goto(
    "data:text/html;charset=utf-8," + encodeURIComponent(html(size, opts)),
    { waitUntil: "networkidle0" },
  );
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({
    path: path.join(here, filename),
    type: "png",
    omitBackground: !opts.bg,
  });
  await page.close();
  console.log(`✓ ${filename}`);
};

// Standard favicon (transparent, works on any browser tab background)
await renderTo(32, "favicon-32.png");
await renderTo(192, "icon-192.png");
await renderTo(512, "icon-512.png");

// Apple touch icon — REQUIRED to be square with bg (iOS doesn't support transparency)
await renderTo(180, "apple-touch-icon.png", { bg: "#050505" });

// Hi-res favicon for modern browsers (transparent)
await renderTo(256, "favicon.png");

await browser.close();
console.log("done.");
