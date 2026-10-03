import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { extractLinks, isDeadStatus, parseArgs, stampVerificationFile, verifyLinks } from '../../scripts/verify-links.mjs';

describe('link verification', () => {
  it('parses explicit generated HTML and optional stamp targets', () => {
    expect(parseArgs(['--input', 'dist/index.html', '--stamp-file', 'stamp.json'])).toEqual({ input: 'dist/index.html', stampFile: 'stamp.json' });
    expect(extractLinks('<a href="https://example.com/a">A</a>')).toEqual(['https://example.com/a']);
  });

  it('treats bot walls as alive and hard rot or network errors as dead', () => {
    expect(isDeadStatus(403)).toBe(false);
    expect(isDeadStatus(429)).toBe(false);
    expect(isDeadStatus(404)).toBe(true);
    expect(isDeadStatus(410)).toBe(true);
    expect(isDeadStatus('network error: offline')).toBe(true);
  });

  it('keeps network failures fatal', async () => {
    const dead = await verifyLinks(['https://example.com'], vi.fn().mockRejectedValue(new Error('offline')));
    expect(dead).toEqual(['https://example.com']);
  });

  it('changes only the JSON date when explicitly stamping', () => {
    const directory = mkdtempSync(join(tmpdir(), 'portfolio-links-'));
    const file = join(directory, 'stamp.json');
    writeFileSync(file, '{"date":"2020-01-01","channel":"stable"}\n');
    stampVerificationFile(file, '2026-10-03');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ date: '2026-10-03', channel: 'stable' });
  });
});
