import { PipelineError } from '../errors.js';
import type { AnimationDefinition, AnimationFrame } from '../repository.js';
import { assertDuration } from '../value-objects/duration.js';

function checkedPlayback(value: string): 'loop' | 'once' {
  if (value !== 'loop' && value !== 'once') {
    throw new PipelineError('INVALID_INPUT', 'La reproducción debe ser loop u once.');
  }
  return value;
}

function checkedIndex(index: number, length: number, allowEnd = false): void {
  if (!Number.isInteger(index) || index < 0 || index > length - (allowEnd ? 0 : 1)) {
    throw new PipelineError('INVALID_INPUT', `Índice de frame fuera de rango: ${index}.`);
  }
}

/**
 * Frame sequence of one animation. Mutable by design: instances live inside a
 * repository transaction and are discarded when the transaction rolls back.
 */
export class Animation {
  private playback: 'loop' | 'once';
  private frames: AnimationFrame[];

  private constructor(playback: 'loop' | 'once', frames: readonly AnimationFrame[]) {
    this.playback = playback;
    this.frames = frames.map((frame) => ({ sprite: frame.sprite, durationMs: frame.durationMs }));
  }

  static create(playback: string): Animation {
    return new Animation(checkedPlayback(playback), []);
  }

  static fromJSON(definition: AnimationDefinition): Animation {
    return new Animation(checkedPlayback(definition.playback), definition.frames);
  }

  get playbackMode(): 'loop' | 'once' {
    return this.playback;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  get list(): readonly AnimationFrame[] {
    return this.frames;
  }

  get totalDurationMs(): number {
    return this.frames.reduce((total, frame) => total + frame.durationMs, 0);
  }

  usesSprite(id: string): boolean {
    return this.frames.some((frame) => frame.sprite === id);
  }

  setPlayback(playback: string): void {
    this.playback = checkedPlayback(playback);
  }

  addFrame(sprite: string, durationMs: number, at?: number): number {
    assertDuration(durationMs);
    const index = at ?? this.frames.length;
    checkedIndex(index, this.frames.length, true);
    this.frames.splice(index, 0, { sprite, durationMs });
    return index;
  }

  setFrame(at: number, sprite?: string, durationMs?: number): void {
    if (sprite === undefined && durationMs === undefined) {
      throw new PipelineError('INVALID_INPUT', 'Indica --sprite o --duration.');
    }
    if (durationMs !== undefined) assertDuration(durationMs);
    checkedIndex(at, this.frames.length);
    const current = this.frames[at]!;
    this.frames[at] = {
      sprite: sprite ?? current.sprite,
      durationMs: durationMs ?? current.durationMs,
    };
  }

  moveFrame(from: number, to: number): void {
    checkedIndex(from, this.frames.length);
    checkedIndex(to, this.frames.length, true);
    const [frame] = this.frames.splice(from, 1);
    this.frames.splice(to, 0, frame!);
  }

  removeFrame(at: number): void {
    checkedIndex(at, this.frames.length);
    this.frames.splice(at, 1);
  }

  /** Keeps frame references valid when a sprite id changes. */
  renameSpriteReference(from: string, to: string): void {
    this.frames = this.frames.map((frame) =>
      frame.sprite === from ? { ...frame, sprite: to } : frame,
    );
  }

  toJSON(): AnimationDefinition {
    return { playback: this.playback, frames: this.frames.map((frame) => ({ ...frame })) };
  }
}
