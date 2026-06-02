---
title: "Streaming LLM Tokens to the Browser: The Production SSE Setup"
tags: ["nextjs","react","ai","typescript"]
publish: false
---

A spinner is a lie. It tells the user something is happening without telling them what. When spectr-ai generates a security report, the LLM produces text token by token over 15 to 40 seconds. If I wait for the full response and then drop it on the page, the user stares at nothing the whole time. If I stream each token as it arrives, the report writes itself in front of them, exactly like ChatGPT. Same wait, completely different feel.

A while back I covered SSE for progress bars: the server sends a handful of `step` and `progress` events, the client moves a bar. This is the token-streaming version. Instead of a few discrete progress events, the server forwards hundreds of text fragments coming out of the model in real time. The transport is the same (Server-Sent Events over a `fetch` stream), but the source, the parsing, and the failure modes are different.

Here is the full production setup: a Next.js 15 Route Handler that consumes the model's own stream and re-emits it, a client reader that renders tokens as they land, and the cancellation and error handling you actually need when the thing runs for 40 seconds.

## Why Not Just `EventSource`

The browser's `EventSource` is the obvious tool for SSE, and it handles reconnection for free. But it only does GET requests. spectr-ai sends a POST with the contract source and the chosen model in the body, so `EventSource` is out. We read the response stream by hand with `fetch` and `response.body.getReader()`. That is also what gives us an `AbortController` to cancel, which `EventSource` does not expose cleanly.

| Need | `EventSource` | `fetch` + reader |
|------|---------------|------------------|
| POST with a body | No | Yes |
| Custom headers (auth) | No | Yes |
| Manual cancellation | Awkward | `AbortController` |
| Auto-reconnect | Yes | You write it |

For a one-shot LLM request you do not want auto-reconnect anyway. A reconnect would restart the generation and bill you twice.

## The Source: Consuming the Model's Stream

Both Ollama and Claude can stream. Ollama exposes an OpenAI-compatible endpoint at `/v1/chat/completions`, and with `stream: true` it returns SSE lines of its own: `data: {json}\n\n`, ending with `data: [DONE]`. So the server is doing two things at once: it is an SSE client (reading the model) and an SSE server (writing to the browser).

Here is the helper that turns the model's HTTP stream into an async iterator of plain text deltas:

```typescript
// lib/stream-model.ts
interface ChatChunk {
  choices: { delta: { content?: string } }[];
}

export async function* streamModel(
  prompt: string,
  contract: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(
    "http://localhost:11434/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model: "qwen2.5-coder:7b",
        stream: true,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: contract },
        ],
      }),
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(`Model request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const payload = trimmed.slice(6);
      if (payload === "[DONE]") return;

      const chunk = JSON.parse(payload) as ChatChunk;
      const token = chunk.choices[0]?.delta?.content;
      if (token) yield token;
    }
  }
}
```

The buffer logic is the same idea as the client reader in the progress-bar post: a TCP chunk does not respect message boundaries. One `read()` might give you half a `data:` line. Splitting on `\n` and holding the last fragment until the next read keeps you from trying to `JSON.parse` a truncated object.

For Claude the shape differs (the Anthropic SDK gives you a typed `stream` you can `for await` over, with `content_block_delta` events), but the contract from the server's point of view is identical: an async generator of text deltas. Swap the body of `streamModel` and the rest of this post does not change.

## The Server: A Route Handler That Re-emits Tokens

Now wrap that generator in a `ReadableStream` and return it from a Route Handler. Each token becomes its own SSE event so the client can render it immediately.

```typescript
// app/api/report/route.ts
import { NextRequest } from "next/server";
import { streamModel } from "@/lib/stream-model";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TokenEvent {
  type: "token";
  text: string;
}
interface DoneEvent {
  type: "done";
}
interface ErrorEvent {
  type: "error";
  message: string;
}
type ReportEvent = TokenEvent | DoneEvent | ErrorEvent;

