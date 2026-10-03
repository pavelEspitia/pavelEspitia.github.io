import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function findChrome(directory, depth = 0) {
  if (depth > 4 || !existsSync(directory)) return undefined;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isFile() && (entry.name === 'chrome' || entry.name === 'google-chrome')) return path;
    if (entry.isDirectory()) {
      const match = findChrome(path, depth + 1);
      if (match) return match;
    }
  }
  return undefined;
}

const chromePath = process.env.CHROME_PATH
  ?? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ?? findChrome(join(homedir(), '.cache', 'ms-playwright'));

if (!chromePath) {
  console.error('No Chromium executable was found. Run `pnpm exec playwright install chromium`.');
  process.exit(1);
}

const executable = join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'lhci.cmd' : 'lhci');
const environment = { ...process.env, CHROME_PATH: chromePath };

if (process.platform !== 'win32') {
  environment.TMPDIR = '/tmp';
  delete environment.TEMP;
  delete environment.TMP;
  delete environment.LOCALAPPDATA;
  delete environment.APPDATA;
}

const result = spawnSync(executable, ['autorun'], { stdio: 'inherit', env: environment });
process.exit(result.status ?? 1);
