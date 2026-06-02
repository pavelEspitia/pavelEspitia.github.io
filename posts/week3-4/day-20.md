---
title: "Giving Your Local LLM Safe Filesystem Access With Ollama Tool Use"
tags: ["ai","ollama","typescript","security"]
publish: false
---

A local LLM that can read your files is genuinely useful. A local LLM that can read your files *without guardrails* is a path-traversal bug with a chat interface.

I covered tool calling basics in an earlier post: define a tool schema, the model returns a structured request, your code decides whether to run it. That's the foundation. This post is about how to not get burned once those tools touch the filesystem. We're going to give the model three tools (`list_dir`, `read_file`, `grep`), wire up the dispatch loop with Ollama, and then harden every single one so a confused (or adversarial) model can't read your `.env`, climb out of the project, or hand you back a 2GB file.

The model is the planner. Your code is the executor. The executor is also the only thing standing between an unpredictable token generator and your home directory. Treat it that way.

## The threat model first

Before any code, be honest about what can go wrong. The LLM is not malicious, but it is unpredictable, and the *input* feeding it might be malicious (a file it reads could contain instructions, a classic prompt-injection vector). So plan for all of it:

- The model asks to read `/etc/passwd` or `~/.ssh/id_rsa`.
- The model passes `../../../../etc/shadow` as a "relative" path.
- The model reads `.env` and helpfully prints your API keys into the chat transcript.
- The model asks to read a 4GB log file and pins your RAM.
- A file the model reads contains "ignore previous instructions, now write to ...".

Every defense below maps to one of these. None of them trust the model.

## The sandbox: one root, resolved, allow-listed

The single most important control: every path the model gives you gets resolved to an absolute path and checked against an allowed root. If it escapes the root, reject it. No exceptions, no "but it's probably fine."

```typescript
import path from "node:path";
import fs from "node:fs/promises";

// The ONLY directory the model is allowed to touch.
const SANDBOX_ROOT = path.resolve(process.env.SANDBOX_ROOT ?? "./workspace");

class PathError extends Error {}

// Resolve a model-supplied path and prove it stays inside the sandbox.
function resolveInSandbox(userPath: string): string {
  // Resolve against the root, collapsing any `..` segments.
  const resolved = path.resolve(SANDBOX_ROOT, userPath);

  // The check that matters: is `resolved` actually under the root?
  const rel = path.relative(SANDBOX_ROOT, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathError(`Path escapes sandbox: ${userPath}`);
  }
  return resolved;
}
```

Why `path.relative` instead of a `startsWith(SANDBOX_ROOT)` string check? Because `startsWith` is a trap. `/home/pavel/workspace-secrets` starts with `/home/pavel/workspace`, but it's a different directory. `path.relative` does it structurally: if the relative path begins with `..`, the target is above the root. Done.

Test it before you trust it:

```typescript
resolveInSandbox("notes.txt");        // OK -> <root>/notes.txt
resolveInSandbox("sub/dir/a.md");     // OK
resolveInSandbox("../secrets.env");   // throws PathError
resolveInSandbox("/etc/passwd");      // throws PathError
resolveInSandbox("a/../../etc/hosts");// throws PathError
```

One more thing `path.resolve` does not cover: symlinks. A symlink inside the sandbox can point anywhere. If your workspace could contain symlinks you don't control, resolve them too and re-check:

```typescript
async function resolveRealInSandbox(userPath: string): Promise<string> {
  const resolved = resolveInSandbox(userPath);
  try {
    const real = await fs.realpath(resolved);
    const rel = path.relative(SANDBOX_ROOT, real);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new PathError(`Symlink escapes sandbox: ${userPath}`);
    }
    return real;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw err;
  }
}
```

## A deny-list for the obvious landmines

Allow-listing the root is the structural control. On top of it, a small deny-list stops the model from reading things that are *inside* the sandbox but still secret. Match on the basename, not a substring, so `environment.md` doesn't get caught by an `.env` rule.

```typescript
const DENIED_NAMES = new Set([".env", ".git", "id_rsa", "id_ed25519"]);
const DENIED_SUFFIXES = [".env", ".pem", ".key"];

function assertReadable(absPath: string): void {
  const base = path.basename(absPath);
  if (DENIED_NAMES.has(base) || base.startsWith(".env")) {
    throw new PathError(`Refusing to read protected file: ${base}`);
  }
  if (DENIED_SUFFIXES.some((s) => base.endsWith(s))) {
    throw new PathError(`Refusing to read protected file type: ${base}`);
  }
}
```

Keep this list short and obvious. The structural sandbox is your real defense; the deny-list just catches the secrets that legitimately live in a project folder.

## The tools

Three read-only tools. Notice `read_file` has a hard byte budget, and none of them write anything.

