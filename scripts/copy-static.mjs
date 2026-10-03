import { access, cp, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const STATIC_DIRECTORIES = [
  { path: 'assets' },
  { path: 'blog' },
  { path: 'covers', extensions: new Set(['.html', '.json', '.png']) },
  { path: 'cv' },
  { path: 'posts', extensions: new Set(['.md']) },
];
const STATIC_FILES = [
  '.nojekyll',
  'apple-touch-icon.png',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function copyStaticRoutes(rootDir, outputDir) {
  await mkdir(outputDir, { recursive: true });

  for (const directory of STATIC_DIRECTORIES) {
    const source = join(rootDir, directory.path);
    if (await exists(source)) {
      await cp(source, join(outputDir, directory.path), {
        recursive: true,
        force: true,
        filter: directory.extensions
          ? (candidate) => extname(candidate) === '' || directory.extensions.has(extname(candidate).toLowerCase())
          : undefined,
      });
    }
  }

  for (const file of STATIC_FILES) {
    const source = join(rootDir, file);
    if (await exists(source)) {
      await cp(source, join(outputDir, file), { force: true });
    }
  }
}
