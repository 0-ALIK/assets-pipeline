import { describe, expect, it } from 'vitest';
import { PipelineError } from '../src/index.js';
import { Animation } from '../src/domain/entities/animation.js';
import { Atlas } from '../src/domain/entities/atlas.js';
import { Repository } from '../src/domain/entities/repository.js';
import {
  assertAtlasGap,
  assertAtlasName,
  assertAtlasSize,
} from '../src/domain/value-objects/atlas.js';
import { assertDuration } from '../src/domain/value-objects/duration.js';
import { assertIdentifier, groupFromIdentifier } from '../src/domain/value-objects/identifier.js';
import { anchorPoint, assertPivot } from '../src/domain/value-objects/pivot.js';
import {
  assertRectangle,
  rectangleFits,
  rectanglesEqual,
} from '../src/domain/value-objects/rectangle.js';
import {
  assertSourcePath,
  childPath,
  isSupportedSource,
  isWithin,
  parentPath,
  pathName,
} from '../src/domain/value-objects/source-path.js';

function catchError(action: () => unknown): PipelineError {
  try {
    action();
  } catch (error) {
    if (error instanceof PipelineError) return error;
    throw error;
  }
  throw new Error('expected the action to throw');
}

describe('identifier value object', () => {
  it('accepts unicode segments and derives the group', () => {
    expect(() => assertIdentifier('npc/head/front/idle_0')).not.toThrow();
    expect(() => assertIdentifier('entidad_ñ/acción-1')).not.toThrow();
    expect(groupFromIdentifier('npc/head/front/idle_0')).toBe('npc');
  });

  it('rejects malformed or unsafe identifiers', () => {
    for (const id of [
      '',
      '/npc',
      'npc//head',
      'npc\\head',
      'npc:head',
      '.',
      '..',
      'a/./b',
      'a/../b',
      '__proto__',
      'a/constructor',
      'with space',
      'a/prototype',
    ]) {
      expect(() => assertIdentifier(id), id).toThrow(PipelineError);
    }
  });
});

describe('source path value object', () => {
  it('accepts repository-relative paths and detects supported formats', () => {
    expect(() => assertSourcePath('entities/humans_parts.aseprite')).not.toThrow();
    expect(isSupportedSource('hero.PNG')).toBe(true);
    expect(isSupportedSource('hero.aseprite')).toBe(true);
    expect(isSupportedSource('notes.txt')).toBe(false);
  });

  it('rejects reserved segments, absolute paths and separators', () => {
    for (const path of [
      '',
      '/hero.png',
      'a\\b.png',
      'C:/hero.png',
      'a/./b.png',
      'a/../b.png',
      '.assets-pipeline-cache/db.json',
      'x/.ASSETS-PIPELINE-CACHE/y',
    ]) {
      expect(() => assertSourcePath(path), path).toThrow(PipelineError);
    }
  });

  it('decomposes and combines paths', () => {
    expect(parentPath('a/b/c.png')).toBe('a/b');
    expect(parentPath('c.png')).toBe('');
    expect(pathName('a/b/c.png')).toBe('c.png');
    expect(pathName('c.png')).toBe('c.png');
    expect(childPath('a/b', 'c.png')).toBe('a/b/c.png');
    expect(childPath('', 'c.png')).toBe('c.png');
    expect(isWithin('a/b/c.png', 'a/b')).toBe(true);
    expect(isWithin('a/b', 'a/b')).toBe(false);
    expect(isWithin('a/bc/d.png', 'a/b')).toBe(false);
  });
});

