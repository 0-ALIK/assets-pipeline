import { describe, expect, it } from 'vitest';
import { PipelineError, RepositoryWorkspace } from '../src/index.js';
import type { RepositoryStore } from '../src/index.js';
import { createTestWorkspace, seededWorkspace } from './memory-ports.js';

async function expectFailure(action: () => Promise<unknown>, code: string): Promise<void> {
  await expect(action()).rejects.toMatchObject({ code });
}

async function addHeroSprite(
  workspace: RepositoryWorkspace,
  id = 'hero/idle_0',
  file = 'hero.png',
): Promise<void> {
  await workspace.addSprite(file, id, { x: 0, y: 0, width: 16, height: 16 }, { x: 0.5, y: 1 });
}

describe('project lifecycle', () => {
  it('initializes a versioned repository and refuses a second initialization', async () => {
    const { workspace, store } = createTestWorkspace();
    const database = await workspace.initialize('Test project', 'project-id');
    expect(database.schemaVersion).toBe(4);
    expect(database.sources).toEqual({});
    expect(database.atlases).toEqual({});
    expect(store.snapshot()?.project.name).toBe('Test project');
    await expectFailure(() => workspace.initialize('Other', 'other-id'), 'ALREADY_EXISTS');
  });

  it('reads a missing repository as NOT_FOUND', async () => {
    const { workspace } = createTestWorkspace();
    await expectFailure(() => workspace.read(), 'NOT_FOUND');
  });
});

describe('sprite definitions', () => {
  it('validates identifiers, source formats and rectangles', async () => {
    const { workspace, files } = await seededWorkspace();
    await expectFailure(() => addHeroSprite(workspace, 'hero/../escape'), 'INVALID_INPUT');
    await expectFailure(
      () => addHeroSprite(workspace, 'hero/idle_0', 'notes.txt'),
      'INVALID_INPUT',
    );
    await expectFailure(
      () =>
        workspace.addSprite(
          'hero.png',
          'hero/big',
          { x: 60, y: 0, width: 8, height: 8 },
          { x: 0.5, y: 1 },
        ),
      'INVALID_INPUT',
    );
    files.addFile('other.png');
    await expectFailure(
      () =>
        workspace.addSprite(
          'missing.png',
          'hero/x',
          { x: 0, y: 0, width: 1, height: 1 },
          { x: 0, y: 0 },
        ),
      'NOT_FOUND',
    );
  });

  it('keeps sprite ids unique across the whole repository', async () => {
    const { workspace, files } = await seededWorkspace();
    files.addFile('other.png');
    await addHeroSprite(workspace);
    await expectFailure(() => addHeroSprite(workspace), 'ALREADY_EXISTS');
    await expectFailure(
      () => addHeroSprite(workspace, 'hero/idle_0', 'other.png'),
      'ALREADY_EXISTS',
    );
  });

  it('renames sprites and rewrites frame references', async () => {
    const { workspace } = await seededWorkspace();
    await addHeroSprite(workspace);
    await workspace.addAnimation('hero.png', 'hero/idle', 'loop');
    await workspace.addFrame('hero/idle', 'hero/idle_0', 120);
    await workspace.renameSprite('hero/idle_0', 'hero/stand_0');
    const animation = await workspace.showAnimation('hero/idle');
    expect(animation.animation.frames).toEqual([{ sprite: 'hero/stand_0', durationMs: 120 }]);
    await workspace.renameAnimation('hero/idle', 'hero/stand');
    expect((await workspace.showAnimation('hero/stand')).id).toBe('hero/stand');
  });

  it('duplicates definitions and refuses to remove sprites in use', async () => {
    const { workspace, store } = await seededWorkspace();
    await addHeroSprite(workspace);
    await workspace.duplicateSprite('hero/idle_0', 'hero/idle_1');
    await workspace.addAnimation('hero.png', 'hero/idle', 'loop');
    await workspace.addFrame('hero/idle', 'hero/idle_0', 100);
    await expectFailure(() => workspace.removeSprite('hero/idle_0'), 'IN_USE');
    await workspace.removeFrame('hero/idle', 0);
    await workspace.removeSprite('hero/idle_0');
    const source = store.snapshot()!.sources['hero.png']!;
    expect(Object.keys(source.sprites)).toEqual(['hero/idle_1']);
  });

  it('drops the source entry when the last sprite goes away', async () => {
    const { workspace, store } = await seededWorkspace();
    await addHeroSprite(workspace);
    await workspace.removeSprite('hero/idle_0');
    expect(store.snapshot()!.sources).toEqual({});
  });

  it('refuses to drop a source that still has animations', async () => {
    const { workspace } = await seededWorkspace();
    await addHeroSprite(workspace);
    await workspace.addAnimation('hero.png', 'hero/idle', 'loop');
    await expectFailure(() => workspace.removeSprite('hero/idle_0'), 'IN_USE');
  });
});

