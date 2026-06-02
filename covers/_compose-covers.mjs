// Composites the final 1200x630 dev.to covers for week3-4:
// AI background (covers/bg/day-XX.png) + dark legibility scrim + crisp text overlay
// (command, title, subtitle, tags, author) rendered in JetBrains Mono via Puppeteer.
// Falls back to a plain dark background when an AI bg is missing.
// Output: covers/day-XX.png

import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const here = path.dirname(fileURLToPath(import.meta.url));

// Puppeteer's pinned Chrome may not be downloaded; reuse Playwright's cached
// Chromium (or an explicit override) so we don't pull another ~150MB browser.
function resolveChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const pw = path.join(os.homedir(), ".cache/ms-playwright/chromium-1148/chrome-linux/chrome");
  return existsSync(pw) ? pw : undefined;
}

const TAG_COLORS = {
  ai: { border: "#00ff88", color: "#00ff88" },
  security: { border: "#ffbb00", color: "#ffbb00" },
  ts: { border: "#00e5ff", color: "#00e5ff" },
  web3: { border: "#ff00ff", color: "#ff00ff" },
};

function bgLayer(day) {
  const p = path.join(here, "bg", `day-${day}.png`);
  if (!existsSync(p)) return "background: #0a0a0a;";
  const b64 = readFileSync(p).toString("base64");
  return `background-image: url('data:image/png;base64,${b64}'); background-size: cover; background-position: center;`;
}

function buildHtml(c) {
  const tags = c.tags
    .map((t) => {
      const col = TAG_COLORS[t.color];
      return `<span style="border:1px solid ${col.border};color:${col.color};padding:4px 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;background:rgba(5,5,5,0.45);">${t.label}</span>`;
    })
    .join("\n        ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px; height: 630px;
      font-family: "JetBrains Mono", monospace;
      color: #e0e0e0; position: relative; overflow: hidden;
      ${bgLayer(c.day)}
    }
    .scrim {
      position: absolute; inset: 0;
      background: linear-gradient(90deg, rgba(5,5,5,0.94) 0%, rgba(5,5,5,0.82) 42%, rgba(5,5,5,0.30) 75%, rgba(5,5,5,0.10) 100%);
    }
    .grid {
      position: absolute; inset: 0; opacity: 0.5;
      background-image:
        linear-gradient(rgba(0,255,136,0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,255,136,0.035) 1px, transparent 1px);
      background-size: 50px 50px;
    }
    .card { position: relative; z-index: 2; width: 1080px; padding: 60px; height: 100%; display: flex; flex-direction: column; justify-content: center; }
    .prompt { color: #8a8a8a; font-size: 16px; margin-bottom: 12px; }
    .title { font-size: 46px; font-weight: 700; color: #00ff88; line-height: 1.18; margin-bottom: 24px; text-shadow: 0 0 30px rgba(0,255,136,0.30); }
    .desc { font-size: 18px; color: #b0b0b0; margin-bottom: 36px; max-width: 640px; line-height: 1.5; }
    .tags { display: flex; gap: 10px; margin-bottom: 40px; }
    .author-name { font-size: 16px; color: #cfcfcf; }
    .author-handle { font-size: 14px; color: #777; }
    .day { position: absolute; top: 22px; right: 30px; color: #666; font-size: 14px; z-index: 2; }
  </style>
</head>
<body>
  <div class="scrim"></div>
  <div class="grid"></div>
  <div class="day">Day ${c.day}</div>
  <div class="card">
    <div class="prompt">${c.command}</div>
    <div class="title">${c.title.replace(/\n/g, "<br>")}</div>
    <div class="desc">${c.subtitle}</div>
    <div class="tags">
        ${tags}
    </div>
    <div>
      <div class="author-name">Pavel Espitia</div>
      <div class="author-handle">@pavelespitia</div>
    </div>
  </div>
</body>
</html>`;
}

const covers = JSON.parse(await fs.readFile(path.join(here, "covers-week3-4.json"), "utf8"));
const browser = await puppeteer.launch({
  headless: true,
  executablePath: resolveChrome(),
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

for (const c of covers) {
  const html = buildHtml(c);
  const tmp = path.join(here, `_tmp_day${c.day}.html`);
  await fs.writeFile(tmp, html);

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.goto(`file://${tmp}`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(here, `day-${c.day}.png`), type: "png" });
  await page.close();
  await fs.unlink(tmp);

  const hasBg = existsSync(path.join(here, "bg", `day-${c.day}.png`));
  console.log(`✓ day-${c.day}.png  ${hasBg ? "(AI bg)" : "(plain bg, no AI image)"}`);
}

await browser.close();
console.log("\nDone. Covers written to covers/day-16.png .. day-30.png");