export async function POST(request: NextRequest) {
  const { contract } = (await request.json()) as { contract: string };

  if (!contract?.trim()) {
    return Response.json({ error: "No contract" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: ReportEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }

      try {
        for await (const token of streamModel(
          SYSTEM_PROMPT,
          contract,
          request.signal,
        )) {
          send({ type: "token", text: token });
        }
        send({ type: "done" });
      } catch (err) {
        if (request.signal.aborted) return; // client left, stay quiet
        const message =
          err instanceof Error ? err.message : "Generation failed";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

Three things here earn their keep.

1. **`request.signal` flows all the way through.** When the browser aborts, Next.js aborts `request.signal`, which I pass into `streamModel`, which passes it to the model `fetch`. Hitting stop in the UI actually stops the model from generating. No orphaned 40-second jobs burning a GPU.

2. **`no-transform` and `X-Accel-Buffering: no`.** These are the anti-buffering headers. `no-transform` tells proxies not to gzip-buffer the body, and `X-Accel-Buffering: no` disables nginx's response buffer. Without them, a proxy can hold your tokens and flush them all at once at the end, which defeats the entire point. This matters far more for token streaming than for progress bars, because tokens arrive every few milliseconds and any buffer is instantly visible.

3. **`runtime = "nodejs"` and `maxDuration`.** Token generation is long. On Vercel the default function timeout will cut you off mid-report. Set `maxDuration` and budget for the slowest model you support.

## Backpressure: Respecting the Reader

`ReadableStream` has built-in backpressure. When you call `controller.enqueue`, the data goes into an internal queue. If the client reads slower than the model produces (a slow network, a backgrounded tab), that queue fills, and `controller.desiredSize` drops at or below zero.

For text tokens the volume is small enough that you rarely need to act on it, but if you are also streaming large structured chunks, you can await space before enqueuing more:

```typescript
async function backpressuredSend(
  controller: ReadableStreamDefaultController,
  bytes: Uint8Array,
) {
  controller.enqueue(bytes);
  // Yield to let the consumer drain if the queue is full.
  if ((controller.desiredSize ?? 1) <= 0) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
```

The bigger backpressure win is the abort signal above. The single most expensive thing you can do is keep generating tokens for a client that has already navigated away. Cancellation is backpressure taken to its limit: the consumer is gone, so produce nothing.

## The Client: Reading and Rendering Tokens

The reader mirrors the progress-bar client, with one change: instead of replacing a progress value, we append each token to accumulated text.

```typescript
// lib/read-report.ts
type ReportEvent =
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function streamReport(
  contract: string,
  onToken: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contract }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;

      const parsed = JSON.parse(dataLine.slice(6)) as ReportEvent;

      if (parsed.type === "token") onToken(parsed.text);
      if (parsed.type === "error") throw new Error(parsed.message);
      if (parsed.type === "done") return;
    }
  }
}
```

And the React component. The trick that makes this feel fast is appending to a ref and flushing to state, so hundreds of rapid token updates do not trigger hundreds of re-render storms fighting each other:

```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { streamReport } from "@/lib/read-report";

export function ReportView({ contract }: { contract: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] =
    useState<"idle" | "streaming" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText("");
    setError(null);
    setStatus("streaming");

    try {
      await streamReport(
        contract,
        (token) => setText((prev) => prev + token),
        controller.signal,
      );
      setStatus("done");
    } catch (err) {
      if (controller.signal.aborted) return; // user cancelled
      setError(err instanceof Error ? err.message : "Stream failed");
      setStatus("error");
    }
  }, [contract]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={start} disabled={status === "streaming"}>
          Generate report
        </button>
        {status === "streaming" && (
          <button onClick={stop}>Stop</button>
        )}
      </div>

      <pre className="mt-4 whitespace-pre-wrap font-mono text-sm">
        {text}
        {status === "streaming" && (
          <span className="animate-pulse">▍</span>
        )}
      </pre>

      {error && (
        <div className="mt-4 rounded bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
```

The blinking `▍` cursor while `status === "streaming"` costs nothing and sells the live feel. The `whitespace-pre-wrap` on a `pre` preserves the model's markdown spacing until you are ready to run it through a markdown renderer at the end.

## The Failure Modes That Actually Bite

**Errors after a 200.** This is the same trap as the progress-bar post, sharper here. The moment you return the `Response`, the status is 200 and frozen. If the model dies at token 300, you cannot send a 500. You send an `error` event inside the stream and the client throws on it. Any error handling that relies on HTTP status codes is dead the instant the first byte ships.

**Cancellation is two-sided.** The client aborts, but the server has to notice. That is why `request.signal` is threaded into every `fetch`. I also guard `if (controller.signal.aborted) return` on the client so a deliberate stop does not flash a scary error message.

**Half-tokens across chunk boundaries.** A `data:` line can be split across two TCP reads on both the server-to-model side and the browser side. Both readers use the same split-and-hold-the-tail buffer. Skip it and you get random `JSON.parse` crashes under load that you will never reproduce locally on localhost.

**Proxy buffering eats the effect.** If tokens arrive in one big clump at the end, your headers are wrong. Check `no-transform` and `X-Accel-Buffering: no`, and confirm nothing in front of the app (a CDN, a dev proxy) is re-buffering.

## Takeaway

Progress bars and token streams ride the same SSE rails, but token streaming raises the stakes: you are now an SSE client and server at once, buffering bugs become visible at millisecond resolution, and cancellation has to reach all the way to the model or you pay for work nobody will read. Thread one `AbortController` from the button to the model `fetch`, set the anti-buffering headers, and parse with a tail buffer on both ends. That is the whole production setup.

It is running in spectr-ai right now: paste a contract, watch the security report write itself token by token, hit stop and the GPU stops with it. Code is on GitHub: https://github.com/pavelEspitia/spectr-ai
