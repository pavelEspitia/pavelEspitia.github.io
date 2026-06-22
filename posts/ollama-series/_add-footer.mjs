// Adds a soft cross-link footer to top dev.to posts.
// Idempotent — checks if the footer marker is already present before appending.

const apiKey = process.env.DEVTO_API_KEY;
if (!apiKey) {
  console.error("DEVTO_API_KEY missing");
  process.exit(1);
}

// Targets: top posts with >= 30 views.
const targets = [
  { id: 3507305, slug: "ollama-og" },         // 388
  { id: 3593441, slug: "function-calling" },  // 63
  { id: 3507313, slug: "monorepo" },          // 51
  { id: 3507307, slug: "zod-llms" },          // 44
  { id: 3507312, slug: "solidity-vyper" },    // 40
  { id: 3507319, slug: "two-ai-products" },   // 37
  { id: 3507306, slug: "cli-smart-contracts" },// 36
  { id: 3507314, slug: "ai-vs-auditors" },    // 32
];

const FOOTER_MARKER = "<!-- wic-footer-v1 -->";
const PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLtPTk_x8CdlFj5uUoG3ot1ov2nlVx8aQa";

const footer = `

${FOOTER_MARKER}
---

*If you enjoy dissecting why systems break down, I make video case studies of historical engineering disasters at [Why It Crashed](${PLAYLIST_URL}) — same first-principles approach, different domain. Latest: how five words on a foggy radio call killed 583 people on a runway in 1977.*
`;

async function getArticle(id) {
  const r = await fetch(`https://dev.to/api/articles/${id}`, {
    headers: { "api-key": apiKey },
  });
  if (!r.ok) throw new Error(`get ${id}: ${r.status}`);
  return r.json();
}

async function updateArticle(id, body) {
  const r = await fetch(`https://dev.to/api/articles/${id}`, {
    method: "PUT",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ article: { body_markdown: body } }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`put ${id}: ${r.status} ${err.slice(0, 200)}`);
  }
  return r.json();
}

for (let idx = 0; idx < targets.length; idx++) {
  const t = targets[idx];
  if (idx > 0) await new Promise((r) => setTimeout(r, 35_000)); // dev.to rate limit

  try {
    const article = await getArticle(t.id);
    const body = article.body_markdown || "";

    if (body.includes(FOOTER_MARKER)) {
      console.log(`↻ ${t.slug} (already has footer)`);
      continue;
    }

    const newBody = body.trimEnd() + footer;
    await updateArticle(t.id, newBody);
    console.log(`✓ ${t.slug} (id=${t.id}) footer added`);
  } catch (e) {
    console.error(`✗ ${t.slug}: ${e.message}`);
  }
}
