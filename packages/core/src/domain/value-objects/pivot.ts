import { PipelineError } from '../errors.js';
import type { Pivot, Rectangle } from '../repository.js';

/** Pivot value object: normalized anchor inside a sprite region (0..1). */
export function assertPivot(pivot: Pivot): void {
  if (
    !Number.isFinite(pivot.x) ||
    !Number.isFinite(pivot.y) ||
    pivot.x < 0 ||
    pivot.x > 1 ||
    pivot.y < 0 ||
    pivot.y > 1
  ) {
    throw new PipelineError('INVALID_INPUT', 'El pivot debe estar entre 0 y 1 en ambos ejes.');
  }
}

/** Anchor position of a region in image pixels. */
export function anchorPoint(
  rect: Rectangle,
  pivot: Pivot,
): { readonly x: number; readonly y: number } {
  return { x: rect.x + rect.width * pivot.x, y: rect.y + rect.height * pivot.y };
}
