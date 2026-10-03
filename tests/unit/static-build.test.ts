import { afterEach, describe, expect, test } from 'vitest';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { copyStaticRoutes } from '../../scripts/copy-static.mjs';
import { verifyBuild } from '../../scripts/verify-build.mjs';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixture(root: string, path: string, contents = 'fixture'): Promise<void> {
  const target = join(root, path);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, contents);
}

async function writeRequiredArtifact(root: string): Promise<void> {
  await Promise.all([
    writeFixture(root, 'index.html', '<main>Portfolio</main>'),
    writeFixture(root, 'blog/index.html'),
    writeFixture(root, 'cv/cv.html'),
    writeFixture(root, 'cv/pavel-espitia-cv.pdf'),
    writeFixture(root, 'favicon.png'),
    writeFixture(root, 'icon-192.png'),
    writeFixture(root, 'icon-512.png'),
    writeFixture(root, 'apple-touch-icon.png'),
    writeFixture(root, 'assets/argus.png'),
    writeFixture(root, 'assets/argus-lens.png'),
    writeFixture(root, 'assets/scry.png'),
    writeFixture(root, 'assets/spectr-ai.png'),
  ]);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
  })));
});

describe('static build contract', () => {
  test('copies_legacy_public_routes', async () => {
    const root = await temporaryDirectory('portfolio-root-');
    const output = await temporaryDirectory('portfolio-output-');

    await Promise.all([
      writeFixture(root, 'blog/index.html', 'blog'),
      writeFixture(root, 'cv/cv.html', 'cv'),
      writeFixture(root, 'posts/day-01.md', 'post'),
      writeFixture(root, 'posts/publish-helper.mjs', 'private authoring helper'),
      writeFixture(root, 'covers/day-01.png', 'cover'),
      writeFixture(root, 'covers/generate.ts', 'private authoring helper'),
      writeFixture(root, 'assets/argus.png', 'image'),
      writeFixture(root, '.nojekyll', ''),
      writeFixture(root, 'favicon.png', 'icon'),
    ]);

    await copyStaticRoutes(root, output);

    await expect(readFile(join(output, 'blog/index.html'), 'utf8')).resolves.toBe('blog');
    await expect(readFile(join(output, 'cv/cv.html'), 'utf8')).resolves.toBe('cv');
    await expect(readFile(join(output, 'posts/day-01.md'), 'utf8')).resolves.toBe('post');
    await expect(readFile(join(output, 'covers/day-01.png'), 'utf8')).resolves.toBe('cover');
    await expect(readFile(join(output, 'assets/argus.png'), 'utf8')).resolves.toBe('image');
    await expect(readFile(join(output, '.nojekyll'), 'utf8')).resolves.toBe('');
    await expect(access(join(output, 'posts/publish-helper.mjs'))).rejects.toThrow();
    await expect(access(join(output, 'covers/generate.ts'))).rejects.toThrow();
  });

  test('rejects_sensitive_tokens_in_output', async () => {
    const output = await temporaryDirectory('portfolio-sensitive-');
    await writeRequiredArtifact(output);
    await writeFixture(output, 'assets/app.js', 'const token = "gp_example_not_a_real_secret";');

    const result = await verifyBuild(output);

    expect(result.errors).toContain('Sensitive credential pattern detected in generated text output.');
    expect(result.errors.join('\n')).not.toContain('gp_example_not_a_real_secret');
  });

  test('allows_documented_placeholder_credentials', async () => {
    const output = await temporaryDirectory('portfolio-placeholder-');
    await writeRequiredArtifact(output);
    await writeFixture(output, 'blog/example.html', '<code>API_KEY="your-api-key-goes-here"</code>');

    const result = await verifyBuild(output);

    expect(result.errors).not.toContain('Sensitive credential pattern detected in generated text output.');
  });

  test('reports_missing_required_route', async () => {
    const output = await temporaryDirectory('portfolio-missing-');
    await writeRequiredArtifact(output);
    await rm(join(output, 'cv/pavel-espitia-cv.pdf'));

    const result = await verifyBuild(output);

    expect(result.errors).toContain('Missing required build artifact: cv/pavel-espitia-cv.pdf');
  });
});
