import { PipelineError } from '../errors.js';

const segmentPattern = /^[\p{L}\p{N}_.-]+$/u;
const reservedSegments = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Identifier value object: `/`-separated segments of unicode letters, digits,
 * `_`, `.` and `-`, without empty, dot or prototype-polluting segments.
 */
export function assertIdentifier(id: string): void {
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.startsWith('/') ||
    id.includes('\\') ||
    id.includes(':')
  ) {
    throw new PipelineError('INVALID_INPUT', `ID inválido: ${id}`);
  }
  for (const segment of id.split('/')) {
    if (
      segment === '' ||
      segment === '.' ||
      segment === '..' ||
      reservedSegments.has(segment) ||
      !segmentPattern.test(segment)
    ) {
      throw new PipelineError('INVALID_INPUT', `ID inválido: ${id}`);
    }
  }
}

/** The first segment of an identifier; atlas groups are derived from it. */
export function groupFromIdentifier(id: string): string {
  assertIdentifier(id);
  return id.split('/')[0]!;
}

export function isIdentifier(value: string): boolean {
  try {
    assertIdentifier(value);
    return true;
  } catch {
    return false;
  }
}
