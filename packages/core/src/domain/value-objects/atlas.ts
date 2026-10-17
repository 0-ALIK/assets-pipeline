import { PipelineError } from '../errors.js';

const atlasNamePattern = /^[\p{L}\p{N}_-]+$/u;

/** Atlas name value object: file base name without paths or extension. */
export function assertAtlasName(name: string): void {
  if (typeof name !== 'string' || !atlasNamePattern.test(name) || name === '.' || name === '..') {
    throw new PipelineError('INVALID_INPUT', `Nombre de atlas inválido: ${name}`);
  }
}

/** Square page size in pixels. */
export function assertAtlasSize(size: number): void {
  if (!Number.isInteger(size) || size <= 0 || size > 8192) {
    throw new PipelineError(
      'INVALID_INPUT',
      'El tamaño del atlas debe ser un entero entre 1 y 8192 píxeles.',
    );
  }
}

/** Transparent separation between sprites and rows; must be smaller than the page. */
export function assertAtlasGap(gap: number, size: number): void {
  if (!Number.isInteger(gap) || gap < 0 || gap >= size) {
    throw new PipelineError(
      'INVALID_INPUT',
      'El gap del atlas debe ser un entero entre 0 y tamaño - 1 píxeles.',
    );
  }
}
