import type { Rectangle } from '../../domain/repository.js';

export interface DetectContentRegionsInput {
  /** Canvas size in pixels. */
  readonly width: number;
  readonly height: number;
  /** RGBA pixels, row-major, 4 bytes per pixel. */
  readonly data: Uint8Array;
  /** Regions already defined in the file; content touching them is skipped. */
  readonly occupied: readonly Rectangle[];
  /** Extra pixels around each detected box; falls back when the margin collides. */
  readonly padding: number;
}

export interface DetectContentRegionsResult {
  readonly regions: readonly Rectangle[];
  /** Content islands discarded because they collided with an existing region. */
  readonly skipped: number;
}

function intersects(left: Rectangle, right: Rectangle): boolean {
  return (
    left.x < right.x + right.width &&
    right.x < left.x + left.width &&
    left.y < right.y + right.height &&
    right.y < left.y + left.height
  );
}

function clampRectangle(rect: Rectangle, width: number, height: number): Rectangle {
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  return {
    x,
    y,
    width: Math.min(rect.width, width - x),
    height: Math.min(rect.height, height - y),
  };
}

/**
 * Groups opaque pixels (alpha > 0) into 4-connected components and returns one
 * bounding box per component. Uses a scanline flood fill so the stack holds
 * spans instead of pixels.
 */
function findComponents(width: number, height: number, data: Uint8Array): readonly Rectangle[] {
  const total = width * height;
  const visited = new Uint8Array(total);
  const solid = (index: number): boolean => data[index * 4 + 3]! > 0;
  const stack: number[] = [];
  const components: Rectangle[] = [];

  for (let seed = 0; seed < total; seed += 1) {
    if (visited[seed] === 1 || !solid(seed)) continue;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    stack.push(seed % width, Math.floor(seed / width));

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      if (y < 0 || y >= height || x < 0 || x >= width) continue;
      const rowStart = y * width;
      if (visited[rowStart + x] === 1 || !solid(rowStart + x)) continue;

      let left = x;
      while (left > 0 && visited[rowStart + left - 1] === 0 && solid(rowStart + left - 1)) {
        left -= 1;
      }
      let right = x;
      while (
        right < width - 1 &&
        visited[rowStart + right + 1] === 0 &&
        solid(rowStart + right + 1)
      ) {
        right += 1;
      }
      for (let column = left; column <= right; column += 1) {
        visited[rowStart + column] = 1;
      }
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (const nextY of [y - 1, y + 1]) {
        if (nextY < 0 || nextY >= height) continue;
        const nextRow = nextY * width;
        let inRun = false;
        for (let column = left; column <= right; column += 1) {
          const index = nextRow + column;
          const candidate = visited[index] === 0 && solid(index);
          if (candidate && !inRun) {
            stack.push(column, nextY);
            inRun = true;
          } else if (!candidate) {
            inRun = false;
          }
        }
      }
    }

    components.push({
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }

  return components.sort((left, right) => left.y - right.y || left.x - right.x);
}

/**
 * Detects the content islands of an image and returns non-overlapping regions.
 * Existing regions are never covered: islands whose box intersects one are
 * skipped, and padding shrinks to the unpadded box when it would collide.
 */
export function detectContentRegions(input: DetectContentRegionsInput): DetectContentRegionsResult {
  const { width, height, data, occupied, padding } = input;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Dimensiones de imagen inválidas.');
  }
  const components = findComponents(width, height, data);
  const accepted: Rectangle[] = [];
  const blocked: Rectangle[] = [...occupied];
  let skipped = 0;

  for (const box of components) {
    if (blocked.some((region) => intersects(box, region))) {
      skipped += 1;
      continue;
    }
    let candidate = clampRectangle(
      {
        x: box.x - padding,
        y: box.y - padding,
        width: box.width + padding * 2,
        height: box.height + padding * 2,
      },
      width,
      height,
    );
    if (blocked.some((region) => intersects(candidate, region))) {
      candidate = box;
      if (blocked.some((region) => intersects(candidate, region))) {
        skipped += 1;
        continue;
      }
    }
    accepted.push(candidate);
    blocked.push(candidate);
  }

  return { regions: accepted, skipped };
}
