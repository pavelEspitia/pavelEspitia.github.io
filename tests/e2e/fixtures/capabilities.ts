import type { Page } from '@playwright/test';

export type ForcedTier = 'tier-a' | 'tier-b' | 'tier-c';

export async function forceCapabilityTier(page: Page, tier: ForcedTier) {
  await page.addInitScript((forcedTier) => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: forcedTier === 'tier-a' ? 8 : 2 });
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query.includes('prefers-reduced-motion')) return { matches: forcedTier === 'tier-c', media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true } as MediaQueryList;
      if (query.includes('pointer: fine')) return { matches: forcedTier !== 'tier-b', media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true } as MediaQueryList;
      return original(query);
    };
  }, tier);
}
