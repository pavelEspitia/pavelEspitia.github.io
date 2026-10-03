// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { createEvidenceMode } from '../../src/scripts/evidence-mode';

const storage = (value: string | null = null) => ({
  getItem: () => value,
  setItem: (_key: string, next: string) => { value = next; },
});

describe('createEvidenceMode', () => {
  it('defaults invalid or missing state to Story and persists Evidence', () => {
    document.body.innerHTML = `<button data-presentation-mode="story"></button><button data-presentation-mode="evidence"></button><article data-product="one" data-has-evidence="true"><div data-mode-content="story"></div><div data-mode-content="evidence"></div></article>`;
    const store = storage('invalid');
    const controller = createEvidenceMode(document, store);
    expect(controller.getMode()).toBe('story');
    controller.setMode('evidence');
    expect(document.querySelector('[data-presentation-mode="evidence"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-mode-content="story"]')?.hasAttribute('hidden')).toBe(true);
    controller.destroy();
  });

  it('does not hide the story when optional evidence is unavailable', () => {
    document.body.innerHTML = `<button data-presentation-mode="story"></button><button data-presentation-mode="evidence"></button><article data-product="one" data-has-evidence="false"><div data-mode-content="story"></div></article>`;
    const controller = createEvidenceMode(document, storage('evidence'));
    expect(document.querySelector('[data-mode-content="story"]')?.hasAttribute('hidden')).toBe(false);
    controller.destroy();
  });
});