describe('animations and frames', () => {
  it('requires the animation source to exist and validates playback', async () => {
    const { workspace, files } = await seededWorkspace();
    files.addFile('other.png');
    await expectFailure(
      () => workspace.addAnimation('other.png', 'hero/idle', 'loop'),
      'NOT_FOUND',
    );
    await addHeroSprite(workspace);
    await expectFailure(
      () => workspace.addAnimation('hero.png', 'hero/idle', 'ping-pong'),
      'INVALID_INPUT',
    );
  });

  it('edits frames with zero-based indexes and bounds', async () => {
    const { workspace, files } = await seededWorkspace();
    files.addFile('other.png');
    await addHeroSprite(workspace);
    await workspace.addSprite(
      'other.png',
      'other/idle',
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 0, y: 0 },
    );
    await workspace.addAnimation('hero.png', 'hero/walk', 'loop');
    await expectFailure(() => workspace.addFrame('hero/walk', 'other/idle', 100), 'INVALID_INPUT');
    await workspace.addFrame('hero/walk', 'hero/idle_0', 100);
    await workspace.addFrame('hero/walk', 'hero/idle_0', 150, 0);
    await workspace.setFrame('hero/walk', 1, undefined, 200);
    await workspace.moveFrame('hero/walk', 0, 2);
    const animation = await workspace.showAnimation('hero/walk');
    expect(animation.animation.frames).toEqual([
      { sprite: 'hero/idle_0', durationMs: 200 },
      { sprite: 'hero/idle_0', durationMs: 150 },
    ]);
    await expectFailure(() => workspace.moveFrame('hero/walk', 0, 3), 'INVALID_INPUT');
    await expectFailure(() => workspace.setFrame('hero/walk', 2, undefined, 100), 'INVALID_INPUT');
    await expectFailure(() => workspace.removeFrame('hero/walk', 2), 'INVALID_INPUT');
  });
});

describe('atlases and derived groups', () => {
  it('derives groups from the first identifier segment', async () => {
    const { workspace } = await seededWorkspace();
    await addHeroSprite(workspace);
    await workspace.duplicateSprite('hero/idle_0', 'npc/guard/0');
    expect(await workspace.listGroups()).toEqual([
      { name: 'hero', spriteIds: ['hero/idle_0'] },
      { name: 'npc', spriteIds: ['npc/guard/0'] },
    ]);
    await expectFailure(() => workspace.showGroup('npc/guard'), 'INVALID_INPUT');
    await expectFailure(() => workspace.showGroup('missing'), 'NOT_FOUND');
  });

  it('keeps atlas names unique and validates size and gap', async () => {
    const { workspace } = await seededWorkspace();
    await workspace.addAtlas('characters', 64, 1);
    await expectFailure(() => workspace.addAtlas('CHARACTERS', 64), 'ALREADY_EXISTS');
    await expectFailure(() => workspace.addAtlas('other', 0), 'INVALID_INPUT');
    await expectFailure(() => workspace.addAtlas('other', 64, 64), 'INVALID_INPUT');
    await expectFailure(() => workspace.setAtlas('characters'), 'INVALID_INPUT');
  });

  it('assigns every group to at most one atlas', async () => {
    const { workspace } = await seededWorkspace();
    await addHeroSprite(workspace);
    await workspace.addAtlas('characters', 64);
    await workspace.addAtlas('second', 64);
    await expectFailure(() => workspace.assignGroup('characters', 'missing'), 'NOT_FOUND');
    await workspace.assignGroup('characters', 'hero');
    await expectFailure(() => workspace.assignGroup('characters', 'hero'), 'ALREADY_EXISTS');
    await expectFailure(() => workspace.assignGroup('second', 'hero'), 'ALREADY_EXISTS');
    await expectFailure(() => workspace.unassignGroup('second', 'hero'), 'NOT_FOUND');
    await workspace.unassignGroup('characters', 'hero');
    await expectFailure(() => workspace.removeAtlas('missing'), 'NOT_FOUND');
  });
});

