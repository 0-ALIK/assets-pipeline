import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface RemoveAnimationInput {
  readonly id: string;
}

export async function removeAnimation(
  context: UseCaseContext,
  input: RemoveAnimationInput,
): Promise<void> {
  await changeRepository(context, (repository) => repository.removeAnimation(input.id));
}