describe('rectangle, pivot and duration value objects', () => {
  it('validates rectangles against the canvas', () => {
    expect(() => assertRectangle({ x: 0, y: 0, width: 8, height: 8 }, 64, 64)).not.toThrow();
    for (const rect of [
      { x: -1, y: 0, width: 8, height: 8 },
      { x: 0, y: 0, width: 0, height: 8 },
      { x: 0, y: 0, width: 1.5, height: 8 },
      { x: 60, y: 0, width: 8, height: 8 },
    ]) {
      expect(() => assertRectangle(rect, 64, 64), JSON.stringify(rect)).toThrow(PipelineError);
    }
    expect(rectangleFits({ x: 60, y: 60, width: 4, height: 4 }, { width: 64, height: 64 })).toBe(
      true,
    );
    expect(rectangleFits({ x: 61, y: 60, width: 4, height: 4 }, { width: 64, height: 64 })).toBe(
      false,
    );
    expect(
      rectanglesEqual({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 }),
    ).toBe(true);
  });

  it('validates pivots and computes anchors', () => {
    expect(() => assertPivot({ x: 0.5, y: 1 })).not.toThrow();
    expect(() => assertPivot({ x: 1.2, y: 0 })).toThrow(PipelineError);
    expect(() => assertPivot({ x: 0, y: Number.NaN })).toThrow(PipelineError);
    expect(anchorPoint({ x: 10, y: 20, width: 20, height: 40 }, { x: 0.5, y: 1 })).toEqual({
      x: 20,
      y: 60,
    });
  });

  it('requires positive integer durations', () => {
    expect(() => assertDuration(120)).not.toThrow();
    for (const value of [0, -1, 1.5, Number.NaN]) {
      expect(() => assertDuration(value), String(value)).toThrow(PipelineError);
    }
  });

  it('constrains atlas names, sizes and gaps', () => {
    expect(() => assertAtlasName('characters_01')).not.toThrow();
    for (const name of ['', '.', '..', 'with/slash', 'with.dot', 'space name']) {
      expect(() => assertAtlasName(name), name).toThrow(PipelineError);
    }
    expect(() => assertAtlasSize(2048)).not.toThrow();
    for (const size of [0, -1, 8193, 2.5]) {
      expect(() => assertAtlasSize(size), String(size)).toThrow(PipelineError);
    }
    expect(() => assertAtlasGap(2, 64)).not.toThrow();
    for (const gap of [-1, 64, 65]) {
      expect(() => assertAtlasGap(gap, 64), String(gap)).toThrow(PipelineError);
    }
  });
});

describe('Animation entity', () => {
  it('edits frames while keeping them in range', () => {
    const animation = Animation.create('loop');
    expect(animation.frameCount).toBe(0);
    animation.addFrame('hero/0', 100);
    animation.addFrame('hero/1', 150, 0);
    expect(animation.list).toEqual([
      { sprite: 'hero/1', durationMs: 150 },
      { sprite: 'hero/0', durationMs: 100 },
    ]);
    animation.setFrame(0, undefined, 200);
    animation.moveFrame(0, 2);
    expect(animation.list).toEqual([
      { sprite: 'hero/0', durationMs: 100 },
      { sprite: 'hero/1', durationMs: 200 },
    ]);
    animation.removeFrame(0);
    expect(animation.frameCount).toBe(1);
    expect(animation.totalDurationMs).toBe(200);
    expect(catchError(() => animation.addFrame('hero/0', 0)).code).toBe('INVALID_INPUT');
    expect(catchError(() => animation.moveFrame(0, 5)).code).toBe('INVALID_INPUT');
    expect(catchError(() => animation.removeFrame(1)).code).toBe('INVALID_INPUT');
  });

  it('renames frame references and validates playback', () => {
    const animation = Animation.create('once');
    animation.addFrame('hero/0', 100);
    animation.renameSpriteReference('hero/0', 'hero/stand');
    expect(animation.list[0]!.sprite).toBe('hero/stand');
    expect(catchError(() => animation.setPlayback('ping-pong')).code).toBe('INVALID_INPUT');
    expect(animation.toJSON()).toEqual({
      playback: 'once',
      frames: [{ sprite: 'hero/stand', durationMs: 100 }],
    });
  });
});

