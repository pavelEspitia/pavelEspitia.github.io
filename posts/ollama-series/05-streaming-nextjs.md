---
title: "Streaming Ollama Responses in Next.js: The SSE Pattern That Actually Works"
tags: ["ai", "ollama", "nextjs", "tutorial"]
publish: true
---

# Streaming Ollama Responses in Next.js: The SSE Pattern That Actually Works

Most Next.js + Ollama tutorials show a single `await fetch` and call it a day. The user types a question, waits eight seconds, and a wall of text appears. That's a bad UX.

Real LLM apps stream tokens as they're generated. The user sees a response materialise word by word, just like ChatGPT. This post shows how to build that on Next.js 15 App Router with Ollama as the backend, using Server-Sent Events. Production-ready in under a hundred lines.

## Why SSE and not WebSocket

The tradeoffs:

| | SSE | WebSocket |
|---|---|---|
| One-way (server → client) | ✓ | also bi-directional |
| Auto-reconnect built in | ✓ | implement yourself |
| Plain HTTP, no upgrade | ✓ | requires upgrade handshake |
| Works through proxies | ✓ | sometimes blocked |
| Streaming overhead | minimal | small frame overhead |

For LLM streaming, you only need server → client. SSE wins on simplicity. WebSocket is overkill until you need bidirectional streaming (voice, real-time collaboration, tool-call dialogues).

## The architecture

```
Browser → /api/chat (Next.js Route Handler) → Ollama (localhost:11434)
                ↑
                emits SSE chunks back to the browser as Ollama produces tokens
```

Three pieces:

1. **Server route** — pipes Ollama's stream into the response.
2. **Client hook** — reads the stream and updates state.
3. **UI** — renders the materialising text.

## Server: the route handler

`app/api/chat/route.ts`:

```typescript
export async function POST(request: Request) {
  const { message } = await request.json();

  const ollama = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:7b",
      messages: [{ role: "user", content: message }],
      stream: true,
    }),
  });

  if (!ollama.ok || !ollama.body) {
    return new Response("upstream error", { status: 502 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = ollama.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.message?.content) {
                const sseChunk = `data: ${JSON.stringify({
                  delta: obj.message.content,
                })}\n\n`;
                controller.enqueue(encoder.encode(sseChunk));
              }
              if (obj.done) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
                );
              }
            } catch {
              // ignore non-JSON lines
            }
          }
        }
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

Two details that matter:

- **`stream: true`** in the Ollama call. Without it, Ollama returns one big response after the whole generation finishes.
- **`X-Accel-Buffering: no`** header. If you deploy behind nginx or a CDN that buffers responses, this disables it for SSE specifically. Without it, you'll see chunks arrive in a burst at the end.

## Client: the hook

```typescript
import { useState } from "react";

export function useChatStream() {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(message: string) {
    setResponse("");
    setLoading(true);

    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!r.body) {
      setLoading(false);
      return;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = JSON.parse(line.slice(6));
        if (json.delta) {
          setResponse((prev) => prev + json.delta);
        }
        if (json.done) {
          setLoading(false);
        }
      }
    }
  }

  return { response, loading, send };
}
```

That's it for the streaming logic. Calling `send("hello")` updates `response` token by token.

## UI: the chat box

```tsx
"use client";
import { useState } from "react";
import { useChatStream } from "./useChatStream";

export default function Chat() {
  const [input, setInput] = useState("");
  const { response, loading, send } = useChatStream();

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="min-h-[200px] p-4 border rounded whitespace-pre-wrap">
        {response || (loading ? "thinking..." : "ask me anything")}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-3 py-2 border rounded"
          placeholder="Ask Ollama..."
        />
        <button
          type="submit"
          disabled={loading || !input}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

Run `pnpm dev`, hit the page, and watch tokens appear in real time.

## Production-grade additions

The skeleton above works locally. To ship it:

- **Authentication.** Add an auth check in the route handler before opening the upstream stream. Otherwise anyone with your URL can burn your local CPU.
- **Conversation history.** The handler above takes a single message. Real chat sends the full history each time. Pass `messages: ChatMessage[]` and forward to Ollama.
- **Cancellation.** When the user navigates away, abort the upstream fetch. Pass an `AbortController.signal` and call `controller.abort()` on disconnect.
- **Backpressure.** If your client is slow, the controller's queue grows. Use `controller.desiredSize` to detect this and pause reading from Ollama.
- **Vercel deployment.** Edge Runtime works for this pattern but has a 30-second function timeout. For longer generations, use Node Runtime or self-host. Local models running on your dev machine are obviously not callable from Vercel — for production, you'd swap Ollama for a managed inference endpoint.

## Why this matters

Once tokens stream, your local LLM stops feeling like a slow API and starts feeling like a real assistant. The perceived latency goes from "did it crash?" to "natural conversation."

Combined with the function calling and RAG patterns from earlier in this series, this is the third piece of a real local AI stack. Streaming chat over local data with local tools, all on your laptop.

That stack didn't exist as a viable production option two years ago. In 2026 it's a hundred and fifty lines of TypeScript.
