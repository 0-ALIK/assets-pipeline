import { PipelineError } from '../errors.js';
import type { ImageSize } from '../../ports/managed-files.js';
import type { Rectangle } from '../repository.js';

/** Rectangle value object: positive integer region that must fit its canvas. */
export function assertRectangle(rect: Rectangle, width?: number, height?: number): void {
  if (
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    !Number.isInteger(rect.width) ||
    !Number.isInteger(rect.height) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    (width !== undefined && rect.x + rect.width > width) ||
    (height !== undefined && rect.y + rect.height > height)
  ) {
    throw new PipelineError(
      'INVALID_INPUT',
      'La región debe tener enteros positivos y caber en la imagen.',
    );
  }
}

export function rectangleFits(rect: Rectangle, canvas: ImageSize): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= canvas.width &&
    rect.y + rect.height <= canvas.height
  );
}

export function rectanglesEqual(left: Rectangle, right: Rectangle): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
