import puppeteer from "puppeteer";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));

async function generate(htmlFile: string, outputFile: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });

  const filePath = resolve(THIS_DIR, htmlFile);
  await page.goto(`file://${filePath}`, { waitUntil: "networkidle0" });

  await page.screenshot({
    path: resolve(THIS_DIR, outputFile),
    type: "png",
  });

  await browser.close();
  console.log(`Generated: ${outputFile}`);
}

generate("spectr-ai-cover.html", "spectr-ai-cover.png");
