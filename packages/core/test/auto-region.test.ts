import { describe, expect, it } from 'vitest';
import { RepositoryWorkspace, detectContentRegions } from '../src/index.js';
import type { AssetImporter } from '../src/index.js';
import { MemoryFiles, MemoryStore, fixedNow } from './memory-ports.js';

type Pixel = { readonly x: number; readonly y: number };

function rgba(width: number, height: number, pixels: readonly Pixel[]): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (const { x, y } of pixels) {
    const index = (y * width + x) * 4;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  }
  return data;
}

function fakeImporter(width: number, height: number, pixels: readonly Pixel[]): AssetImporter {
  const payload = rgba(width, height, pixels);
  return {
    format: 'test',
    canImport: (path) => path.toLowerCase().endsWith('.png'),
    import: async () => ({
      kind: 'image',
      metadata: { width, height },
      payload,
    }),
  };
}

function block(x: number, y: number, size = 2): readonly Pixel[] {
  return Array.from({ length: size * size }, (_, index) => ({
    x: x + (index % size),
    y: y + Math.floor(index / size),
  }));
}

async function autoWorkspace(
  pixels: readonly Pixel[],
  width = 8,
  height = 8,
): Promise<{ workspace: RepositoryWorkspace; store: MemoryStore; files: MemoryFiles }> {
  const store = new MemoryStore();
  const files = new MemoryFiles();
  files.addFile('parts.png', { width, height });
  const workspace = new RepositoryWorkspace({
    store,
    files,
    now: () => fixedNow,
    importers: [fakeImporter(width, height, pixels)],
  });
  await workspace.initialize('Auto region', 'project-id');
  return { workspace, store, files };
}

describe('detectContentRegions', () => {
  it('returns one box per content island sorted top-to-bottom and left-to-right', () => {
    const result = detectContentRegions({
      width: 8,
      height: 8,
      data: rgba(8, 8, [...block(5, 5), ...block(1, 1)]),
      occupied: [],
      padding: 0,
    });
    expect(result.regions).toEqual([
      { x: 1, y: 1, width: 2, height: 2 },
      { x: 5, y: 5, width: 2, height: 2 },
    ]);
    expect(result.skipped).toBe(0);
  });

  it('treats diagonal pixels as separate islands', () => {
    const result = detectContentRegions({
      width: 4,
      height: 4,
      data: rgba(4, 4, [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
      occupied: [],
      padding: 0,
    });
    expect(result.regions).toHaveLength(2);
  });

  it('merges a solid image into a single region', () => {
    const pixels = Array.from({ length: 16 }, (_, index) => ({
      x: index % 4,
      y: Math.floor(index / 4),
    }));
    const result = detectContentRegions({
      width: 4,
      height: 4,
      data: rgba(4, 4, pixels),
      occupied: [],
      padding: 0,
    });
    expect(result.regions).toEqual([{ x: 0, y: 0, width: 4, height: 4 }]);
  });

  it('expands each box by the padding, clamped to the canvas', () => {
    const result = detectContentRegions({
      width: 8,
      height: 8,
      data: rgba(8, 8, block(1, 1)),
      occupied: [],
      padding: 1,
    });
    expect(result.regions).toEqual([{ x: 0, y: 0, width: 4, height: 4 }]);
  });

  it('falls back to the unpadded box when the margin collides', () => {
    const result = detectContentRegions({
      width: 10,
      height: 10,
      data: rgba(10, 10, block(5, 5)),
      occupied: [{ x: 0, y: 0, width: 4, height: 4 }],
      padding: 3,
    });
    expect(result.regions).toEqual([{ x: 5, y: 5, width: 2, height: 2 }]);
  });

  it('skips content that overlaps an existing region', () => {
    const result = detectContentRegions({
      width: 8,
      height: 8,
      data: rgba(8, 8, block(1, 1)),
      occupied: [{ x: 1, y: 1, width: 1, height: 1 }],
      padding: 0,
    });
    expect(result.regions).toEqual([]);
    expect(result.skipped).toBe(1);
  });
});

describe('autoRegionSprites', () => {
  it('plans without writing and creates sorted ids with the default pivot', async () => {
    const { workspace, store } = await autoWorkspace([...block(5, 5), ...block(1, 1)]);
    const plan = await workspace.autoRegionSprites('parts.png', { dryRun: true });
    expect(plan.group).toBe('auto');
    expect(plan.sprites.map((sprite) => sprite.id)).toEqual(['auto/1', 'auto/2']);
    expect(plan.sprites.map((sprite) => sprite.rect)).toEqual([
      { x: 1, y: 1, width: 2, height: 2 },
      { x: 5, y: 5, width: 2, height: 2 },
    ]);
    expect(plan.sprites[0]!.pivot).toEqual({ x: 0.5, y: 1 });
    expect(store.snapshot()!.sources).toEqual({});

    const applied = await workspace.autoRegionSprites('parts.png');
    expect(applied.sprites).toHaveLength(2);
    const source = store.snapshot()!.sources['parts.png']!;
    expect(Object.keys(source.sprites)).toEqual(['auto/1', 'auto/2']);
    expect(source.sprites['auto/1']).toMatchObject({ x: 1, y: 1, pivot: { x: 0.5, y: 1 } });
  });

  it('only adds content that is not already covered', async () => {
    const { workspace, store } = await autoWorkspace([...block(1, 1), ...block(5, 5)]);
    await workspace.autoRegionSprites('parts.png');
    const before = store.snapshot();
    const again = await workspace.autoRegionSprites('parts.png');
    expect(again.sprites).toEqual([]);
    expect(again.skipped).toBe(2);
    expect(store.snapshot()).toEqual(before);
  });

  it('uses a suffixed group when auto already exists', async () => {
    const { workspace } = await autoWorkspace(block(1, 1));
    await workspace.addSprite(
      'parts.png',
      'auto/9',
      { x: 7, y: 0, width: 1, height: 1 },
      { x: 0, y: 0 },
    );
    const plan = await workspace.autoRegionSprites('parts.png', { dryRun: true });
    expect(plan.group).toBe('auto_0');
    expect(plan.sprites[0]!.id).toBe('auto_0/1');
  });

  it('counts islands skipped by an existing definition and applies padding', async () => {
    const { workspace } = await autoWorkspace([...block(1, 1), ...block(7, 7)], 10, 10);
    await workspace.addSprite(
      'parts.png',
      'npc/covered',
      { x: 7, y: 7, width: 1, height: 1 },
      { x: 0, y: 0 },
    );
    const plan = await workspace.autoRegionSprites('parts.png', { padding: 1, dryRun: true });
    expect(plan.skipped).toBe(1);
    expect(plan.sprites).toHaveLength(1);
    expect(plan.sprites[0]!.rect).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });

  it('rejects invalid padding and unsupported files', async () => {
    const { workspace } = await autoWorkspace(block(1, 1));
    await expect(workspace.autoRegionSprites('parts.png', { padding: -1 })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    await expect(workspace.autoRegionSprites('parts.txt')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });
});
