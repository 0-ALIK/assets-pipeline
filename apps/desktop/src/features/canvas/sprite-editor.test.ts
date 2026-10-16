import { describe, expect, it } from 'vitest';
import {
  clampRect,
  fitZoom,
  handleAtPoint,
  imageToScreen,
  moveRect,
  pivotFromPoint,
  rectContains,
  rectFromDrag,
  resizeRect,
  screenToImage,
} from './sprite-editor.js';

const bounds = { width: 64, height: 64 };

describe('clampRect', () => {
  it('keeps rectangles inside the canvas with a minimum size', () => {
    expect(clampRect({ x: -5, y: 60, width: 100, height: 100 }, bounds)).toEqual({
      x: 0,
      y: 0,
      width: 64,
      height: 64,
    });
    expect(clampRect({ x: 10, y: 10, width: 0, height: -3 }, bounds)).toEqual({
      x: 10,
      y: 10,
      width: 1,
      height: 1,
    });
  });
});

describe('moveRect', () => {
  it('moves while clamping to the canvas', () => {
    expect(moveRect({ x: 4, y: 4, width: 8, height: 8 }, 10, -10, bounds)).toEqual({
      x: 14,
      y: 0,
      width: 8,
      height: 8,
    });
    expect(moveRect({ x: 4, y: 4, width: 8, height: 8 }, 100, 100, bounds)).toEqual({
      x: 56,
      y: 56,
      width: 8,
      height: 8,
    });
  });
});

describe('resizeRect', () => {
  it('anchors the opposite corner', () => {
    expect(resizeRect({ x: 4, y: 4, width: 4, height: 4 }, 'nw', -2, -2, bounds)).toEqual({
      x: 2,
      y: 2,
      width: 6,
      height: 6,
    });
    expect(resizeRect({ x: 4, y: 4, width: 4, height: 4 }, 'se', 2, 2, bounds)).toEqual({
      x: 4,
      y: 4,
      width: 6,
      height: 6,
    });
  });

  it('never shrinks below one pixel', () => {
    expect(resizeRect({ x: 4, y: 4, width: 4, height: 4 }, 'nw', 50, 50, bounds)).toEqual({
      x: 7,
      y: 7,
      width: 1,
      height: 1,
    });
  });

  it('stops at the canvas edge', () => {
    expect(resizeRect({ x: 60, y: 60, width: 4, height: 4 }, 'se', 20, 20, bounds)).toEqual({
      x: 60,
      y: 60,
      width: 4,
      height: 4,
    });
  });
});

describe('rectFromDrag', () => {
  it('normalizes any drag direction', () => {
    expect(rectFromDrag({ x: 30, y: 20 }, { x: 10, y: 5 }, bounds)).toEqual({
      x: 10,
      y: 5,
      width: 20,
      height: 15,
    });
  });

  it('produces at least one pixel for a click', () => {
    expect(rectFromDrag({ x: 5, y: 5 }, { x: 5, y: 5 }, bounds)).toEqual({
      x: 5,
      y: 5,
      width: 1,
      height: 1,
    });
  });
});

describe('pivotFromPoint', () => {
  const rect = { x: 10, y: 20, width: 20, height: 40 };

  it('maps points to 0..1 and clamps', () => {
    expect(pivotFromPoint({ x: 20, y: 40 }, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(pivotFromPoint({ x: 0, y: 100 }, rect)).toEqual({ x: 0, y: 1 });
  });

  it('avoids floating point noise', () => {
    expect(pivotFromPoint({ x: 13, y: 23 }, rect)).toEqual({ x: 0.15, y: 0.075 });
  });
});

describe('handles and hit testing', () => {
  const rect = { x: 10, y: 10, width: 20, height: 20 };

  it('finds corner handles within the tolerance', () => {
    expect(handleAtPoint({ x: 10, y: 10 }, rect, 3)).toBe('nw');
    expect(handleAtPoint({ x: 31, y: 10 }, rect, 3)).toBe('ne');
    expect(handleAtPoint({ x: 10, y: 31 }, rect, 3)).toBe('sw');
    expect(handleAtPoint({ x: 30, y: 30 }, rect, 3)).toBe('se');
    expect(handleAtPoint({ x: 20, y: 20 }, rect, 3)).toBeNull();
  });

  it('detects points inside rectangles', () => {
    expect(rectContains({ x: 10, y: 10 }, rect)).toBe(true);
    expect(rectContains({ x: 30, y: 30 }, rect)).toBe(false);
  });
});

describe('viewport math', () => {
  it('round-trips between screen and image coordinates', () => {
    const offset = { x: 12, y: -4 };
    const zoom = 4;
    const image = { x: 7, y: 3 };
    expect(screenToImage(imageToScreen(image, offset, zoom), offset, zoom)).toEqual(image);
  });

  it('fits integer zoom levels with padding', () => {
    expect(fitZoom({ width: 64, height: 64 }, { width: 200, height: 200 }, 32)).toBe(2);
    expect(fitZoom({ width: 64, height: 64 }, { width: 1024, height: 1024 }, 32)).toBe(15);
    expect(fitZoom({ width: 4096, height: 4096 }, { width: 200, height: 200 }, 32)).toBe(1);
  });
});
