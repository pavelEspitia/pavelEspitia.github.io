import { expect, test } from '@playwright/test';

const routes = [
  '/', '/blog/', '/blog/best-ai-coding-tools-developers-2026.html',
  '/blog/best-smart-contract-audit-tools-2026.html', '/blog/run-llm-locally-free-2026.html',
  '/blog/solidity-security-checklist-2026.html', '/blog/web3-developer-tools-2026.html',
  '/cv/cv.html', '/cv/pavel-espitia-cv.pdf', '/assets/argus.png', '/assets/scry.png', '/favicon.png',
];

for (const route of routes) {
  test(`${route} is preserved by the production artifact`, async ({ request }) => {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), route).toBe(200);
  });
}
