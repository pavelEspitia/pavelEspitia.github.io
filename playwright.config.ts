import { defineConfig, devices } from '@playwright/test';

const localChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], launchOptions: localChromium ? { executablePath: localChromium } : undefined } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'], launchOptions: localChromium ? { executablePath: localChromium } : undefined } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && ./node_modules/.bin/vite preview --host 127.0.0.1 --port 4173',
    port: 4173,
    reuseExistingServer: false,
  },
});
