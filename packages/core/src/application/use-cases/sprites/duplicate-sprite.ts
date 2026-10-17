import { assertIdentifier } from '../../../domain/value-objects/identifier.js';
import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface DuplicateSpriteInput {
  readonly from: string;
  readonly to: string;
}

/** Copies a sprite definition inside the same source file. */
export async function duplicateSprite(
  context: UseCaseContext,
  input: DuplicateSpriteInput,
): Promise<void> {
  assertIdentifier(input.to);
  await changeRepository(context, (repository) => repository.duplicateSprite(input.from, input.to));
}
