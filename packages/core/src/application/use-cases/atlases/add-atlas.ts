import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface AddAtlasInput {
  readonly name: string;
  readonly size: number;
  readonly gap: number;
}

/** Creates an atlas without groups; groups are assigned later. */
export async function addAtlas(context: UseCaseContext, input: AddAtlasInput): Promise<void> {
  await changeRepository(context, (repository) =>
    repository.addAtlas(input.name, input.size, input.gap),
  );
}
