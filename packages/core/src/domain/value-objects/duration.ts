import { PipelineError } from '../errors.js';

/** Frame duration value object: positive integer milliseconds. */
export function assertDuration(durationMs: number): void {
  if (!Number.isInteger(durationMs) || durationMs <= 0) {
    throw new PipelineError(
      'INVALID_INPUT',
      'La duración debe ser un entero positivo en milisegundos.',
    );
  }
}
