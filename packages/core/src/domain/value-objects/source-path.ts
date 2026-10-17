import { PipelineError } from '../errors.js';

/** Reserved repository-internal directory; never a manageable source path. */
export const cacheDirectoryName = '.assets-pipeline-cache';

const reservedSegments = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Repository-relative path value object: `/` separators, no absolute paths,
 * backslashes, drive letters, dot segments or prototype-polluting names.
 */
export function assertSourcePath(path: string): void {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes(':')
  ) {
    throw new PipelineError('INVALID_INPUT', `Ruta inválida: ${path}`);
  }
  for (const segment of path.split('/')) {
    if (
      segment === '' ||
      segment === '.' ||
      segment === '..' ||
      reservedSegments.has(segment) ||
      segment.toLowerCase() === cacheDirectoryName
    ) {
      throw new PipelineError('INVALID_INPUT', `Ruta inválida: ${path}`);
    }
  }
}

export function isSupportedSource(path: string): boolean {
  return /\.(png|aseprite)$/i.test(path);
}

export function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

export function pathName(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

export function childPath(parent: string, name: string): string {
  return parent === '' ? name : `${parent}/${name}`;
}

/** True when `path` sits strictly inside `directory`. */
export function isWithin(path: string, directory: string): boolean {
  return path !== directory && path.startsWith(`${directory}/`);
}
