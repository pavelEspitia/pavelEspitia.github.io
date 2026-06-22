import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.DEVTO_API_KEY;
if (!apiKey) {
  console.error("DEVTO_API_KEY missing");
  process.exit(1);
}

const argFiles = process.argv.slice(2);
const files = argFiles.length ? argFiles : [
  "01-self-hosted-copilot.md",
  "02-ollama-vs-lmstudio-vs-jan.md",
  "03-function-calling.md",
  "04-local-rag.md",
  "05-streaming-nextjs.md",
];

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

for (let idx = 0; idx < files.length; idx++) {
  const file = files[idx];
  if (idx > 0) {
    await new Promise((r) => setTimeout(r, 35_000));
  }
  const raw = await fs.readFile(path.join(here, file), "utf8");
  const { fm, body } = parseFrontmatter(raw);

  const article = {
    title: fm.title,
    body_markdown: body,
    tags: fm.tags,
    published: fm.publish === true,
  };

  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({ article }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`✗ ${file}: ${res.status} ${errBody.slice(0, 200)}`);
    continue;
  }

  const data = await res.json();
  const status = article.published ? "PUBLISHED" : "DRAFT";
  console.log(`✓ ${status} · ${data.title} · id=${data.id}`);
  if (article.published) console.log(`   ${data.url}`);
}
