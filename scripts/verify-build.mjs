import { access, readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_ARTIFACTS = [
  'index.html',
  '.nojekyll',
  'blog/index.html',
  'cv/cv.html',
  'cv/pavel-espitia-cv.pdf',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'assets/argus.png',
  'assets/argus-lens.png',
  'assets/scry.png',
  'assets/spectr-ai.png',
];

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.txt', '.xml']);
const SENSITIVE_PATTERNS = [
  /\bgp_[A-Za-z0-9_-]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[A-Za-z0-9_-]{30,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["']?[A-Za-z0-9_./+~]{24,}/i,
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

export async function verifyBuild(outputDir) {
  const output = resolve(outputDir);
  const errors = [];

  for (const artifact of REQUIRED_ARTIFACTS) {
    if (!(await exists(join(output, artifact)))) {
      errors.push(`Missing required build artifact: ${artifact}`);
    }
  }

  if (!(await exists(output))) {
    return { errors, compressedOwnJsBytes: 0 };
  }

  const files = await filesUnder(output);
  let compressedOwnJsBytes = 0;
  let containsSensitiveValue = false;

  for (const file of files) {
    const extension = extname(file).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) continue;

    const contents = await readFile(file, 'utf8');
    if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(contents))) {
      containsSensitiveValue = true;
    }

    if (extension === '.js' && !file.includes('vendor-three')) {
      compressedOwnJsBytes += gzipSync(contents).byteLength;
    }
  }

  if (containsSensitiveValue) {
    errors.push('Sensitive credential pattern detected in generated text output.');
  }

  if (compressedOwnJsBytes > 250 * 1024) {
    errors.push(`Own compressed JavaScript exceeds 250 KB budget (${compressedOwnJsBytes} bytes).`);
  }

  return { errors, compressedOwnJsBytes };
}

const invokedDirectly = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  const outputDir = process.argv[2] ?? 'dist';
  const result = await verifyBuild(outputDir);

  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`Build verified. Own compressed JavaScript: ${result.compressedOwnJsBytes} bytes.`);
  }
}
