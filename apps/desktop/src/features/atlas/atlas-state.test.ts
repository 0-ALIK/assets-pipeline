import { describe, expect, it } from 'vitest';
import type { RepositoryDatabase, SpriteDefinition } from '@assets-pipeline/core';
import { deriveGroups, listAtlases, unassignedGroups } from './atlas-state.js';

function sprite(x = 0, y = 0, width = 8, height = 8): SpriteDefinition {
  return { x, y, width, height, pivot: { x: 0.5, y: 1 } };
}

function database(
  sources: RepositoryDatabase['sources'],
  atlases: RepositoryDatabase['atlases'] = {},
): RepositoryDatabase {
  return {
    schemaVersion: 4,
    project: { id: 'p', name: 'Test', createdAt: '2026', updatedAt: '2026' },
    sources,
    atlases,
  };
}

const sample = database(
  {
    'a.png': {
      sprites: { 'npc/one': sprite(), 'npc/two': sprite(), 'player/three': sprite() },
      animations: {},
    },
    'b.png': { sprites: { 'environment/tree': sprite() }, animations: {} },
  },
  { characters: { size: 64, gap: 1, groups: ['npc'] } },
);

describe('deriveGroups', () => {
  it('derives groups from the first ID segment and resolves assignments', () => {
    expect(deriveGroups(sample)).toEqual([
      { name: 'environment', spriteIds: ['environment/tree'], atlas: null },
      { name: 'npc', spriteIds: ['npc/one', 'npc/two'], atlas: 'characters' },
      { name: 'player', spriteIds: ['player/three'], atlas: null },
    ]);
  });

  it('returns no groups for an empty repository', () => {
    expect(deriveGroups(database({}))).toEqual([]);
  });
});

describe('listAtlases', () => {
  it('summarizes atlas configuration with sprite counts', () => {
    expect(listAtlases(sample)).toEqual([
      { name: 'characters', size: 64, gap: 1, groups: ['npc'], spriteCount: 2 },
    ]);
  });

  it('keeps stale groups visible with a zero sprite count', () => {
    const stale = database(
      { 'a.png': { sprites: { 'npc/one': sprite() }, animations: {} } },
      { characters: { size: 64, gap: 0, groups: ['npc', 'ghost'] } },
    );
    expect(listAtlases(stale)).toEqual([
      { name: 'characters', size: 64, gap: 0, groups: ['npc', 'ghost'], spriteCount: 1 },
    ]);
    expect(deriveGroups(stale).map((group) => group.name)).toEqual(['npc']);
  });
});

describe('unassignedGroups', () => {
  it('lists only groups without an atlas', () => {
    expect(unassignedGroups(sample).map((group) => group.name)).toEqual(['environment', 'player']);
  });
});
