import type { SpriteLocation } from '../../../domain/entities/repository.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

export interface ShowSpriteInput {
  readonly id: string;
}

export async function showSprite(
  context: UseCaseContext,
  input: ShowSpriteInput,
): Promise<SpriteLocation> {
  const repository = await readRepository(context);
  return repository.requireSprite(input.id);
}
