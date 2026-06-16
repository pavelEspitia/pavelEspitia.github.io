---
title: "Streaming Claude to the Browser With Backpressure That Actually Works"
tags: ["ai", "typescript", "webdev", "tutorial"]
publish: false
---

Streaming LLM tokens to a browser is easy to get 80% right and surprisingly easy to get the last 20% wrong. The naive version works on your machine and falls apart under a flaky connection or a fast model. Here is the production-grade setup I use, including the part most tutorials skip: what happens when the client cannot keep up with the stream.

## The server: a ReadableStream over the SDK stream

In a Next.js route handler, you return a `ReadableStream` that pipes Claude's stream events out as Server-Sent Events:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const llm = client.messages.stream({
        model: "claude-opus-4-8",
        max_tokens: 64000, // streaming, so give it room
        thinking: { type: "adaptive" },
        messages: [{ role: "user", content: prompt }],
      });

      try {
        for await (const event of llm) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream failed";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // stop nginx from buffering the stream
    },
  });
}
```

The `X-Accel-Buffering: no` header is the one people forget. Without it, nginx buffers your stream and the user sees nothing until the whole response is done, which defeats the entire point of streaming.

## The part tutorials skip: the client aborts mid-stream

Here is the failure mode that does not show up in a demo. The user navigates away, or closes the tab, or their connection drops, *while the model is still generating*. On the server, your `for await` loop keeps pulling tokens from Claude, paying for output you are throwing into a closed pipe.

The fix is to wire the request's abort signal through to the Claude stream so that when the client disconnects, you stop generating:

```typescript
export async function POST(request: Request) {
  const { prompt } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const llm = client.messages.stream(
        {
          model: "claude-opus-4-8",
          max_tokens: 64000,
          messages: [{ role: "user", content: prompt }],
        },
        { signal: request.signal }, // abort the SDK stream when the request aborts
      );

      request.signal.addEventListener("abort", () => {
        llm.abort();       // stop pulling tokens
        controller.close();
      });

      // ... same loop as above
    },
  });
  // ...
}
```

Now a disconnected client stops the generation, which stops the bill. On a fast model producing 64K of output, an abandoned stream you keep generating is real money.

## The client: reading the stream with a buffer

On the browser side, `fetch` gives you a readable stream. The trick is that chunks arrive at arbitrary boundaries, so you buffer and split on the SSE delimiter:

```typescript
async function streamCompletion(prompt: string, onToken: (t: string) => void) {
  const controller = new AbortController();
  const res = await fetch("/api/stream", {
    method: "POST",
    body: JSON.stringify({ prompt }),
    signal: controller.signal,
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? ""; // keep the incomplete tail

    for (const evt of events) {
      const line = evt.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      if (data.text) onToken(data.text);
      if (data.error) throw new Error(data.error);
    }
  }

  return controller; // hold this so the UI can abort on unmount
}
```

Return the `AbortController` so a React component can call `controller.abort()` in its cleanup function. That is what propagates the abort all the way back to the server and stops the generation.

## Don't render every token to the DOM

One performance note: a fast model emits tokens faster than the DOM wants to repaint. Updating React state on every single token thrashes. Buffer a few tokens (or use `requestAnimationFrame`) and flush in batches. The user cannot read faster than ~10 updates per second anyway, and the UI stays smooth.

## The whole point

The demo version of streaming works because nobody closes the tab and the network is perfect. Production is not that. The two things that separate a real implementation from a tutorial: disable proxy buffering so tokens actually flow, and propagate aborts end to end so an abandoned stream stops costing you money. Get those two right and streaming is genuinely robust. Skip them and it works right up until it matters.
