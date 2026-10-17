import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface RemoveAtlasInput {
  readonly name: string;
}

/** Removes the atlas configuration; its groups stay unassigned. */
export async function removeAtlas(context: UseCaseContext, input: RemoveAtlasInput): Promise<void> {
  await changeRepository(context, (repository) => repository.removeAtlas(input.name));
}