describe('filesystem workflows', () => {
  it('plans and applies moves while keeping definitions in sync', async () => {
    const { workspace, files } = await seededWorkspace();
    files.addDirectory('entities');
    await addHeroSprite(workspace);
    const plan = await workspace.planMove('hero.png', 'entities/hero.png');
    expect(plan.definitions).toEqual(['hero.png']);
    expect(plan.directoriesToCreate).toEqual([]);
    await workspace.movePath('hero.png', 'entities/hero.png');
    expect(files.has('entities/hero.png')).toBe(true);
    expect((await workspace.showSprite('hero/idle_0')).path).toBe('entities/hero.png');
    await expectFailure(
      () => workspace.planMove('entities/hero.png', 'entities/hero.aseprite'),
      'INVALID_INPUT',
    );
    await expectFailure(() => workspace.planMove('entities', 'entities/nested'), 'INVALID_INPUT');
    await expectFailure(
      () => workspace.planMove('entities/hero.png', 'entities'),
      'ALREADY_EXISTS',
    );
  });

  it('plans directories to create for nested moves', async () => {
    const { workspace, files } = await seededWorkspace();
    files.addDirectory('entities');
    files.addFile('entities/hero.png');
    const plan = await workspace.planMove('entities/hero.png', 'characters/heroes/hero.png');
    expect(plan.directoriesToCreate).toEqual(['characters', 'characters/heroes']);
    await workspace.movePath('entities/hero.png', 'characters/heroes/hero.png');
    expect(files.has('characters/heroes/hero.png')).toBe(true);
  });

  it('requires recursive removal and restores files when the metadata write fails', async () => {
    const { workspace, store, files } = await seededWorkspace();
    files.addDirectory('entities');
    files.addFile('entities/notes.txt');
    await expectFailure(() => workspace.removePath('entities', false), 'INVALID_INPUT');

    let failNext = true;
    const flaky: RepositoryStore = {
      read: () => store.read(),
      write: async (database) => {
        if (failNext) {
          failNext = false;
          throw new PipelineError('INVALID_REPOSITORY', 'write failed');
        }
        await store.write(database);
      },
    };
    const flakyWorkspace = new RepositoryWorkspace({
      store: flaky,
      files,
      now: () => '2026-01-01T00:00:00.000Z',
    });
    await expectFailure(() => flakyWorkspace.removePath('entities', true), 'INVALID_REPOSITORY');
    expect(files.has('entities/notes.txt')).toBe(true);
  });
});

describe('listing, validation and build planning', () => {
  it('classifies files as defined, undefined or missing', async () => {
    const { workspace, files } = await seededWorkspace();
    await addHeroSprite(workspace);
    files.addFile('untracked.png');
    files.addFile('gone.png');
    await workspace.addSprite(
      'gone.png',
      'gone/0',
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0, y: 0 },
    );
    // Remove the file behind the workspace so db.json keeps the path.
    const removal = await files.stageRemoval('gone.png');
    await removal.commit();
    const listed = await workspace.list();
    const byPath = Object.fromEntries(listed.map((entry) => [entry.path, entry.status]));
    expect(byPath['hero.png']).toBe('defined');
    expect(byPath['untracked.png']).toBe('undefined');
    expect(byPath['gone.png']).toBe('missing');
  });

  it('reports rectangles outside the canvas and incomplete atlas assignments', async () => {
    const { workspace, store } = await seededWorkspace();
    await addHeroSprite(workspace);
    await workspace.duplicateSprite('hero/idle_0', 'npc/guard_0');
    store.seed({
      ...store.snapshot()!,
      sources: {
        'hero.png': {
          sprites: {
            'hero/idle_0': { x: 32, y: 32, width: 64, height: 64, pivot: { x: 0.5, y: 1 } },
            'npc/guard_0': { x: 0, y: 0, width: 8, height: 8, pivot: { x: 0.5, y: 1 } },
          },
          animations: {},
        },
      },
    });
    const issues = await workspace.validate();
    expect(issues.some((issue) => issue.includes('Región fuera de la imagen'))).toBe(true);

    await workspace.addAtlas('characters', 64);
    await workspace.assignGroup('characters', 'hero');
    const atlasIssues = await workspace.validate();
    expect(atlasIssues.some((issue) => issue.includes('Grupos sin atlas'))).toBe(true);
  });

  it('plans a deterministic build once every group is assigned', async () => {
    const { workspace } = await seededWorkspace();
    await expectFailure(() => workspace.planBuild(), 'INVALID_INPUT');
    await addHeroSprite(workspace);
    await expectFailure(() => workspace.planBuild(), 'INVALID_INPUT');
    await workspace.addAtlas('characters', 64, 0);
    await workspace.assignGroup('characters', 'hero');
    const plan = await workspace.planBuild();
    expect(plan.index).toEqual({ 'hero/idle_0': 'characters_0.png' });
    expect(plan.pages).toHaveLength(1);
    expect(plan.pages[0]!.sprites[0]).toMatchObject({ id: 'hero/idle_0', x: 0, y: 0 });
  });
});
