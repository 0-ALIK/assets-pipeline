import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface RemoveFrameInput {
  readonly animation: string;
  readonly at: number;
}

/** Removes one frame; animations may stay empty while editing. */
export async function removeFrame(context: UseCaseContext, input: RemoveFrameInput): Promise<void> {
  await changeRepository(context, (repository) =>
    repository.removeFrame(input.animation, input.at),
  );
}
