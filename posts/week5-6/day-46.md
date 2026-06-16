---
title: "RAG for Code: Why Chunking by Function Beats Chunking by Lines"
tags: ["ai", "typescript", "tutorial", "ollama"]
publish: false
---

I built a retrieval system over a codebase so an LLM could answer questions about it, and my first version was nearly useless. The problem was not the model or the embeddings. It was how I cut the code into chunks. Splitting source by line count shreds the very structure that makes code meaningful. Here is why function-aware chunking works so much better, and how to do it.

## The naive approach and why it fails

The standard RAG tutorial says: split your documents into fixed-size chunks (say 500 tokens), embed each chunk, retrieve the closest ones to the query. For prose, fine. For code, this is destructive.

A 500-token window does not respect function boundaries. You end up with chunks like "the last third of `transfer()` and the first half of `approve()`." Neither function is complete. The embedding represents a fragment that means nothing on its own, and when you retrieve it, you hand the model half a function with no signature and no context.

My early system would confidently answer questions about functions it had only seen the middle of. The retrieval was the bottleneck, and the chunking was the cause.

## Chunk by structure, not by size

Code has natural units: functions, methods, classes, contracts. Those are the units a developer reasons about, so those are the units to chunk by. One function, one chunk. The chunk includes the full signature, the body, and ideally the doc comment above it.

```typescript
interface CodeChunk {
  name: string;        // function or method name
  signature: string;   // full signature for context
  body: string;        // the complete function body
  filePath: string;    // where it lives
  startLine: number;
}
```

Now each chunk is a complete, meaningful thing. Retrieve it and the model gets a whole function it can reason about, with its name and signature intact.

## Extracting functions

For Solidity or TypeScript, you can get a long way with a parser rather than regex. For TypeScript I use the compiler API or a tool like `ts-morph`; for Solidity, a proper parser that gives you the AST. The point is to walk the syntax tree and emit one chunk per function-level node, rather than slicing the raw text.

A simplified shape of the extractor:

```typescript
import { Project } from "ts-morph";

function chunkByFunction(filePath: string): CodeChunk[] {
  const project = new Project();
  const source = project.addSourceFileAtPath(filePath);
  const chunks: CodeChunk[] = [];

  for (const fn of source.getFunctions()) {
    chunks.push({
      name: fn.getName() ?? "anonymous",
      signature: fn.getSignature().getDeclaration()?.getText() ?? "",
      body: fn.getText(),          // the whole function, intact
      filePath,
      startLine: fn.getStartLineNumber(),
    });
  }
  // also walk classes/methods the same way
  return chunks;
}
```

Each function comes out whole. No more half-functions.

## Embedding and retrieval, locally

I run this entirely on a local model so a private codebase never leaves my machine. Ollama serves an embedding model; I embed each function chunk and store the vectors:

```typescript
import { Ollama } from "ollama";
const ollama = new Ollama();

async function embed(text: string): Promise<number[]> {
  const r = await ollama.embeddings({ model: "nomic-embed-text", prompt: text });
  return r.embedding;
}
```

I embed `${chunk.name}\n${chunk.signature}\n${chunk.body}` so the function name and signature are part of the vector, not just the body. That makes name-based queries ("what does `withdraw` do") retrieve well, because the name is in the embedded text.

## The payoff in retrieval quality

After switching to function chunks, the same questions that used to get fragmented, half-wrong answers got crisp ones. "How does this contract handle reentrancy in withdrawals?" now retrieves the *complete* `withdraw` function plus the modifier it uses, and the model can actually reason about the checks-effects-interactions order because it can see the whole thing.

The model did not get smarter. The retrieval got honest. I was handing it complete units of meaning instead of arbitrary text windows.

## A small refinement: include callers

One thing I added later: for a retrieved function, I also pull in the one-line signatures of functions that call it. That gives the model a sense of how the function is used without bloating the chunk. It is cheap context that often answers the follow-up question before it is asked.

## The general lesson

RAG quality is mostly retrieval quality, and retrieval quality is mostly chunking quality. The instinct to chunk by size comes from text-document tutorials, but code is not prose. It has structure, and that structure is exactly what carries the meaning. Chunk along the structure, embed the name and signature with the body, and run it locally if the code is private. The embeddings and the model were never the problem. The scissors were.
