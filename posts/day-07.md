Building a Real-Time Progress Bar with Server-Sent Events in Next.js

When spectr-ai analyzes a smart contract, it's not instant. The LLM needs time to reason through the code, identify vulnerabilities, and generate structured output. That analysis can take 10-30 seconds depending on the model and contract size. Staring at a spinner for 30 seconds feels broken. Users need to see progress.

I considered WebSockets, but they're overkill for this. The communication is one-directional — the server sends progress updates, the client displays them. That's exactly what Server-Sent Events (SSE) are designed for.

## Why SSE Over WebSockets

WebSockets give you a full-duplex communication channel. Both sides can send messages at any time. That's powerful, but it comes with complexity: connection management, heartbeats, reconnection logic, and a separate protocol that doesn't play well with HTTP middleware.

SSE is simpler. It's a standard HTTP response with `Content-Type: text/event-stream`. The server writes events. The client reads them. The browser handles reconnection automatically. It works through every proxy, load balancer, and CDN that supports HTTP.

For progress updates where only the server needs to push data, SSE is the right choice.

## The Server: A Streaming API Route

In Next.js App Router, you can return a `ReadableStream` from a route handler. Here's the analysis endpoint that streams progress events:

```typescript
// app/api/analyze/route.ts
import { NextRequest } from "next/server";

interface ProgressEvent {
  step: string;
  progress: number;
  message: string;
}

interface CompleteEvent {
  step: "complete";
  progress: 100;
  result: AuditResult;
}

type AnalyzeEvent = ProgressEvent | CompleteEvent;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return Response.json(
      { error: "No file provided" },
      { status: 400 },
    );
  }

  const contract = await file.text();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(event: AnalyzeEvent) {
        const data = JSON.stringify(event);
        controller.enqueue(
          encoder.encode(`data: ${data}\n\n`),
        );
      }

      try {
        sendEvent({
          step: "parsing",
          progress: 10,
          message: "Parsing contract...",
        });

        const parsed = parseContract(contract);

        sendEvent({
          step: "analyzing",
          progress: 30,
          message: `Analyzing ${parsed.name} with ${provider.model}...`,
        });

        const raw = await provider.analyze(
          SYSTEM_PROMPT,
          contract,
        );

        sendEvent({
          step: "validating",
          progress: 70,
          message: "Validating results...",
        });

        const result = parseAuditResult(raw);

        sendEvent({
          step: "formatting",
          progress: 90,
          message: "Formatting report...",
        });

        sendEvent({
          step: "complete",
          progress: 100,
          result,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Analysis failed";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ step: "error", message })}\n\n`,
          ),
        );
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
    },
  });
}
```

Each event follows the SSE format: `data: <json>\n\n`. The double newline is the event delimiter. The `Cache-Control: no-cache` header prevents proxies from buffering the stream. The `Connection: keep-alive` header keeps the connection open for the duration of the analysis.

## The Client: Reading the Stream

The browser's `EventSource` API is designed for SSE, but it only supports GET requests. Since the analysis endpoint is a POST (it receives a file upload), we use the `fetch` API to read the stream directly:

```typescript
async function analyzeContract(
  file: File,
  onProgress: (event: AnalyzeEvent) => void,
): Promise<AuditResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: AuditResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    // Keep the last incomplete chunk in the buffer
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;

      const json = dataLine.slice(6); // Remove "data: " prefix
      const parsed = JSON.parse(json) as AnalyzeEvent;

      onProgress(parsed);

      if (parsed.step === "complete") {
        finalResult = parsed.result;
      }
      if (parsed.step === "error") {
        throw new Error(parsed.message);
      }
    }
  }

  if (!finalResult) {
    throw new Error("Stream ended without result");
  }

  return finalResult;
}
```

The buffer handling is the tricky part. The stream delivers chunks of arbitrary size — a chunk might contain half an event, one event, or three events. By splitting on `\n\n` and keeping the last (possibly incomplete) chunk, you correctly parse events regardless of chunk boundaries.

## The React Component

```tsx
"use client";

import { useState, useCallback } from "react";

interface ProgressState {
  step: string;
  progress: number;
  message: string;
}

function UploadZone() {
  const [progress, setProgress] =
    useState<ProgressState | null>(null);
  const [result, setResult] =
    useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setProgress(null);
    setResult(null);
    setError(null);

    try {
      const auditResult = await analyzeContract(
        file,
        (event) => {
          if (event.step !== "complete") {
            setProgress({
              step: event.step,
              progress: event.progress,
              message: event.message,
            });
          }
        },
      );
      setResult(auditResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error",
      );
    } finally {
      setProgress(null);
    }
  }, []);

  return (
    <div>
      <FileDropzone onFile={handleFile} />

      {progress && (
        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="mt-1 h-2 rounded bg-gray-200">
            <div
              className="h-full rounded bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {result && <AuditReport result={result} />}
    </div>
  );
}
```

The `transition-all duration-500 ease-out` on the progress bar is what makes it feel smooth. Without it, the bar jumps from 10% to 30% to 70% in discrete steps. With the CSS transition, it animates between values, giving the impression of continuous progress even though the server only sends a handful of events.

## Gotchas

**Vercel's streaming timeout.** On Vercel's Hobby plan, serverless functions time out at 10 seconds. Pro plan gives you 60 seconds. For long-running LLM analysis, you might need Vercel Functions with `maxDuration` set, or a separate backend.

**Buffering by reverse proxies.** Some proxies (nginx, Cloudflare) buffer responses by default. The `X-Accel-Buffering: no` header disables nginx buffering. Cloudflare respects `Cache-Control: no-cache` for SSE.

**Error after partial stream.** If the server errors after sending some events, the response already has a 200 status code. You can't change it. Handle errors as events in the stream, not as HTTP status codes.

**Browser connection limits.** Browsers limit concurrent connections per domain (typically 6 for HTTP/1.1). Each SSE connection counts. This rarely matters for single-user tools, but keep it in mind for dashboards with multiple streams.

SSE is one of those underused web APIs that solves a specific problem well. For progress tracking in AI-powered tools — where the server does heavy work and the client waits — it's the simplest path from "loading spinner" to "real-time feedback."
