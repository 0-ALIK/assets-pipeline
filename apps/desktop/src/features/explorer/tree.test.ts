import { describe, expect, it } from 'vitest';
import type { ListedFile } from '@assets-pipeline/core';
import { ancestorDirectories, buildFileTree, childPath, fileName, parentPath } from './tree.js';

function entry(
  path: string,
  kind: ListedFile['kind'],
  status: ListedFile['status'],
): ListedFile {
  return { path, kind, status };
}

describe('path helpers', () => {
  it('splits and joins repository paths', () => {
    expect(parentPath('a/b/c.png')).toBe('a/b');
    expect(parentPath('c.png')).toBe('');
    expect(fileName('a/b/c.png')).toBe('c.png');
    expect(fileName('c.png')).toBe('c.png');
    expect(childPath('a/b', 'c.png')).toBe('a/b/c.png');
    expect(childPath('', 'c.png')).toBe('c.png');
  });

  it('lists ancestors from nearest to farthest', () => {
    expect(ancestorDirectories('a/b/c.png')).toEqual(['a/b', 'a']);
    expect(ancestorDirectories('c.png')).toEqual([]);
  });
});

describe('buildFileTree', () => {
  it('nests entries and sorts directories first', () => {
    const tree = buildFileTree([
      entry('hero.png', 'file', 'undefined'),
      entry('entities', 'directory', 'other'),
      entry('entities/npc.aseprite', 'file', 'defined'),
      entry('assets', 'directory', 'other'),
      entry('zeta.txt', 'file', 'other'),
    ]);
    expect(tree.map((node) => node.name)).toEqual(['assets', 'entities', 'hero.png', 'zeta.txt']);
    const entities = tree.find((node) => node.name === 'entities')!;
    expect(entities.children.map((node) => node.path)).toEqual(['entities/npc.aseprite']);
    expect(entities.children[0]!.status).toBe('defined');
  });

  it('creates synthetic parents for orphan entries', () => {
    const tree = buildFileTree([entry('missing/dir/file.png', 'file', 'missing')]);
    expect(tree).toHaveLength(1);
    const missing = tree[0]!;
    expect(missing.path).toBe('missing');
    expect(missing.children[0]!.path).toBe('missing/dir');
    expect(missing.children[0]!.children[0]!.status).toBe('missing');
  });

  it('keeps missing files listed by db.json at the tree root', () => {
    const tree = buildFileTree([entry('gone.png', 'file', 'missing')]);
    expect(tree[0]).toMatchObject({ path: 'gone.png', status: 'missing' });
  });
});
