// Generates one AI background image per week3-4 cover using OpenAI gpt-image-1.
// Backgrounds are abstract and TEXT-FREE; the title/command/tags are composited
// on top later by _compose-covers.mjs. Idempotent: skips a day whose bg exists.
//
// Requires OPENAI_API_KEY in the environment (load from the central secrets store).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY missing. Add it to ~/.config/secrets/secrets.env");
  process.exit(1);
}

const SIZE = "1536x1024";
const QUALITY = "medium";
const DELAY_MS = 2000;
const MAX_RETRIES = 5;

function buildPrompt(motif) {
  return [
    `A wide cinematic abstract background for a developer blog cover.`,
    `Near-black charcoal base color (#050505).`,
    motif + ".",
    `Subtle glowing neon accents, soft bloom, fine detail, high contrast, dark and moody, tech editorial style.`,
    `The LEFT THIRD of the image must be very dark and uncluttered to leave room for an overlaid title.`,
    `Absolutely NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks, NO UI elements.`,
  ].join(" ");
}

async function generate(motif, attempt = 1) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: buildPrompt(motif),
      size: SIZE,
      quality: QUALITY,
      n: 1,
    }),
  });
  if ((res.status === 429 || res.status >= 500) && attempt <= MAX_RETRIES) {
    const wait = DELAY_MS * 2 ** attempt;
    console.log(`   ${res.status}, backing off ${wait / 1000}s (attempt ${attempt})`);
    await new Promise((r) => setTimeout(r, wait));
    return generate(motif, attempt + 1);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no image data in response");
  return Buffer.from(b64, "base64");
}

const onlyDays = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
let covers = JSON.parse(await fs.readFile(path.join(here, "covers-week3-4.json"), "utf8"));
if (onlyDays.length) covers = covers.filter((c) => onlyDays.includes(c.day));
const bgDir = path.join(here, "bg");
await fs.mkdir(bgDir, { recursive: true });

let made = 0;
let skipped = 0;
for (let idx = 0; idx < covers.length; idx++) {
  const c = covers[idx];
  const out = path.join(bgDir, `day-${c.day}.png`);
  try {
    await fs.access(out);
    console.log(`↻ day-${c.day}: bg exists, skipping`);
    skipped++;
    continue;
  } catch {
    // not present, generate it
  }

  if (made > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  try {
    const png = await generate(c.motif);
    await fs.writeFile(out, png);
    console.log(`✓ day-${c.day}: bg generated (${(png.length / 1024).toFixed(0)} KB)`);
    made++;
  } catch (e) {
    console.error(`✗ day-${c.day}: ${e.message}`);
  }
}

console.log(`\nDone. Generated ${made}, skipped ${skipped}. Backgrounds in covers/bg/`);
