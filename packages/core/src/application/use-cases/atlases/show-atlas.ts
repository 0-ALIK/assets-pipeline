import type { AtlasSummary } from '../../../domain/entities/repository.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

export interface ShowAtlasInput {
  readonly name: string;
}

export async function showAtlas(
  context: UseCaseContext,
  input: ShowAtlasInput,
): Promise<AtlasSummary> {
  const repository = await readRepository(context);
  return { name: input.name, atlas: repository.requireAtlas(input.name).toJSON() };
}
