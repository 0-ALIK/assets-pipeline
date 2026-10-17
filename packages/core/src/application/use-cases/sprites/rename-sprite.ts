import { assertIdentifier } from '../../../domain/value-objects/identifier.js';
import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface RenameSpriteInput {
  readonly from: string;
  readonly to: string;
}

/** Renames a sprite and updates every frame that references it. */
export async function renameSprite(
  context: UseCaseContext,
  input: RenameSpriteInput,
): Promise<void> {
  assertIdentifier(input.to);
  await changeRepository(context, (repository) => repository.renameSprite(input.from, input.to));
}
