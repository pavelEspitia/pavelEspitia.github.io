// Attaches the week3-4 covers to their dev.to drafts by setting main_image.
// Matches each local post (posts/week3-4/day-XX.md) to a dev.to draft by title,
// then PUTs main_image = https://pavelespitia.github.io/covers/day-XX.png.
//
// PREREQUISITE: the cover PNGs must already be committed and pushed to the
// github.io Pages site, so the URL is publicly fetchable before dev.to caches it.
//
// Requires DEVTO_API_KEY in the environment.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const apiKey = process.env.DEVTO_API_KEY;
if (!apiKey) {
  console.error("DEVTO_API_KEY missing");
  process.exit(1);
}

const BASE_IMAGE_URL = "https://pavelespitia.github.io/covers";
const DELAY_MS = 3000;

function titleOf(raw) {
  const m = raw.match(/^title:\s*"?(.*?)"?\s*$/m);
  return m ? m[1] : null;
}

async function draftsByTitle() {
  const r = await fetch("https://dev.to/api/articles/me/unpublished?per_page=100", {
    headers: { "api-key": apiKey },
  });
  if (!r.ok) throw new Error(`list drafts: ${r.status}`);
  const map = new Map();
  for (const a of await r.json()) map.set(a.title, a.id);
  return map;
}

const postsDir = path.join(root, "posts", "week3-4");
const files = (await fs.readdir(postsDir)).filter((f) => /^day-\d+\.md$/.test(f)).sort();
const drafts = await draftsByTitle();

let attached = 0;
let missing = 0;
for (let idx = 0; idx < files.length; idx++) {
  const file = files[idx];
  const day = file.match(/day-(\d+)\.md/)[1];
  const raw = await fs.readFile(path.join(postsDir, file), "utf8");
  const title = titleOf(raw);
  const id = title ? drafts.get(title) : undefined;
  if (!id) {
    console.error(`✗ ${file}: no matching draft for title "${title}"`);
    missing++;
    continue;
  }

  if (attached > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  const url = `${BASE_IMAGE_URL}/day-${day}.png`;
  const res = await fetch(`https://dev.to/api/articles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({ article: { main_image: url } }),
  });
  if (!res.ok) {
    console.error(`✗ ${file} (id=${id}): ${res.status} ${(await res.text()).slice(0, 150)}`);
    continue;
  }
  console.log(`✓ ${file} -> draft ${id}  cover: day-${day}.png`);
  attached++;
}

console.log(`\nDone. Attached ${attached}, missing ${missing}.`);
