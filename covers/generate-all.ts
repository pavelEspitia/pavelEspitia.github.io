import puppeteer from "puppeteer";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, existsSync } from "node:fs";
import { COVERS } from "./templates.js";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));

const TAG_COLORS: Record<string, { border: string; color: string }> = {
  ai: { border: "#00ff88", color: "#00ff88" },
  security: { border: "#ffbb00", color: "#ffbb00" },
  ts: { border: "#00e5ff", color: "#00e5ff" },
  web3: { border: "#ff00ff", color: "#ff00ff" },
};

function buildHtml(config: (typeof COVERS)[number]): string {
  const tags = config.tags
    .map((t) => {
      const c = TAG_COLORS[t.color]!;
      return `<span style="border:1px solid ${c.border};color:${c.color};padding:4px 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${t.label}</span>`;
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
      background: #0a0a0a; color: #e0e0e0;
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }
    body::before {
      content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background-image:
        linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px);
      background-size: 50px 50px;
    }
    body::after {
      content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.02) 2px, rgba(0,255,136,0.02) 4px);
    }
    .card { position: relative; z-index: 1; width: 1080px; padding: 60px; }
    .prompt { color: #444; font-size: 16px; margin-bottom: 12px; }
    .title { font-size: 44px; font-weight: 700; color: #00ff88; line-height: 1.2; margin-bottom: 24px; text-shadow: 0 0 30px rgba(0,255,136,0.25); }
    .desc { font-size: 18px; color: #777; margin-bottom: 36px; max-width: 700px; line-height: 1.5; }
    .tags { display: flex; gap: 10px; margin-bottom: 40px; }
    .author-name { font-size: 16px; color: #aaa; }
    .author-handle { font-size: 14px; color: #555; }
    .orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; }
    .orb-1 { width: 300px; height: 300px; background: #00ff88; top: -100px; right: -50px; }
    .orb-2 { width: 200px; height: 200px; background: #00e5ff; bottom: -50px; left: 100px; }
    .orb-3 { width: 150px; height: 150px; background: #ff00ff; top: 50%; right: 20%; }
    .day { position: absolute; top: 20px; right: 30px; color: #333; font-size: 14px; }
  </style>
</head>
<body>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
  <div class="day">Day ${config.day}/15</div>
  <div class="card">
    <div class="prompt">${config.command}</div>
    <div class="title">${config.title.replace(/\\n/g, "<br>")}</div>
    <div class="desc">${config.subtitle}</div>
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

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  for (const cover of COVERS) {
    const outputPng = resolve(THIS_DIR, `day-${String(cover.day).padStart(2, "0")}.png`);

    if (existsSync(outputPng) && cover.day === 1) {
      // Skip day 1 — already generated as spectr-ai-cover.png
    }

    const htmlContent = buildHtml(cover);
    const tmpHtml = resolve(THIS_DIR, `_tmp_day${cover.day}.html`);
    writeFileSync(tmpHtml, htmlContent);

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.goto(`file://${tmpHtml}`, { waitUntil: "networkidle0" });
    await page.screenshot({ path: outputPng, type: "png" });
    await page.close();

    console.log(`Generated: day-${String(cover.day).padStart(2, "0")}.png`);
  }

  await browser.close();

  // Cleanup temp HTML files
  for (const cover of COVERS) {
    const tmpHtml = resolve(THIS_DIR, `_tmp_day${cover.day}.html`);
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(tmpHtml);
    } catch {
      // ignore
    }
  }
}

main();
