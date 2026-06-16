// Creates dev.to DRAFTS from the week3-4 frontmatter posts.
// Forces published:false regardless of frontmatter. Idempotent-ish:
// skips a file if a draft/article with the same title already exists.
//
// Requires DEVTO_API_KEY in the environment (load from the central secrets store).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.DEVTO_API_KEY;
if (!apiKey) {
  console.error("DEVTO_API_KEY missing");
  process.exit(1);
}

const DELAY_MS = 3000;
const MAX_RETRIES = 5;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("no frontmatter");
  const [, fmRaw, body] = match;
  const fm = {};
  for (const line of fmRaw.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (value.startsWith("[")) {
      fm[key] = JSON.parse(value);
    } else if (value === "true" || value === "false") {
      fm[key] = value === "true";
    } else {
      fm[key] = value.replace(/^"(.*)"$/, "$1");
    }
  }
  return { fm, body: body.trim() };
}

async function existingTitles() {
  const titles = new Set();
  for (const status of ["published", "unpublished"]) {
    const r = await fetch(`https://dev.to/api/articles/me/${status}?per_page=100`, {
      headers: { "api-key": apiKey },
    });
    if (!r.ok) continue;
    const list = await r.json();
    for (const a of list) titles.add(a.title);
  }
  return titles;
}

async function createDraft(article, attempt = 1) {
  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({ article }),
  });
  if (res.status === 429 && attempt <= MAX_RETRIES) {
    const wait = DELAY_MS * 2 ** attempt;
    console.log(`   429 rate-limited, backing off ${wait / 1000}s (attempt ${attempt})`);
    await new Promise((r) => setTimeout(r, wait));
    return createDraft(article, attempt + 1);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err.slice(0, 200)}`);
  }
  return res.json();
}

const files = (await fs.readdir(here))
  .filter((f) => /^day-\d+\.md$/.test(f))
  .sort();

console.log(`Found ${files.length} local posts. Checking existing dev.to articles...`);
const seen = await existingTitles();

let created = 0;
let skipped = 0;
for (let idx = 0; idx < files.length; idx++) {
  const file = files[idx];
  const raw = await fs.readFile(path.join(here, file), "utf8");
  const { fm, body } = parseFrontmatter(raw);

  if (seen.has(fm.title)) {
    console.log(`↻ ${file}: already on dev.to, skipping`);
    skipped++;
    continue;
  }

  if (created > 0) await new Promise((r) => setTimeout(r, DELAY_MS));

  try {
    const data = await createDraft({
      title: fm.title,
      body_markdown: body,
      tags: fm.tags,
      published: false,
    });
    console.log(`✓ DRAFT  ${file}  id=${data.id}  ${fm.title.slice(0, 55)}`);
    created++;
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
  }
}

console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
