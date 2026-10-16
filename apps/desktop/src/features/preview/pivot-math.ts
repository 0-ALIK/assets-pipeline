export interface FrameMetrics {
  readonly width: number;
  readonly height: number;
  readonly pivot: { readonly x: number; readonly y: number };
}

export interface AnimationLayout {
  readonly width: number;
  readonly height: number;
  /** Where the shared pivot sits inside the composed canvas, in pixels. */
  readonly pivot: { readonly x: number; readonly y: number };
  /** Per-frame draw offsets so every frame keeps its pivot anchored. */
  readonly offsets: readonly { readonly x: number; readonly y: number }[];
}

/**
 * Computes the composition bounds and per-frame offsets for an animation.
 * Rounding the pivot anchor keeps frames aligned on whole pixels.
 */
export function layoutAnimationFrames(frames: readonly FrameMetrics[]): AnimationLayout {
  if (frames.length === 0) {
    return { width: 0, height: 0, pivot: { x: 0, y: 0 }, offsets: [] };
  }
  let minLeft = 0;
  let maxRight = 0;
  let minTop = 0;
  let maxBottom = 0;
  for (const frame of frames) {
    const anchorX = Math.round(frame.width * frame.pivot.x);
    const anchorY = Math.round(frame.height * frame.pivot.y);
    minLeft = Math.min(minLeft, -anchorX);
    maxRight = Math.max(maxRight, frame.width - anchorX);
    minTop = Math.min(minTop, -anchorY);
    maxBottom = Math.max(maxBottom, frame.height - anchorY);
  }
  const width = maxRight - minLeft;
  const height = maxBottom - minTop;
  const pivot = { x: -minLeft, y: -minTop };
  const offsets = frames.map((frame) => {
    const anchorX = Math.round(frame.width * frame.pivot.x);
    const anchorY = Math.round(frame.height * frame.pivot.y);
    return { x: pivot.x - anchorX, y: pivot.y - anchorY };
  });
  return { width, height, pivot, offsets };
}

export function totalDuration(frames: readonly { readonly durationMs: number }[]): number {
  return frames.reduce((sum, frame) => sum + frame.durationMs, 0);
}

export interface FrameAtTime {
  readonly index: number;
  readonly finished: boolean;
}

/** Resolves the frame playing at `elapsedMs`, honoring loop or once playback. */
export function findFrameAt(
  frames: readonly { readonly durationMs: number }[],
  elapsedMs: number,
  loop: boolean,
): FrameAtTime {
  const total = totalDuration(frames);
  if (frames.length === 0) return { index: 0, finished: true };
  if (total <= 0) return { index: frames.length - 1, finished: true };
  let time = elapsedMs;
  if (time >= total) {
    if (loop) time %= total;
    else return { index: frames.length - 1, finished: true };
  }
  let remaining = time;
  for (let index = 0; index < frames.length; index += 1) {
    const duration = frames[index]!.durationMs;
    if (remaining < duration) return { index, finished: false };
    remaining -= duration;
  }
  return { index: frames.length - 1, finished: !loop };
}
