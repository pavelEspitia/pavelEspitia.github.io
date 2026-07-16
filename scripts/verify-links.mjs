#!/usr/bin/env node
// Verifies every external link in index.html and, if all resolve, rewrites the
// "Links verified YYYY-MM-DD" date in the footer. Exits 1 if any link is dead
// so CI surfaces the rot instead of silently re-stamping.
import { readFileSync, writeFileSync } from 'node:fs';

const INDEX = new URL('../index.html', import.meta.url).pathname;
const SKIP_HOSTS = new Set(['www.linkedin.com', 'linkedin.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);
const UA = 'Mozilla/5.0 (compatible; noctis-link-verifier/1.0; +https://pavelespitia.github.io)';

const html = readFileSync(INDEX, 'utf8');
const links = [...new Set([...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]))]
  .filter((u) => !SKIP_HOSTS.has(new URL(u).hostname));

let dead = [];
for (const url of links) {
  let status;
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': UA } });
    if (res.status >= 400) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': UA } });
    }
    status = res.status;
  } catch (err) {
    status = `network error: ${err.message}`;
  }
  // Only hard rot fails the run; bot-walls (403/429/999) prove the host is alive.
  const isDead = status === 404 || status === 410 || String(status).startsWith('network error');
  console.log(`${isDead ? 'DEAD' : ' ok '} [${status}] ${url}`);
  if (isDead) dead.push(url);
}

if (dead.length > 0) {
  console.error(`\n${dead.length} dead link(s). Not re-stamping the date. Fix the links.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const stamped = html.replace(/Links verified \d{4}-\d{2}-\d{2}/, `Links verified ${today}`);
if (stamped !== html) {
  writeFileSync(INDEX, stamped);
  console.log(`\nAll ${links.length} links alive. Stamped: Links verified ${today}`);
} else {
  console.log(`\nAll ${links.length} links alive. Date already current.`);
}
