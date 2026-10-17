import type { AnimationLocation } from '../../../domain/entities/repository.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

export interface ShowAnimationInput {
  readonly id: string;
}

export async function showAnimation(
  context: UseCaseContext,
  input: ShowAnimationInput,
): Promise<AnimationLocation> {
  const repository = await readRepository(context);
  return repository.requireAnimation(input.id);
}
