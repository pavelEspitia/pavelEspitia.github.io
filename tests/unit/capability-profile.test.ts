import { describe, expect, it } from 'vitest';

import { selectCapabilityProfile } from '../../src/scripts/capability-profile';

const desktop = {
  reducedMotion: false,
  webgl: true,
  precisePointer: true,
  viewportWidth: 1440,
  deviceMemoryGB: 8,
};

describe('selectCapabilityProfile', () => {
  it('reserves tier A for a capable desktop', () => {
    expect(selectCapabilityProfile(desktop)).toBe('tier-a');
  });

  it.each([
    [{ ...desktop, reducedMotion: true }, 'tier-c'],
    [{ ...desktop, webgl: false }, 'tier-b'],
    [{ ...desktop, precisePointer: false }, 'tier-b'],
    [{ ...desktop, viewportWidth: 720 }, 'tier-b'],
    [{ ...desktop, deviceMemoryGB: 2 }, 'tier-b'],
    [{ ...desktop, webglFailed: true }, 'tier-b'],
  ] as const)('maps constrained capabilities to the appropriate tier', (input, expected) => {
    expect(selectCapabilityProfile(input)).toBe(expected);
  });
});
