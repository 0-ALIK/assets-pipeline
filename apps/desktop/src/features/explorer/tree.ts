import type { FileEntry, ListedFile } from '@assets-pipeline/core';

export interface TreeNode {
  readonly name: string;
  readonly path: string;
  readonly kind: FileEntry['kind'];
  readonly status: ListedFile['status'];
  readonly children: readonly TreeNode[];
}

export function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

export function fileName(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

export function childPath(parent: string, name: string): string {
  return parent === '' ? name : `${parent}/${name}`;
}

interface MutableNode {
  name: string;
  path: string;
  kind: FileEntry['kind'];
  status: ListedFile['status'];
  children: MutableNode[];
}

/** Builds a sorted tree (directories first) from the flat repository listing. */
export function buildFileTree(files: readonly ListedFile[]): readonly TreeNode[] {
  const nodes = new Map<string, MutableNode>();
  const roots: MutableNode[] = [];

  const ensureDirectory = (path: string): MutableNode => {
    const existing = nodes.get(path);
    if (existing) return existing;
    const node: MutableNode = {
      name: fileName(path),
      path,
      kind: 'directory',
      status: 'other',
      children: [],
    };
    nodes.set(path, node);
    const parent = parentPath(path);
    if (parent === '') roots.push(node);
    else ensureDirectory(parent).children.push(node);
    return node;
  };

  for (const file of files) {
    const node: MutableNode = {
      name: fileName(file.path),
      path: file.path,
      kind: file.kind,
      status: file.status,
      children: [],
    };
    nodes.set(file.path, node);
    const parent = parentPath(file.path);
    if (parent === '') roots.push(node);
    else ensureDirectory(parent).children.push(node);
  }

  const sortNodes = (list: MutableNode[]): void => {
    list.sort((left, right) => {
      const leftDirectory = left.kind === 'directory' ? 0 : 1;
      const rightDirectory = right.kind === 'directory' ? 0 : 1;
      return leftDirectory - rightDirectory || left.name.localeCompare(right.name);
    });
    for (const node of list) sortNodes(node.children);
  };
  sortNodes(roots);

  return roots;
}

/** Ancestors of a path, nearest first, used to reveal a file in the tree. */
export function ancestorDirectories(path: string): readonly string[] {
  const ancestors: string[] = [];
  let parent = parentPath(path);
  while (parent !== '') {
    ancestors.push(parent);
    parent = parentPath(parent);
  }
  return ancestors;
}
