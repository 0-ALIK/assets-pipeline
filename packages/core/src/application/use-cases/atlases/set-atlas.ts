import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface SetAtlasInput {
  readonly name: string;
  readonly size?: number;
  readonly gap?: number;
}

/** Changes the page size or the gap of an atlas; at least one is required. */
export async function setAtlas(context: UseCaseContext, input: SetAtlasInput): Promise<void> {
  await changeRepository(context, (repository) =>
    repository.setAtlas(input.name, input.size, input.gap),
  );
}
