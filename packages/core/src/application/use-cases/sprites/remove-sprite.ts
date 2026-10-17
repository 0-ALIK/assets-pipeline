import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface RemoveSpriteInput {
  readonly id: string;
}

/** Removes a definition; fails while animations still reference it. */
export async function removeSprite(
  context: UseCaseContext,
  input: RemoveSpriteInput,
): Promise<void> {
  await changeRepository(context, (repository) => repository.removeSprite(input.id));
}
