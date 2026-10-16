import { describe, expect, it } from 'vitest';
import { mergeRecent } from './recents.js';

describe('mergeRecent', () => {
  it('puts the latest project first and replaces older entries', () => {
    const existing = [
      { name: 'Old', root: 'C:/projects/old', lastOpenedAt: '2026-01-01T00:00:00.000Z' },
      { name: 'Other', root: 'C:/projects/other', lastOpenedAt: '2026-01-02T00:00:00.000Z' },
    ];
    const merged = mergeRecent(existing, {
      name: 'Old renamed',
      root: 'c:\\projects\\old\\',
      lastOpenedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual({
      name: 'Old renamed',
      root: 'c:\\projects\\old\\',
      lastOpenedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(merged[1]!.name).toBe('Other');
  });

  it('caps the list length', () => {
    const existing = Array.from({ length: 12 }, (_, index) => ({
      name: `Project ${index}`,
      root: `C:/projects/${index}`,
      lastOpenedAt: '2026-01-01T00:00:00.000Z',
    }));
    const merged = mergeRecent(existing, {
      name: 'New',
      root: 'C:/projects/new',
      lastOpenedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(merged).toHaveLength(12);
    expect(merged[0]!.name).toBe('New');
  });
});