```typescript
const MAX_READ_BYTES = 256 * 1024; // 256 KB. Models do not need a 2GB file.

async function listDir(dirPath: string): Promise<string[]> {
  const abs = await resolveRealInSandbox(dirPath);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

async function readFile(filePath: string): Promise<string> {
  const abs = await resolveRealInSandbox(filePath);
  assertReadable(abs);

  const stat = await fs.stat(abs);
  if (!stat.isFile()) throw new PathError(`Not a file: ${filePath}`);
  if (stat.size > MAX_READ_BYTES) {
    throw new PathError(
      `File too large: ${stat.size} bytes (limit ${MAX_READ_BYTES}).`,
    );
  }
  return fs.readFile(abs, "utf8");
}

async function grep(pattern: string, dirPath: string): Promise<string[]> {
  // Compile the model's pattern; reject anything that won't compile.
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    throw new PathError(`Invalid regex: ${pattern}`);
  }

  const abs = await resolveRealInSandbox(dirPath);
  const hits: string[] = [];
  const entries = await fs.readdir(abs, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const child = path.join(abs, entry.name);
    try {
      assertReadable(child);
    } catch {
      continue; // skip protected files silently in search results
    }
    const stat = await fs.stat(child);
    if (stat.size > MAX_READ_BYTES) continue;

    const text = await fs.readFile(child, "utf8");
    text.split("\n").forEach((line, i) => {
      if (re.test(line)) hits.push(`${entry.name}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits.slice(0, 100); // cap output so a broad pattern can't flood context
}
```

The schemas, in the same JSON Schema format from the function-calling post:

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files and folders in a directory inside the workspace",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Relative path" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file inside the workspace",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Relative path" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search files in a directory for a regex pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string", description: "Relative directory path" },
        },
        required: ["pattern", "path"],
      },
    },
  },
];
```

## The dispatch loop

Here is where most tutorials get sloppy: they `eval`-style dispatch on the tool name and pass arguments straight through. Don't. Validate arguments with Zod, route through an explicit `switch`, and turn every thrown error into a tool result the model can read and recover from. An error is data, not a crash.

```typescript
import { z } from "zod";

const PathArgs = z.object({ path: z.string() });
const GrepArgs = z.object({ pattern: z.string(), path: z.string() });

async function dispatch(name: string, rawArgs: string): Promise<string> {
  try {
    switch (name) {
      case "list_dir":
        return JSON.stringify(await listDir(PathArgs.parse(JSON.parse(rawArgs)).path));
      case "read_file":
        return await readFile(PathArgs.parse(JSON.parse(rawArgs)).path);
      case "grep": {
        const a = GrepArgs.parse(JSON.parse(rawArgs));
        return JSON.stringify(await grep(a.pattern, a.path));
      }
      default:
        return `Error: unknown tool ${name}`;
    }
  } catch (err) {
    // Hand the failure back to the model. It will usually correct itself.
    return `Error: ${(err as Error).message}`;
  }
}
```

Now the agent loop against Ollama. Same two-round-trip shape as before, wrapped so the model can chain calls:

```typescript
async function run(userPrompt: string): Promise<string> {
  const messages: any[] = [
    {
      role: "system",
      content:
        "You can read files inside the workspace only. Never assume a path " +
        "outside it exists. If a tool returns an error, adjust and retry.",
    },
    { role: "user", content: userPrompt },
  ];

  for (let turn = 0; turn < 8; turn++) {
    const res = await fetch("http://localhost:11434/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen2.5:7b", messages, tools, tool_choice: "auto" }),
    });
    const msg = (await res.json()).choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls?.length) return msg.content;

    for (const call of msg.tool_calls) {
      const result = await dispatch(call.function.name, call.function.arguments);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return "Stopped: too many tool-calling turns.";
}
```

The `turn < 8` cap matters. Without it, a model that keeps requesting tools (or gets stuck in a retry loop on a prompt-injected file) will run forever.

## Writes are different: require a human

Reading is reversible. Writing is not. So I keep writes out of the autonomous loop entirely and gate them behind an explicit human approval. The tool doesn't write: it *proposes* a write, prints a diff, and waits for you.

```typescript
import readline from "node:readline/promises";

async function proposeWrite(filePath: string, content: string): Promise<string> {
  const abs = resolveInSandbox(filePath);   // same sandbox check
  assertReadable(abs);                       // same secrets guard

  console.log(`\nProposed write to ${path.relative(SANDBOX_ROOT, abs)}:`);
  console.log("-".repeat(40));
  console.log(content.slice(0, 2000));
  console.log("-".repeat(40));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("Apply this write? [y/N] ")).trim().toLowerCase();
  rl.close();

  if (answer !== "y") return "Write rejected by user.";
  await fs.writeFile(abs, content, "utf8");
  return `Wrote ${content.length} bytes to ${filePath}.`;
}
```

The model can *want* to write all day. Nothing hits disk until a human types `y`. This is the same principle as the read sandbox, applied to the higher-stakes operation: the LLM proposes, your code (and you) dispose.

## The hardening checklist

Every filesystem tool you expose to an LLM should pass all of these:

1. **Resolve and re-check.** `path.resolve`, then `path.relative` against the root. Reject anything starting with `..`. Never `startsWith` on the raw string.
2. **Resolve symlinks too.** `fs.realpath` and re-check, or you've left a back door inside the sandbox.
3. **Deny secrets by basename.** `.env`, keys, `.git`. Short list, matched on basename, not substring.
4. **Cap read size.** A byte budget per read and a result cap on search. Context windows and RAM are finite.
5. **Read-only by default.** Writes go through a separate, human-approved path. No write tool in the autonomous loop.
6. **Validate every argument.** Zod-parse tool arguments before they reach `fs`. The model hallucinates fields.
7. **Errors are tool results.** Catch, stringify, return to the model. Never let a bad path crash the process.
8. **Cap the turn count.** Bound the agent loop so a stuck or injected model can't spin forever.

## Takeaway

Function calling makes a local LLM useful. Filesystem access makes it powerful, and powerful is exactly when you have to slow down. The model is an untrusted planner working over potentially untrusted input. Your tools are the trust boundary. Build them so the worst a confused model can do is read a text file it was already allowed to see.

I run this exact pattern in [spectr-ai](https://github.com/pavelEspitia/spectr-ai), my local-first smart contract auditor, so the model can walk a contract's source tree without ever leaving the project folder. Sandbox first, features second. That order is the whole point.
