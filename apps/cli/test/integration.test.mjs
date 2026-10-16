import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.js');
const png = await sharp({
  create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .png()
  .toBuffer();

async function temporaryRepository(action) {
  const root = await mkdtemp(join(tmpdir(), 'assets-pipeline-test-'));
  try {
    await action(root);
  } finally {
    const parent = resolve(tmpdir());
    assert.ok(resolve(root).startsWith(`${parent}${sep}assets-pipeline-test-`));
    await rm(root, { recursive: true, force: true });
  }
}

function run(root, ...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

function succeeds(root, ...args) {
  const result = run(root, ...args);
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}`);
  return result.stdout;
}

function fails(root, code, ...args) {
  const result = run(root, ...args);
  assert.equal(result.status, 1, `${args.join(' ')} unexpectedly succeeded`);
  assert.match(result.stderr, new RegExp(code));
}

test('CLI preserves definitions across file moves and guards referenced sprites', async () => {
  await temporaryRepository(async (root) => {
    await writeFile(join(root, 'hero.png'), png);
    succeeds(root, 'init', 'My RPG Assets');
    assert.match(succeeds(root, 'ls', '--untracked'), /hero\.png/);
    succeeds(
      root,
      'sprite',
      'add',
      'hero.png',
      '--id',
      'npc/hero/idle_0',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    assert.match(succeeds(root, 'sprite', 'list', 'hero.png'), /npc\/hero\/idle_0/);
    succeeds(root, 'sprite', 'set', 'npc/hero/idle_0', '--rect', '0,0,1,1');
    succeeds(root, 'sprite', 'set', 'npc/hero/idle_0', '--pivot', '0.5,0.9');
    assert.equal(
      JSON.parse(succeeds(root, 'sprite', 'show', 'npc/hero/idle_0')).sprite.pivot.y,
      0.9,
    );
    succeeds(root, 'animation', 'add', 'hero.png', '--id', 'npc/hero/idle', '--playback', 'loop');
    succeeds(
      root,
      'animation',
      'frame',
      'add',
      'npc/hero/idle',
      '--sprite',
      'npc/hero/idle_0',
      '--duration',
      '120',
    );
    fails(root, 'IN_USE', 'sprite', 'rm', 'npc/hero/idle_0', '--yes');
    succeeds(root, 'sprite', 'rename', 'npc/hero/idle_0', 'npc/hero/stand_0');
    assert.match(succeeds(root, 'animation', 'show', 'npc/hero/idle'), /npc\/hero\/stand_0/);
    succeeds(root, 'fs', 'mkdir', 'entities');
    succeeds(root, 'fs', 'move', 'hero.png', 'entities/hero.png', '--dry-run');
    assert.match(succeeds(root, 'ls'), /defined\s+hero\.png/);
    succeeds(root, 'fs', 'move', 'hero.png', 'entities/hero.png', '--yes');
    assert.match(succeeds(root, 'sprite', 'show', 'npc/hero/stand_0'), /entities\/hero\.png/);
    succeeds(root, 'fs', 'rename', 'entities/hero.png', 'hero2.png', '--yes');
    assert.match(succeeds(root, 'sprite', 'show', 'npc/hero/stand_0'), /entities\/hero2\.png/);
    succeeds(root, 'validate');
    fails(root, 'INVALID_INPUT', 'fs', 'rm', 'entities/hero2.png');
    succeeds(root, 'fs', 'rm', 'entities/hero2.png', '--yes');
    assert.match(succeeds(root, 'status'), /defined: 0/);
    const database = JSON.parse(
      await readFile(join(root, '.assets-pipeline-cache', 'db.json'), 'utf8'),
    );
    assert.deepEqual(database.sources, {});
  });
});

test('recursive removal previews untracked files and requires both flags', async () => {
  await temporaryRepository(async (root) => {
    succeeds(root, 'init', 'Folder test');
    await mkdir(join(root, 'entities'));
    await writeFile(join(root, 'entities', 'notes.txt'), 'notes');
    assert.match(succeeds(root, 'fs', 'rm', 'entities', '--dry-run'), /notes\.txt/);
    fails(root, 'INVALID_INPUT', 'fs', 'rm', 'entities', '--yes');
    fails(root, 'INVALID_INPUT', 'fs', 'rm', 'entities', '--recursive');
    succeeds(root, 'fs', 'rm', 'entities', '--recursive', '--yes');
  });
});

test('version 1 metadata migrates without dropping original records', async () => {
  await temporaryRepository(async (root) => {
    await mkdir(join(root, '.assets-pipeline-cache'));
    await writeFile(join(root, 'hero.png'), png);
    const previous = {
      schemaVersion: 1,
      project: {
        id: 'old-id',
        name: 'Old',
        schemaVersion: 1,
        createdAt: '2020',
        updatedAt: '2020',
      },
      assets: [
        {
          id: 'asset',
          sourcePath: 'hero.png',
          kind: 'png',
          importedAt: '2020',
          metadata: { note: 'keep' },
        },
      ],
      operationHistory: [],
    };
    await writeFile(join(root, '.assets-pipeline-cache', 'db.json'), JSON.stringify(previous));
    succeeds(
      root,
      'sprite',
      'add',
      'hero.png',
      '--id',
      'hero/idle',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    const database = JSON.parse(
      await readFile(join(root, '.assets-pipeline-cache', 'db.json'), 'utf8'),
    );
    assert.equal(database.schemaVersion, 4);
    assert.deepEqual(database.atlases, {});
    assert.deepEqual(database.legacy.assets, previous.assets);
    assert.ok(database.sources['hero.png'].sprites['hero/idle']);
  });
});

test('version 2 metadata gains atlas configuration on the next write', async () => {
  await temporaryRepository(async (root) => {
    await mkdir(join(root, '.assets-pipeline-cache'));
    await writeFile(
      join(root, '.assets-pipeline-cache', 'db.json'),
      JSON.stringify({
        schemaVersion: 2,
        project: { id: 'v2-id', name: 'Version 2', createdAt: '2020', updatedAt: '2020' },
        sources: {},
      }),
    );
    assert.match(succeeds(root, 'info'), /Esquema: 4/);
    succeeds(root, 'atlas', 'add', 'characters', '--size', '64');
    const database = JSON.parse(
      await readFile(join(root, '.assets-pipeline-cache', 'db.json'), 'utf8'),
    );
    assert.equal(database.schemaVersion, 4);
    assert.deepEqual(database.atlases, { characters: { size: 64, gap: 0, groups: [] } });
  });
});

test('version 3 atlas metadata migrates with a zero gap', async () => {
  await temporaryRepository(async (root) => {
    await mkdir(join(root, '.assets-pipeline-cache'));
    await writeFile(
      join(root, '.assets-pipeline-cache', 'db.json'),
      JSON.stringify({
        schemaVersion: 3,
        project: { id: 'v3-id', name: 'Version 3', createdAt: '2020', updatedAt: '2020' },
        sources: {},
        atlases: { characters: { size: 64, groups: [] } },
      }),
    );
    assert.match(succeeds(root, 'info'), /Esquema: 4/);
    succeeds(root, 'atlas', 'set', 'characters', '--gap', '2');
    const database = JSON.parse(
      await readFile(join(root, '.assets-pipeline-cache', 'db.json'), 'utf8'),
    );
    assert.deepEqual(database.atlases.characters, { size: 64, gap: 2, groups: [] });
  });
});

test('folder moves rewrite every source path and reject invalid sprite references', async () => {
  await temporaryRepository(async (root) => {
    await mkdir(join(root, 'entities'));
    await writeFile(join(root, 'entities', 'hero.png'), png);
    await writeFile(join(root, 'entities', 'enemy.png'), png);
    succeeds(root, 'init', 'Folder move');
    succeeds(
      root,
      'sprite',
      'add',
      'entities/hero.png',
      '--id',
      'hero/idle',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    succeeds(
      root,
      'sprite',
      'add',
      'entities/enemy.png',
      '--id',
      'enemy/idle',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    fails(
      root,
      'ALREADY_EXISTS',
      'sprite',
      'add',
      'entities/enemy.png',
      '--id',
      'hero/idle',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    fails(
      root,
      'INVALID_INPUT',
      'sprite',
      'add',
      'entities/hero.png',
      '--id',
      'hero/too-big',
      '--rect',
      '0,0,2,1',
      '--pivot',
      '0.5,1',
    );
    succeeds(
      root,
      'animation',
      'add',
      'entities/hero.png',
      '--id',
      'hero/walk',
      '--playback',
      'loop',
    );
    fails(
      root,
      'INVALID_INPUT',
      'animation',
      'frame',
      'add',
      'hero/walk',
      '--sprite',
      'enemy/idle',
      '--duration',
      '100',
    );
    succeeds(root, 'fs', 'mkdir', 'characters');
    succeeds(root, 'fs', 'move', 'entities', 'characters/entities', '--yes');
    const database = JSON.parse(
      await readFile(join(root, '.assets-pipeline-cache', 'db.json'), 'utf8'),
    );
    assert.deepEqual(Object.keys(database.sources).sort(), [
      'characters/entities/enemy.png',
      'characters/entities/hero.png',
    ]);
    fails(
      root,
      'INVALID_INPUT',
      'fs',
      'move',
      'characters/entities/hero.png',
      'characters/entities/hero.aseprite',
      '--yes',
    );
    succeeds(root, 'validate');
  });
});

test('frame positions are zero-based and edits preserve order', async () => {
  await temporaryRepository(async (root) => {
    await writeFile(join(root, 'hero.png'), png);
    succeeds(root, 'init', 'Frame test');
    succeeds(
      root,
      'sprite',
      'add',
      'hero.png',
      '--id',
      'hero/0',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    succeeds(root, 'sprite', 'duplicate', 'hero/0', '--id', 'hero/1');
    succeeds(root, 'animation', 'add', 'hero.png', '--id', 'hero/walk', '--playback', 'loop');
    succeeds(
      root,
      'animation',
      'frame',
      'add',
      'hero/walk',
      '--sprite',
      'hero/0',
      '--duration',
      '100',
    );
    succeeds(
      root,
      'animation',
      'frame',
      'insert',
      'hero/walk',
      '--at',
      '0',
      '--sprite',
      'hero/1',
      '--duration',
      '150',
    );
    succeeds(root, 'animation', 'frame', 'set', 'hero/walk', '--at', '1', '--duration', '200');
    succeeds(root, 'animation', 'frame', 'move', 'hero/walk', '--from', '0', '--to', '2');
    succeeds(root, 'animation', 'set', 'hero/walk', '--playback', 'once');
    const result = JSON.parse(succeeds(root, 'animation', 'show', 'hero/walk'));
    assert.equal(result.animation.playback, 'once');
    assert.deepEqual(result.animation.frames, [
      { sprite: 'hero/0', durationMs: 200 },
      { sprite: 'hero/1', durationMs: 150 },
    ]);
    succeeds(root, 'animation', 'frame', 'rm', 'hero/walk', '--at', '1', '--yes');
    succeeds(root, 'animation', 'rm', 'hero/walk', '--yes');
    succeeds(root, 'sprite', 'rm', 'hero/1', '--yes');
  });
});

test('Aseprite headers and invalid repository JSON are handled explicitly', async () => {
  await temporaryRepository(async (root) => {
    const aseprite = Buffer.alloc(144);
    aseprite.writeUInt32LE(144, 0);
    aseprite.writeUInt16LE(0xa5e0, 4);
    aseprite.writeUInt16LE(1, 6);
    aseprite.writeUInt16LE(32, 8);
    aseprite.writeUInt16LE(32, 10);
    aseprite.writeUInt16LE(32, 12);
    aseprite.writeUInt32LE(16, 128);
    aseprite.writeUInt16LE(0xf1fa, 132);
    await writeFile(join(root, 'hero.aseprite'), aseprite);
    succeeds(root, 'init', 'Aseprite test');
    succeeds(
      root,
      'sprite',
      'add',
      'hero.aseprite',
      '--id',
      'hero/idle',
      '--rect',
      '0,0,32,32',
      '--pivot',
      '0.5,1',
    );
    succeeds(root, 'validate');
    await writeFile(join(root, '.assets-pipeline-cache', 'db.json'), '{invalid');
    fails(root, 'INVALID_REPOSITORY', 'validate');
  });
});

test('init --path creates a separate root and --repo selects it', async () => {
  await temporaryRepository(async (root) => {
    await mkdir(join(root, 'game-assets'));
    succeeds(root, 'init', 'My RPG Assets', '--path', 'game-assets');
    assert.match(succeeds(root, '--repo', 'game-assets', 'info'), /My RPG Assets/);
    fails(root, 'ALREADY_EXISTS', 'init', 'Nested', '--path', 'game-assets');
    await mkdir(join(root, 'game-assets', 'nested'));
    fails(root, 'ALREADY_EXISTS', 'init', 'Nested', '--path', 'game-assets/nested');
  });
});

test('folder move creates missing destination parents shown by dry-run', async () => {
  await temporaryRepository(async (root) => {
    succeeds(root, 'init', 'Move test');
    succeeds(root, 'fs', 'mkdir', 'entities/humans');
    await writeFile(join(root, 'entities', 'humans', 'hero.png'), png);
    const preview = succeeds(
      root,
      'fs',
      'move',
      'entities/humans',
      'entities/npcs/humans',
      '--dry-run',
    );
    assert.match(preview, /entities\/npcs\//);
    succeeds(root, 'fs', 'move', 'entities/humans', 'entities/npcs/humans', '--yes');
    assert.match(succeeds(root, 'ls'), /entities\/npcs\/humans\/hero\.png/);
  });
});

test('groups are derived from sprite IDs and atlas assignments are exclusive', async () => {
  await temporaryRepository(async (root) => {
    await writeFile(join(root, 'hero.png'), png);
    succeeds(root, 'init', 'Atlas groups');
    succeeds(
      root,
      'sprite',
      'add',
      'hero.png',
      '--id',
      'npc/hero/idle',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    assert.deepEqual(JSON.parse(succeeds(root, 'group', 'list')), [
      { name: 'npc', spriteIds: ['npc/hero/idle'] },
    ]);
    succeeds(root, 'atlas', 'add', 'characters', '--size', '64');
    succeeds(root, 'atlas', 'add', 'duplicate', '--size', '64');
    succeeds(root, 'atlas', 'group', 'add', 'characters', 'npc');
    fails(root, 'ALREADY_EXISTS', 'atlas', 'group', 'add', 'duplicate', 'npc');
    fails(root, 'NOT_FOUND', 'atlas', 'group', 'add', 'characters', 'missing');
    fails(root, 'INVALID_SOURCE', 'validate');
    succeeds(root, 'atlas', 'rm', 'duplicate', '--yes');
    succeeds(root, 'validate');
  });
});

test('build creates a JSON beside every PNG and applies the configured gap', async () => {
  await temporaryRepository(async (root) => {
    await writeFile(join(root, 'hero.png'), png);
    succeeds(root, 'init', 'Atlas build');
    succeeds(
      root,
      'sprite',
      'add',
      'hero.png',
      '--id',
      'npc/one',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    succeeds(root, 'sprite', 'duplicate', 'npc/one', '--id', 'npc/two');
    succeeds(root, 'atlas', 'add', 'characters', '--size', '2', '--gap', '1');
    succeeds(root, 'atlas', 'group', 'add', 'characters', 'npc');
    succeeds(root, 'build', '--output', 'generated/assets');
    const index = JSON.parse(
      await readFile(join(root, 'generated', 'assets', 'index.json'), 'utf8'),
    );
    assert.deepEqual(index, {
      'npc/one': 'characters_0.png',
      'npc/two': 'characters_1.png',
    });
    const firstPage = JSON.parse(
      await readFile(join(root, 'generated', 'assets', 'characters_0.json'), 'utf8'),
    );
    const secondPage = JSON.parse(
      await readFile(join(root, 'generated', 'assets', 'characters_1.json'), 'utf8'),
    );
    assert.deepEqual(firstPage, {
      sprites: {
        'npc/one': { x: 0, y: 0, width: 1, height: 1, pivot: { x: 0.5, y: 1 } },
      },
      animations: {},
    });
    assert.deepEqual(secondPage, {
      sprites: {
        'npc/two': { x: 0, y: 0, width: 1, height: 1, pivot: { x: 0.5, y: 1 } },
      },
      animations: {},
    });
    assert.equal(Object.hasOwn(firstPage.sprites['npc/one'], 'atlas'), false);
    await access(join(root, 'generated', 'assets', 'characters_0.png'));
    await access(join(root, 'generated', 'assets', 'characters_1.png'));
    await assert.rejects(access(join(root, 'generated', 'assets', 'manifest.json')));
    assert.match(succeeds(root, 'status'), /undefined: 0/);
    assert.doesNotMatch(succeeds(root, 'ls', '--untracked'), /characters_0\.png/);
    succeeds(root, 'animation', 'add', 'hero.png', '--id', 'npc/walk', '--playback', 'loop');
    succeeds(
      root,
      'animation',
      'frame',
      'add',
      'npc/walk',
      '--sprite',
      'npc/one',
      '--duration',
      '100',
    );
    succeeds(
      root,
      'animation',
      'frame',
      'add',
      'npc/walk',
      '--sprite',
      'npc/two',
      '--duration',
      '120',
    );
    fails(root, 'INVALID_INPUT', 'build', '--output', 'generated/assets');
    succeeds(root, 'atlas', 'set', 'characters', '--size', '3', '--gap', '1');
    succeeds(root, 'build', '--output', 'generated/assets', '--clean');
    const compactedPage = JSON.parse(
      await readFile(join(root, 'generated', 'assets', 'characters_0.json'), 'utf8'),
    );
    assert.equal(compactedPage.sprites['npc/one'].x, 0);
    assert.equal(compactedPage.sprites['npc/two'].x, 2);
    assert.deepEqual(compactedPage.animations, {
      'npc/walk': {
        playback: 'loop',
        frames: [
          { sprite: 'npc/one', durationMs: 100 },
          { sprite: 'npc/two', durationMs: 120 },
        ],
      },
    });
    await assert.rejects(access(join(root, 'generated', 'assets', 'characters_1.json')));
    fails(root, 'INVALID_INPUT', 'atlas', 'set', 'characters', '--gap', '3');
    fails(root, 'INVALID_INPUT', 'atlas', 'set', 'characters');
  });
});

test('build rejects empty animations and animations whose frames use different atlases', async () => {
  await temporaryRepository(async (root) => {
    await writeFile(join(root, 'hero.png'), png);
    succeeds(root, 'init', 'Animation atlas rules');
    succeeds(
      root,
      'sprite',
      'add',
      'hero.png',
      '--id',
      'npc/one',
      '--rect',
      '0,0,1,1',
      '--pivot',
      '0.5,1',
    );
    succeeds(root, 'sprite', 'duplicate', 'npc/one', '--id', 'player/two');
    succeeds(root, 'atlas', 'add', 'characters', '--size', '8');
    succeeds(root, 'atlas', 'add', 'players', '--size', '8');
    succeeds(root, 'atlas', 'group', 'add', 'characters', 'npc');
    succeeds(root, 'atlas', 'group', 'add', 'players', 'player');
    succeeds(root, 'animation', 'add', 'hero.png', '--id', 'mixed/walk', '--playback', 'loop');
    fails(root, 'INVALID_INPUT', 'build');
    succeeds(
      root,
      'animation',
      'frame',
      'add',
      'mixed/walk',
      '--sprite',
      'npc/one',
      '--duration',
      '100',
    );
    succeeds(
      root,
      'animation',
      'frame',
      'add',
      'mixed/walk',
      '--sprite',
      'player/two',
      '--duration',
      '100',
    );
    fails(root, 'INVALID_INPUT', 'build');
  });
});
