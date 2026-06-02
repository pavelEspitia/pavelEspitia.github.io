---
title: "Type-Safe API Clients in TypeScript Without a Code Generator"
tags: ["typescript","webdev","api","programming"]
publish: false
---

You call an external API, get back JSON, and write `const user = await res.json() as User`. TypeScript nods along. Autocomplete works. Everything looks safe.

It is not safe. That `as User` is a lie you told the compiler. At runtime, `res.json()` returns `any`, and the cast tells TypeScript to stop checking. If the API renames a field, adds a null, or returns an error envelope instead of the object you expected, your types still claim everything is fine. The bug surfaces three function calls later, where the stack trace is useless.

The network boundary is exactly where you should trust nothing, and it is the one place most TypeScript code trusts blindly. You can fix this without openapi-typescript-codegen, without a build step, and without committing a 4000-line generated client into your repo. Here is the lightweight approach I use.

## The Problem With `as`

A type assertion is not a check. It is a promise you make to the compiler that you cannot keep.

```typescript
interface User {
  id: number;
  email: string;
  createdAt: string;
}

async function getUser(id: number): Promise<User> {
  const res = await fetch(`https://api.example.com/users/${id}`);
  return (await res.json()) as User; // a lie
}
```

Three things go wrong here and none of them are caught:

| What happens | What TypeScript thinks | What you get |
|---|---|---|
| API returns `{ "error": "not found" }` | `User` | `user.email` is `undefined` at runtime |
| API renames `createdAt` to `created_at` | `User` | silent `undefined`, no error until much later |
| `res.json()` parses to `null` | `User` | `Cannot read property 'id' of null` |

The cast is structurally identical to writing `const user: User = null as any`. You have told the type checker to look away at the precise moment you most needed it watching.

## The Schema Is the Source of Truth

Instead of declaring a type and asserting reality matches it, declare a schema and verify reality at the boundary. This is "parse, don't validate": you take untyped input and either get a typed value out the other side or a clear failure. There is no in-between state where you have an `any` pretending to be a `User`.

I use Zod. Define the shape once, derive the TypeScript type from it.

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  createdAt: z.coerce.date(),
});

type User = z.infer<typeof UserSchema>;
```

That `z.infer` is the whole point. Your runtime validation and your static type come from the same declaration, so they can never drift. There is no generated file to regenerate, no `make codegen` to forget. The schema is both the validator and the type.

## A Generic `apiFetch` Wrapper

Now wrap `fetch` so that every response passes through a schema before it reaches your code. The wrapper takes a URL and the schema for the expected body, and returns a value that is genuinely the shape it claims to be.

```typescript
async function apiFetch<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    throw new ApiError(res.status, `Request failed: ${res.status} ${res.statusText}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, "Response was not valid JSON");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ApiError(res.status, `Response did not match schema:\n${issues}`);
  }

  return parsed.data;
}
```

The signature carries the safety. `body` starts as `unknown`, the most honest type for "data from the network." It only becomes `T` after `safeParse` confirms it. There is no path through this function that returns an unvalidated value typed as `T`.

Call it with a real public API, the GitHub REST endpoint:

```typescript
const RepoSchema = z.object({
  full_name: z.string(),
  stargazers_count: z.number().int(),
  language: z.string().nullable(),
  pushed_at: z.coerce.date(),
});

const repo = await apiFetch(
  "https://api.github.com/repos/colinhacks/zod",
  RepoSchema,
);

console.log(repo.full_name, repo.stargazers_count);
//          string         number, both verified at runtime
```

If GitHub ever changes `stargazers_count` to a string, you find out at the boundary with a precise message, not in some chart component that silently renders `NaN`.

## Errors as Values, Not Exceptions

Throwing works, but it pushes error handling off into a `try/catch` somewhere else and erases the error type. A discriminated union makes failure part of the return type, so the compiler forces every caller to handle it.

```typescript
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

Rewrite the wrapper to return a `Result` instead of throwing:

