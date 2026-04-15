import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const DEVTO_KEY = process.env["DEVTO_API_KEY"] ?? "";
const HASHNODE_TOKEN = process.env["HASHNODE_TOKEN"] ?? "";
const HASHNODE_PUB_ID = "69de857aba66562a4f763ca2";
const BASE_IMAGE_URL = "https://pavelespitia.github.io/covers";

interface PostConfig {
  day: number;
  title: string;
  tags: string[];
}

const POSTS: PostConfig[] = [
  { day: 1, title: "5 Smart Contract Vulnerabilities That AI Catches Better Than Static Analyzers", tags: ["web3", "ai", "security", "solidity"] },
  { day: 2, title: "How to Run LLMs Locally with Ollama — A Developer's Guide", tags: ["ai", "tutorial", "beginners", "typescript"] },
  { day: 3, title: "I Made a CLI That Talks to Any Smart Contract in Plain English", tags: ["web3", "ai", "typescript", "showdev"] },
  { day: 4, title: "Zod + LLMs: How to Validate AI Responses Without Losing Your Mind", tags: ["typescript", "ai", "webdev", "tutorial"] },
  { day: 5, title: "The Provider Pattern: How I Added Ollama Support in 50 Lines", tags: ["typescript", "design", "ai", "programming"] },
  { day: 6, title: "SARIF: The Format That Connects Your AI Auditor to GitHub Code Scanning", tags: ["github", "security", "ci", "devops"] },
  { day: 7, title: "Building a Real-Time Progress Bar with Server-Sent Events in Next.js", tags: ["nextjs", "react", "webdev", "typescript"] },
  { day: 8, title: "What Happens When You Call a Smart Contract? A Visual Guide", tags: ["web3", "blockchain", "beginners", "solidity"] },
  { day: 9, title: "Solidity vs Vyper: Security Differences Every Auditor Should Know", tags: ["web3", "solidity", "security", "python"] },
  { day: 10, title: "How I Structured a TypeScript Monorepo with pnpm Workspaces", tags: ["typescript", "monorepo", "pnpm", "webdev"] },
  { day: 11, title: "AI Won't Replace Smart Contract Auditors — But Auditors Using AI Will Replace Those Who Don't", tags: ["ai", "web3", "security", "career"] },
  { day: 12, title: "I Analyzed 5 Famous Hacked Contracts with AI — Here's What It Found", tags: ["web3", "security", "ai", "blockchain"] },
  { day: 13, title: "Building a Chat Interface Over Any API with TypeScript", tags: ["typescript", "ai", "webdev", "tutorial"] },
  { day: 14, title: "RWA Tokenization in 2026: What Developers Need to Know", tags: ["web3", "blockchain", "fintech", "career"] },
  { day: 15, title: "What I Learned Building 2 AI Products in 2 Weeks", tags: ["ai", "productivity", "career", "showdev"] },
];

async function createDevtoDraft(post: PostConfig, body: string, imageUrl: string): Promise<{ id: number; url: string }> {
  const response = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "api-key": DEVTO_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      article: {
        title: post.title,
        body_markdown: body,
        tags: post.tags,
        published: false,
        main_image: imageUrl,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`dev.to failed for day ${post.day}: ${err}`);
  }

  const data = await response.json() as { id: number; url: string };
  return { id: data.id, url: data.url };
}

async function createHashnodeDraft(post: PostConfig, body: string, imageUrl: string): Promise<{ id: string; url: string }> {
  const response = await fetch("https://gql.hashnode.com/", {
    method: "POST",
    headers: {
      Authorization: HASHNODE_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation PublishPost($input: PublishPostInput!) {
        publishPost(input: $input) { post { id url } }
      }`,
      variables: {
        input: {
          title: post.title,
          contentMarkdown: body,
          publicationId: HASHNODE_PUB_ID,
          coverImageOptions: { coverImageURL: imageUrl },
          tags: post.tags.slice(0, 5).map(t => ({ slug: t, name: t })),
        },
      },
    }),
  });

  const data = await response.json() as {
    data?: { publishPost: { post: { id: string; url: string } } };
    errors?: Array<{ message: string }>;
  };

  if (data.errors) {
    throw new Error(`Hashnode failed for day ${post.day}: ${data.errors[0]?.message}`);
  }

  const p = data.data!.publishPost.post;
  return { id: p.id, url: p.url };
}

async function main() {
  if (!DEVTO_KEY || !HASHNODE_TOKEN) {
    console.error("Set DEVTO_API_KEY and HASHNODE_TOKEN env vars");
    process.exit(1);
  }

  console.log("Creating drafts for 15 posts...\n");

  for (const post of POSTS) {
    const dayStr = String(post.day).padStart(2, "0");
    const mdPath = resolve(THIS_DIR, `posts/day-${dayStr}.md`);
    const raw = readFileSync(mdPath, "utf-8");
    // Skip first line (title) and blank line
    const body = raw.split("\n").slice(2).join("\n");
    const imageUrl = `${BASE_IMAGE_URL}/day-${dayStr}.png`;

    console.log(`Day ${post.day}: ${post.title.slice(0, 50)}...`);

    try {
      const devto = await createDevtoDraft(post, body, imageUrl);
      console.log(`  dev.to: draft #${devto.id}`);
    } catch (e) {
      console.error(`  dev.to ERROR: ${e}`);
    }

    try {
      const hn = await createHashnodeDraft(post, body, imageUrl);
      console.log(`  hashnode: ${hn.url}`);
    } catch (e) {
      console.error(`  hashnode ERROR: ${e}`);
    }

    // Rate limit: 2 calls per post, keep under 5/sec
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\nDone! All drafts created.");
}

main();
