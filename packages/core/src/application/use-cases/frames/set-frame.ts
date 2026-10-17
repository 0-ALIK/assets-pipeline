import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface SetFrameInput {
  readonly animation: string;
  readonly at: number;
  readonly sprite?: string;
  readonly durationMs?: number;
}

/** Changes the sprite or the duration of one frame. */
export async function setFrame(context: UseCaseContext, input: SetFrameInput): Promise<void> {
  await changeRepository(context, (repository) =>
    repository.setFrame(input.animation, input.at, input.sprite, input.durationMs),
  );
}
