import { describe, expect, it } from 'vitest';

import { createConstellationLayout } from '../../src/scripts/constellation-lite';

const ids = ['spectr-ai', 'argus', 'argus-lens', 'scry', 'folio'];

describe('createConstellationLayout', () => {
  it.each([[1200, 620], [390, 700]])('creates deterministic bounded anchors at %sx%s', (width, height) => {
    const first = createConstellationLayout(ids, { width, height });
    const second = createConstellationLayout(ids, { width, height });
    expect(first).toEqual(second);
    expect(first).toHaveLength(ids.length);
    first.forEach((point) => {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(height);
    });
    const unique = new Set(first.map(({ x, y }) => `${x}:${y}`));
    expect(unique.size).toBe(ids.length);
  });

  it('falls back safely when dimensions are missing', () => {
    expect(createConstellationLayout(ids, { width: 0, height: 0 })).toHaveLength(ids.length);
  });
});
