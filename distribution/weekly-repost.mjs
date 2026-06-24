// Pulls current top dev.to performers and suggests where to repost them.
// Keeps distribution driven by what's actually working, not a stale list.
//
// Usage:
//   node distribution/weekly-repost.mjs            # print top N + channels
//   node distribution/weekly-repost.mjs --top=10   # change how many
//   node distribution/weekly-repost.mjs --gen      # scaffold linkedin/ drafts
//
// Requires: DEVTO_API_KEY (loaded from ~/.config/secrets/secrets.env)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_KEY = process.env.DEVTO_API_KEY;
if (!API_KEY) {
  console.error("missing DEVTO_API_KEY. Source ~/.config/secrets/load.sh first.");
  process.exit(1);
}

const args = process.argv.slice(2);
const topN = Number(args.find((a) => a.startsWith("--top="))?.slice(6) ?? 8);
const doGen = args.includes("--gen");

// Maps a post's tags to the niche communities most likely to care.
const COMMUNITY_BY_TAG = {
  ollama: ["r/LocalLLaMA", "r/ollama", "Ollama Discord"],
  ai: ["r/LocalLLaMA"],
  security: ["r/netsec", "Hacker News (Show HN)"],
  npm: ["r/netsec"],
  solidity: ["r/ethdev"],
  web3: ["r/ethdev"],
  nextjs: ["r/nextjs", "r/reactjs"],
  typescript: ["r/typescript"],
  monorepo: ["r/typescript"],
};

function channelsFor(tags) {
  const out = new Set();
  for (const t of tags) for (const c of COMMUNITY_BY_TAG[t] ?? []) out.add(c);
  return out.size ? [...out] : ["(no niche mapping, LinkedIn only)"];
}

const res = await fetch("https://dev.to/api/articles/me/published?per_page=100", {
  headers: { "api-key": API_KEY },
});
if (!res.ok) {
  console.error(`dev.to API ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const articles = await res.json();
const top = articles
  .slice()
  .sort((a, b) => (b.page_views_count ?? 0) - (a.page_views_count ?? 0))
  .slice(0, topN);

console.log(`Top ${topN} by views (of ${articles.length} published)\n`);
for (const [i, a] of top.entries()) {
  console.log(`${i + 1}. ${a.page_views_count ?? 0} views  ${a.title}`);
  console.log(`   ${a.url}`);
  console.log(`   LinkedIn + ${channelsFor(a.tag_list).join(", ")}\n`);
}

if (!doGen) process.exit(0);

const here = path.dirname(fileURLToPath(import.meta.url));
const linkedinDir = path.join(here, "linkedin");
await fs.mkdir(linkedinDir, { recursive: true });
const existing = new Set(await fs.readdir(linkedinDir));

let created = 0;
for (const a of top) {
  const slug = a.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 40);
  const file = `auto-${slug}.md`;
  if (existing.has(file)) continue;
  const body = `${a.title}\n\n[write the hook in Pavel's voice here]\n\nLink in the comments.\n`;
  await fs.writeFile(path.join(linkedinDir, file), body, "utf8");
  console.log(`scaffolded linkedin/${file}  (link: ${a.url})`);
  created += 1;
}
console.log(created ? `\n${created} new draft(s). Fill the hook before posting.` : "\nNo new drafts, all top posts already have files.");
