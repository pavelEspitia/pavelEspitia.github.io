import { describe, expect, it } from 'vitest';

import { rankDestinations } from '../../src/scripts/command-palette';

const destinations = [
  { id: 'universe', label: 'Universe', kind: 'section' as const },
  { id: 'product-argus', label: 'Argus', kind: 'product' as const },
  { id: 'writing', label: 'Writing', kind: 'section' as const },
  { id: 'note-argus', label: 'Argus field note', kind: 'writing' as const },
];

describe('rankDestinations', () => {
  it('returns curated order for an empty query', () => {
    expect(rankDestinations(destinations, '')).toEqual(destinations);
  });

  it('matches case-insensitively and ranks exact products first', () => {
    const results = rankDestinations(destinations, 'ARGUS');
    expect(results.map(({ id }) => id)).toEqual(['product-argus', 'note-argus']);
  });

  it('finds sections and writing by partial names', () => {
    expect(rankDestinations(destinations, 'writ')[0]?.id).toBe('writing');
  });
});