describe('Atlas entity', () => {
  it('keeps size, gap and sorted groups consistent', () => {
    const atlas = Atlas.create(64, 1);
    expect(atlas.pageSize).toBe(64);
    atlas.setSizeAndGap(128, 2);
    expect(atlas.toJSON()).toEqual({ size: 128, gap: 2, groups: [] });
    atlas.assignGroup('npc');
    atlas.assignGroup('arrows');
    expect(atlas.groupNames).toEqual(['arrows', 'npc']);
    atlas.unassignGroup('arrows');
    expect(atlas.hasGroup('arrows')).toBe(false);
    expect(catchError(() => atlas.setSizeAndGap(64, 64)).code).toBe('INVALID_INPUT');
    expect(catchError(() => atlas.setSizeAndGap()).code).toBe('INVALID_INPUT');
  });
});

const project = {
  id: 'project-id',
  name: 'Test project',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Repository aggregate', () => {
  it('starts empty and records the initialization event', () => {
    const repository = Repository.create(project);
    expect(repository.sourcePaths).toEqual([]);
    expect(repository.drainEvents()).toEqual([
      { type: 'repository.initialized', projectId: 'project-id' },
    ]);
    expect(repository.drainEvents()).toEqual([]);
  });

  it('keeps sprite ids unique across sources and creates entries on demand', () => {
    const repository = Repository.create(project);
    repository.addSprite(
      'hero.png',
      'hero/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0.5, y: 1 },
    );
    repository.addSprite(
      'other.png',
      'other/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0, y: 0 },
    );
    expect(repository.sourcePaths).toEqual(['hero.png', 'other.png']);
    expect(
      catchError(() =>
        repository.addSprite(
          'third.png',
          'hero/0',
          { x: 0, y: 0, width: 1, height: 1 },
          { x: 0, y: 0 },
        ),
      ).code,
    ).toBe('ALREADY_EXISTS');
    expect(catchError(() => repository.requireSprite('missing')).code).toBe('NOT_FOUND');
  });

  it('renames sprites across frame references and removes empty sources', () => {
    const repository = Repository.create(project);
    repository.addSprite(
      'hero.png',
      'hero/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0.5, y: 1 },
    );
    repository.addAnimation('hero.png', 'hero/idle', 'loop');
    repository.addFrame('hero/idle', 'hero/0', 100);
    repository.renameSprite('hero/0', 'hero/stand_0');
    expect(repository.requireAnimation('hero/idle').animation.frames[0]!.sprite).toBe(
      'hero/stand_0',
    );
    expect(catchError(() => repository.removeSprite('hero/stand_0')).code).toBe('IN_USE');
    repository.removeFrame('hero/idle', 0);
    repository.removeAnimation('hero/idle');
    repository.removeSprite('hero/stand_0');
    expect(repository.sourcePaths).toEqual([]);
  });

  it('refuses to drop a source that still has animations', () => {
    const repository = Repository.create(project);
    repository.addSprite(
      'hero.png',
      'hero/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0.5, y: 1 },
    );
    repository.addAnimation('hero.png', 'hero/idle', 'loop');
    const error = catchError(() => repository.removeSprite('hero/0'));
    expect(error.code).toBe('IN_USE');
    expect(error.message).toContain('Elimina primero las animaciones');
  });

  it('validates frame edits against the animation source', () => {
    const repository = Repository.create(project);
    repository.addSprite(
      'hero.png',
      'hero/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0.5, y: 1 },
    );
    repository.addSprite(
      'other.png',
      'other/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0.5, y: 1 },
    );
    expect(catchError(() => repository.addAnimation('missing.png', 'hero/idle', 'loop')).code).toBe(
      'NOT_FOUND',
    );
    repository.addAnimation('hero.png', 'hero/idle', 'loop');
    expect(catchError(() => repository.addFrame('hero/idle', 'other/0', 100)).code).toBe(
      'INVALID_INPUT',
    );
    expect(catchError(() => repository.setFrame('hero/idle', 0, 'other/0')).code).toBe(
      'INVALID_INPUT',
    );
    expect(catchError(() => repository.addFrame('hero/idle', 'hero/0', 0)).code).toBe(
      'INVALID_INPUT',
    );
    expect(catchError(() => repository.addAnimation('hero.png', 'hero/idle', 'loop')).code).toBe(
      'ALREADY_EXISTS',
    );
  });

  it('keeps atlas groups exclusive and validates configuration', () => {
    const repository = Repository.create(project);
    repository.addSprite(
      'hero.png',
      'npc/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0.5, y: 1 },
    );
    repository.addSprite(
      'hero.png',
      'player/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0.5, y: 1 },
    );
    expect(repository.listGroups().map((group) => group.name)).toEqual(['npc', 'player']);
    repository.addAtlas('characters', 64, 1);
    expect(catchError(() => repository.addAtlas('CHARACTERS', 64, 0)).code).toBe('ALREADY_EXISTS');
    expect(catchError(() => repository.addAtlas('other', 0, 0)).code).toBe('INVALID_INPUT');
    expect(catchError(() => repository.setAtlas('missing', 64)).code).toBe('NOT_FOUND');
    expect(catchError(() => repository.setAtlas('characters')).code).toBe('INVALID_INPUT');
    repository.addAtlas('players', 64, 0);
    repository.assignGroup('characters', 'npc');
    expect(catchError(() => repository.assignGroup('characters', 'npc')).code).toBe(
      'ALREADY_EXISTS',
    );
    expect(catchError(() => repository.assignGroup('players', 'npc')).code).toBe('ALREADY_EXISTS');
    expect(catchError(() => repository.assignGroup('characters', 'missing')).code).toBe(
      'NOT_FOUND',
    );
    repository.unassignGroup('characters', 'npc');
    expect(catchError(() => repository.unassignGroup('characters', 'npc')).code).toBe('NOT_FOUND');
    repository.removeAtlas('players');
    expect(repository.atlasNames).toEqual(['characters']);
  });

  it('round-trips through JSON preserving legacy data and project timestamps', () => {
    const legacy = { assets: [{ id: 'old' }], operationHistory: [] };
    const database = {
      schemaVersion: 4 as const,
      project,
      sources: {
        'hero.png': {
          sprites: { 'hero/0': { x: 0, y: 0, width: 8, height: 8, pivot: { x: 0.5, y: 1 } } },
          animations: {
            'hero/idle': {
              playback: 'loop' as const,
              frames: [{ sprite: 'hero/0', durationMs: 120 }],
            },
          },
        },
      },
      atlases: { characters: { size: 64, gap: 0, groups: ['hero'] } },
      legacy,
    };
    const repository = Repository.fromJSON(database);
    expect(repository.toJSON()).toEqual(database);
    repository.touch('2026-02-01T00:00:00.000Z');
    expect(repository.configuration.updatedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(repository.toJSON().legacy).toEqual(legacy);
  });

  it('rejects persisted frames that reference foreign sprites', () => {
    const broken = {
      schemaVersion: 4 as const,
      project,
      sources: {
        'hero.png': {
          sprites: { 'hero/0': { x: 0, y: 0, width: 8, height: 8, pivot: { x: 0.5, y: 1 } } },
          animations: {
            'hero/idle': {
              playback: 'loop' as const,
              frames: [{ sprite: 'other/0', durationMs: 100 }],
            },
          },
        },
      },
      atlases: {},
    };
    expect(catchError(() => Repository.fromJSON(broken)).code).toBe('INVALID_REPOSITORY');
  });

  it('records every completed fact as a domain event', () => {
    const repository = Repository.create(project);
    repository.drainEvents();
    repository.addSprite(
      'hero.png',
      'hero/0',
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 0.5, y: 1 },
    );
    repository.addAnimation('hero.png', 'hero/idle', 'loop');
    repository.addFrame('hero/idle', 'hero/0', 100);
    repository.addAtlas('characters', 64, 0);
    repository.assignGroup('characters', 'hero');
    expect(repository.drainEvents()).toEqual([
      { type: 'sprite.added', path: 'hero.png', id: 'hero/0' },
      { type: 'animation.added', path: 'hero.png', id: 'hero/idle' },
      { type: 'frame.added', animation: 'hero/idle', sprite: 'hero/0', durationMs: 100, at: 0 },
      { type: 'atlas.added', name: 'characters', size: 64, gap: 0 },
      { type: 'atlas.group-assigned', atlas: 'characters', group: 'hero' },
    ]);
  });
});
