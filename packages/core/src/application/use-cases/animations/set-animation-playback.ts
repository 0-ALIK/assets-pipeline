import { assertPlayback } from '../../../domain/entities/animation.js';
import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface SetAnimationPlaybackInput {
  readonly id: string;
  readonly playback: string;
}

export async function setAnimationPlayback(
  context: UseCaseContext,
  input: SetAnimationPlaybackInput,
): Promise<void> {
  assertPlayback(input.playback);
  await changeRepository(context, (repository) =>
    repository.setAnimationPlayback(input.id, input.playback),
  );
}