```typescript
async function apiFetch<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: new ApiError(0, "Network request failed") };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: new ApiError(res.status, `Request failed: ${res.status}`),
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: new ApiError(res.status, "Invalid JSON") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: new ApiError(res.status, parsed.error.message),
    };
  }

  return { ok: true, data: parsed.data };
}
```

Now the call site cannot ignore failure. TypeScript narrows `data` only inside the `ok: true` branch:

```typescript
const result = await apiFetch(
  "https://api.github.com/repos/colinhacks/zod",
  RepoSchema,
);

if (!result.ok) {
  console.error(`Failed (${result.error.status}): ${result.error.message}`);
  return;
}

// result.data is User here, and the compiler knows it
console.log(result.data.full_name);
```

This is the same shape Zod's own `safeParse` returns, and the same shape Rust's `Result` and Go's `(value, err)` give you. Failure stops being an invisible control-flow jump and becomes a value you have to look at.

## Typed Query Params

The other place lies creep in is the query string. Hand-building `?status=open&limit=10` with string concatenation invites typos and forgotten `encodeURIComponent`. Validate params with a schema too, then serialize them in one place.

```typescript
function buildUrl<T extends z.ZodRawShape>(
  base: string,
  schema: z.ZodObject<T>,
  params: z.infer<z.ZodObject<T>>,
): string {
  const validated = schema.parse(params);
  const url = new URL(base);

  for (const [key, value] of Object.entries(validated)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}
```

Define the allowed params per endpoint, and the call site gets autocomplete plus rejection of anything you did not declare:

```typescript
const IssueQuerySchema = z.object({
  state: z.enum(["open", "closed", "all"]),
  per_page: z.number().int().min(1).max(100),
});

const url = buildUrl(
  "https://api.github.com/repos/colinhacks/zod/issues",
  IssueQuerySchema,
  { state: "open", per_page: 30 },
);
// passing { state: "opne" } is a compile error, not a runtime 422
```

`URL` and `URLSearchParams` handle the encoding so you never hand-escape a value again.

## When a Code Generator IS Worth It

This approach is not a rule against codegen. It is the right default for a specific situation. Here is the line I draw.

| Reach for this lightweight approach when | Reach for codegen (openapi-typescript, etc.) when |
|---|---|
| You call a handful of endpoints | You consume hundreds of endpoints |
| The API has no OpenAPI spec, or a bad one | The API ships an accurate, maintained spec |
| You want runtime validation, not just types | You only need static types and trust the server |
| Schemas double as docs and request validators | Regenerating on every spec change is acceptable overhead |
| You control the shapes you care about | You need full coverage of a large surface you do not own |

Codegen gives you types but usually not runtime validation. Those generated interfaces are still `as`-casts in disguise: the server can lie and nothing checks. If you want the boundary actually defended, you either pair codegen with a validation layer or you write the schemas yourself. For most apps calling a dozen endpoints, the schemas you write are smaller than the client you would generate, and they earn their keep twice as types and as guards.

## What I Learned

1. **A cast is not a check.** `as User` disables exactly the protection you need at the network boundary. Treat it as a code smell anywhere near `fetch`.

2. **Derive types from schemas, never the reverse.** `z.infer` keeps your runtime validation and static types from drifting, with zero generated files.

3. **Parse at the boundary, trust inside.** Untyped data is `unknown` until a schema proves otherwise. After that, the rest of your code can trust its types completely.

4. **Return errors as values.** A `Result` discriminated union makes the compiler force callers to handle failure instead of letting an exception slip past.

5. **Validate query params too.** The query string is part of the boundary. Schema it, then let `URL` do the encoding.

6. **Use codegen for large specs you do not own, not as a reflex.** For most clients, a 30-line wrapper plus a few schemas gives you stronger guarantees than a generated client, because it checks reality at runtime instead of assuming the server keeps its promises.

The whole `apiFetch` wrapper is under 40 lines and you write it once. Every endpoint after that costs one schema. In exchange, the moment an API breaks its contract, you find out at the exact line where the data entered your program, with a message that tells you which field went wrong. That is the trade the `as` cast was quietly stealing from you.
