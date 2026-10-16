import { describe, expect, it } from 'vitest';
import { findFrameAt, layoutAnimationFrames, totalDuration } from './pivot-math.js';

describe('layoutAnimationFrames', () => {
  it('keeps a single frame at the origin with its pivot anchored', () => {
    const layout = layoutAnimationFrames([{ width: 16, height: 16, pivot: { x: 0.5, y: 1 } }]);
    expect(layout).toEqual({
      width: 16,
      height: 16,
      pivot: { x: 8, y: 16 },
      offsets: [{ x: 0, y: 0 }],
    });
  });

  it('anchors every frame pivot at the same point', () => {
    const layout = layoutAnimationFrames([
      { width: 16, height: 16, pivot: { x: 0.5, y: 1 } },
      { width: 8, height: 24, pivot: { x: 0.5, y: 0.5 } },
    ]);
    expect(layout.width).toBe(16);
    expect(layout.height).toBe(28);
    expect(layout.pivot).toEqual({ x: 8, y: 16 });
    expect(layout.offsets).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 4 },
    ]);
    // Pivot positions must coincide across frames.
    const positions = layout.offsets.map((offset, index) => {
      const frame = [
        { width: 16, height: 16, pivot: { x: 0.5, y: 1 } },
        { width: 8, height: 24, pivot: { x: 0.5, y: 0.5 } },
      ][index]!;
      return {
        x: offset.x + Math.round(frame.width * frame.pivot.x),
        y: offset.y + Math.round(frame.height * frame.pivot.y),
      };
    });
    expect(positions[0]).toEqual(positions[1]);
  });

  it('handles corner pivots without leaving the composition empty', () => {
    const layout = layoutAnimationFrames([
      { width: 10, height: 20, pivot: { x: 0, y: 0 } },
      { width: 10, height: 20, pivot: { x: 1, y: 1 } },
    ]);
    expect(layout.width).toBe(20);
    expect(layout.height).toBe(40);
  });

  it('returns an empty layout for no frames', () => {
    expect(layoutAnimationFrames([])).toEqual({
      width: 0,
      height: 0,
      pivot: { x: 0, y: 0 },
      offsets: [],
    });
  });
});

describe('findFrameAt', () => {
  const frames = [{ durationMs: 100 }, { durationMs: 200 }, { durationMs: 50 }];

  it('walks frames in order', () => {
    expect(findFrameAt(frames, 0, true)).toEqual({ index: 0, finished: false });
    expect(findFrameAt(frames, 120, true)).toEqual({ index: 1, finished: false });
    expect(findFrameAt(frames, 320, true)).toEqual({ index: 2, finished: false });
  });

  it('wraps around when looping', () => {
    expect(findFrameAt(frames, 350, true)).toEqual({ index: 0, finished: false });
    expect(findFrameAt(frames, 470, true)).toEqual({ index: 1, finished: false });
  });

  it('finishes on the last frame when playing once', () => {
    expect(findFrameAt(frames, 400, false)).toEqual({ index: 2, finished: true });
  });

  it('totals durations', () => {
    expect(totalDuration(frames)).toBe(350);
  });
});
