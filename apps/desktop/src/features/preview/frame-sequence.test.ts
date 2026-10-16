import { describe, expect, it } from 'vitest';
import { moveItem } from './frame-sequence.js';

describe('moveItem', () => {
  it('moves items preserving order', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveItem(['a', 'b', 'c', 'd'], 1, 2)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('returns the same reference when nothing changes', () => {
    const list = [1, 2, 3];
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, -1, 0)).toBe(list);
    expect(moveItem(list, 0, 3)).toBe(list);
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});
