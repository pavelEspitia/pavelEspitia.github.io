---
title: "Building Multi-Tenant RLS in Supabase: Lessons From Shipping Lomi"
tags: ["webdev", "typescript", "security", "tutorial"]
publish: false
---

Lomi is a SaaS for dog kennels in Colombia, and it has two kinds of tenancy at once: each kennel is a tenant with private data, but there is also a public show-dog community where some of that data is shared. Getting that right with Postgres Row Level Security taught me more about RLS than any tutorial. Here is what I learned shipping it, including the bug that would have leaked one kennel's data to another.

## Why RLS instead of filtering in the app

I could have written `WHERE kennel_id = $current` on every query and called it multi-tenant. The problem is that one forgotten `WHERE` clause leaks everything. The security boundary lives in a hundred query sites, and all hundred have to be perfect forever.

RLS moves the boundary into the database. The policy is enforced no matter which query, which endpoint, or which junior developer wrote the code. You cannot accidentally select another tenant's rows, because Postgres filters them out before your query ever sees them. That is the right place for a security boundary: as close to the data as possible, enforced once.

## The basic single-tenant policy

Every table that holds kennel data gets a `kennel_id` and a policy:

```sql
alter table dogs enable row level security;

create policy "kennel members read their dogs"
  on dogs for select
  using (kennel_id = (auth.jwt() ->> 'kennel_id')::uuid);

create policy "kennel members write their dogs"
  on dogs for insert
  with check (kennel_id = (auth.jwt() ->> 'kennel_id')::uuid);
```

The `kennel_id` comes from the JWT, which Supabase signs and the client cannot forge. `using` controls what rows you can read; `with check` controls what rows you can write. You need both. A policy with only `using` will happily let you *insert* a row for another kennel, because `using` does not apply to inserts.

That distinction is the first thing people get wrong, and it is exactly the kind of gap that leaks.

## The dual-scope problem

Here is where Lomi got interesting. A show dog is private to its kennel for management (vet records, breeding notes) but public to the community for the show profile (name, breed, achievements). Same row, two visibility scopes.

My first instinct was one table with a `public` boolean and a clever policy. That got tangled fast, because "public" meant different things for different columns. The vet record should never be public even if the dog is.

The cleaner design was to split the row by scope: a private `dogs` table and a public `show_profiles` table linked by `dog_id`. The kennel owns the `dogs` row. The `show_profiles` row is readable by anyone but writable only by the owning kennel:

```sql
create policy "anyone reads show profiles"
  on show_profiles for select
  using (true);

create policy "only the owning kennel writes show profiles"
  on show_profiles for all
  using (
    dog_id in (
      select id from dogs
      where kennel_id = (auth.jwt() ->> 'kennel_id')::uuid
    )
  );
```

Public read, scoped write. The private vet data lives in a table with no public read policy at all, so it is simply unreachable from the community side.

## The bug that almost leaked everything

In an early version, the public read policy on `show_profiles` used a subquery that joined back to `dogs` to fetch the kennel name for display. That join ran *without* RLS context in one code path, because I was using the service-role key for a "performance" optimization on a public endpoint.

The service-role key bypasses RLS entirely. That is its whole purpose, and it is a loaded gun. My public endpoint, using that key, could read every kennel's private `dogs` row, and a small mistake in the SELECT list would have returned private columns to the public profile.

The fix was a rule I now treat as absolute: the service-role key never touches a request that serves user-facing data. It is for migrations and trusted server jobs only. Every user request, public or private, goes through the anon or authenticated key so RLS applies. I lost the micro-optimization and slept better.

## How I test RLS

RLS bugs are invisible until they leak, so I test them explicitly. For each table I write a test that signs in as kennel A, inserts a row, then signs in as kennel B and asserts the row is invisible:

```typescript
test("kennel B cannot read kennel A's dogs", async () => {
  const a = clientFor(KENNEL_A);
  const { data: created } = await a.from("dogs").insert({ name: "Rex" }).select().single();

  const b = clientFor(KENNEL_B);
  const { data } = await b.from("dogs").select().eq("id", created.id);

  expect(data).toEqual([]); // B sees nothing, not an error, just zero rows
});
```

The key detail: a blocked read returns *zero rows*, not an error. RLS does not announce that it filtered you. So the assertion is "empty," and a test that expects an error would pass for the wrong reason.

## The lesson

Multi-tenant security is not "add a WHERE clause." It is deciding where the boundary lives and enforcing it once. RLS puts it in the database, which is the only place a forgotten query cannot get around it. Use `with check` and `using` together, never serve user data with the service-role key, and write the cross-tenant test that proves another tenant sees nothing. The dual-scope case is solvable, but only if you split the row by scope instead of trying to make one policy mean two things.
