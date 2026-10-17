import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface AddFrameInput {
  readonly animation: string;
  readonly sprite: string;
  readonly durationMs: number;
  readonly at?: number;
}

/** Appends a frame or inserts it at `at`; validates duration, sprite and index. */
export async function addFrame(context: UseCaseContext, input: AddFrameInput): Promise<void> {
  await changeRepository(context, (repository) => {
    if (input.at === undefined) {
      repository.addFrame(input.animation, input.sprite, input.durationMs);
    } else {
      repository.addFrame(input.animation, input.sprite, input.durationMs, input.at);
    }
  });
}
