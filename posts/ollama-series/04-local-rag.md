---
title: "Building a Local-Only RAG System with Ollama and TypeScript"
tags: ["ai", "ollama", "typescript", "tutorial"]
publish: true
---

# Building a Local-Only RAG System with Ollama and TypeScript

Most RAG tutorials send your private documents to OpenAI. Here's how to keep them on your laptop.

This post walks through a complete Retrieval-Augmented Generation pipeline that runs entirely on your machine. No API keys, no third-party calls, no monthly bill. Two hundred lines of TypeScript and a single binary.

## What you'll build

A command-line tool that:

1. Indexes a folder of `.md` or `.txt` files into a local vector store.
2. Answers questions about those files using a local LLM.
3. Cites which documents the answer came from.

By the end, you'll be able to point it at your engineering wiki, your personal notes, or your codebase, and ask questions in natural language without anything leaving your machine.

## The stack

- **Ollama** — runs the LLM and the embedding model.
- **`@xenova/transformers`** — fallback embedding library if you don't want a second Ollama model.
- **`sqlite-vec`** — SQLite extension that adds vector similarity search. Tiny, fast, no separate database server.
- **TypeScript + Node 22** — gluing it together.

Why SQLite over Chroma or Qdrant? For collections under a million chunks, SQLite is faster, simpler to deploy, and doesn't need a daemon. Your "vector database" is one file.

## Setup

```bash
ollama pull nomic-embed-text       # the embedding model
ollama pull qwen2.5:7b             # the answer model
```

```bash
pnpm add better-sqlite3 sqlite-vec
```

## Step 1: chunk and embed documents

```typescript
import fs from "node:fs";
import path from "node:path";

function chunk(text: string, size = 800, overlap = 100): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buffer = "";
  for (const s of sentences) {
    if ((buffer + " " + s).length > size && buffer) {
      chunks.push(buffer.trim());
      buffer = buffer.slice(-overlap) + " " + s;
    } else {
      buffer = buffer ? buffer + " " + s : s;
    }
  }
  if (buffer) chunks.push(buffer.trim());
  return chunks;
}

async function embed(text: string): Promise<number[]> {
  const r = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });
  const json = await r.json();
  return json.embedding;
}
```

`nomic-embed-text` returns 768-dimensional vectors. Fast enough that you can re-index a thousand-document corpus in a few minutes.

## Step 2: store in SQLite

```typescript
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

const db = new Database("rag.db");
sqliteVec.load(db);

db.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    content TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
    id INTEGER PRIMARY KEY,
    embedding FLOAT[768]
  );
`);

async function indexFile(filePath: string) {
  const text = fs.readFileSync(filePath, "utf8");
  const pieces = chunk(text);
  for (const piece of pieces) {
    const insertChunk = db.prepare(
      "INSERT INTO chunks (source, content) VALUES (?, ?)"
    );
    const result = insertChunk.run(filePath, piece);
    const vec = await embed(piece);
    db.prepare(
      "INSERT INTO vec_chunks (id, embedding) VALUES (?, ?)"
    ).run(result.lastInsertRowid, JSON.stringify(vec));
  }
}
```

## Step 3: search

```typescript
async function search(query: string, k = 4) {
  const queryVec = await embed(query);
  const rows = db.prepare(`
    SELECT chunks.source, chunks.content, vec_chunks.distance
    FROM vec_chunks
    JOIN chunks ON chunks.id = vec_chunks.id
    WHERE vec_chunks.embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `).all(JSON.stringify(queryVec), k) as Array<{
    source: string;
    content: string;
    distance: number;
  }>;
  return rows;
}
```

`MATCH` triggers `sqlite-vec`'s cosine similarity. Sub-millisecond on small corpora.

## Step 4: ask the LLM

```typescript
async function ask(question: string) {
  const matches = await search(question, 4);

  const context = matches
    .map((m, i) => `[${i + 1}] ${m.source}\n${m.content}`)
    .join("\n\n---\n\n");

  const prompt = `Answer the question using only the context provided.
If the answer is not in the context, say so.
Cite sources by their number in square brackets.

CONTEXT:
${context}

QUESTION: ${question}

ANSWER:`;

  const r = await fetch("http://localhost:11434/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: "qwen2.5:7b",
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });
  const json = await r.json();
  return {
    answer: json.choices[0].message.content,
    sources: matches.map((m) => m.source),
  };
}
```

## Putting it together

```typescript
// Index a folder
const files = fs.readdirSync("./notes").map((f) => path.join("./notes", f));
for (const f of files) await indexFile(f);

// Ask
const result = await ask("What did we decide about the auth refactor?");
console.log(result.answer);
console.log("Sources:", result.sources);
```

Total runtime, indexing 500 markdown files: about three minutes on an M2 MacBook. Per-question latency: under two seconds.

## Where this matters

If your team's documentation has grown past the point where anyone reads it cover to cover (about a hundred pages), local RAG turns that wiki back into something useful. Same applies to:

- Codebases — answer "where is the rate limiter implemented?"
- Customer support archives — answer "what's our refund policy?"
- Research notes — answer "what did I write about X six months ago?"
- Legal documents — answer "what does our MSA say about indemnification?"

Last bullet matters: every legal-tech startup right now is building a cloud version of this. Yours runs on your laptop.

## Tuning that actually pays off

- **Chunk size 800-1200 chars** is the sweet spot. Smaller chunks lose context. Larger ones dilute relevance.
- **Overlap 10-15 percent** of chunk size catches sentences split mid-thought.
- **Re-rank top-k with a cross-encoder** if precision matters more than speed. Adds 100ms but often jumps relevance from 70 to 90 percent.
- **Cache embeddings** keyed by content hash so re-indexing is incremental.

## What's next

The previous post in this series covered function calling. Combining function calling with RAG gives you a local agent that can read your documents and take actions: "draft an email to legal summarising what our MSA says about data residency" — read MSA chunks, compose draft, call the email tool.

That's a real assistant. And nothing leaves your machine.

Next post: streaming Ollama responses through Server-Sent Events in Next.js, the production pattern for live UIs.
