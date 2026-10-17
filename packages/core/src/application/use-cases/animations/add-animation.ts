import { assertIdentifier } from '../../../domain/value-objects/identifier.js';
import { assertSourcePath } from '../../../domain/value-objects/source-path.js';
import { assertPlayback } from '../../../domain/entities/animation.js';
import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface AddAnimationInput {
  readonly path: string;
  readonly id: string;
  readonly playback: string;
}

/** Creates an animation without frames; frames are added separately. */
export async function addAnimation(
  context: UseCaseContext,
  input: AddAnimationInput,
): Promise<void> {
  assertSourcePath(input.path);
  assertIdentifier(input.id);
  assertPlayback(input.playback);
  await changeRepository(context, (repository) =>
    repository.addAnimation(input.path, input.id, input.playback),
  );
}
