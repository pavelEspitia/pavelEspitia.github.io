#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIP_HOSTS = new Set(['www.linkedin.com', 'linkedin.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);
const UA = 'Mozilla/5.0 (compatible; noctis-link-verifier/2.0; +https://pavelespitia.github.io)';

export function parseArgs(args) {
  const valueAfter = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  return { input: valueAfter('--input') ?? 'dist/index.html', stampFile: valueAfter('--stamp-file') };
}

export function extractLinks(html) {
  return [...new Set([...html.matchAll(/href="(https?:\/\/[^"#]+(?:#[^"]*)?)"/g)].map((match) => match[1]))]
    .filter((url) => !SKIP_HOSTS.has(new URL(url).hostname));
}

export function isDeadStatus(status) {
  return status === 404 || status === 410 || String(status).startsWith('network error');
}

export async function verifyLinks(links, fetcher = fetch) {
  const dead = [];
  for (const url of links) {
    let status;
    try {
      let response = await fetcher(url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': UA } });
      if (response.status >= 400) response = await fetcher(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': UA } });
      status = response.status;
    } catch (error) {
      status = `network error: ${error instanceof Error ? error.message : String(error)}`;
    }
    console.log(`${isDeadStatus(status) ? 'DEAD' : ' ok '} [${status}] ${url}`);
    if (isDeadStatus(status)) dead.push(url);
  }
  return dead;
}

export function stampVerificationFile(file, date = new Date().toISOString().slice(0, 10)) {
  const current = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, `${JSON.stringify({ ...current, date }, null, 2)}\n`);
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const html = readFileSync(resolve(options.input), 'utf8');
  const links = extractLinks(html);
  const dead = await verifyLinks(links);
  if (dead.length) {
    console.error(`\n${dead.length} dead link(s). Verification date was not changed.`);
    return 1;
  }
  if (options.stampFile) stampVerificationFile(resolve(options.stampFile));
  console.log(`\nAll ${links.length} checked links are alive.${options.stampFile ? ' Verification date updated.' : ''}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = await main();
