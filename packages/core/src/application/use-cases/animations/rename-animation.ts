import { assertIdentifier } from '../../../domain/value-objects/identifier.js';
import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface RenameAnimationInput {
  readonly from: string;
  readonly to: string;
}

export async function renameAnimation(
  context: UseCaseContext,
  input: RenameAnimationInput,
): Promise<void> {
  assertIdentifier(input.to);
  await changeRepository(context, (repository) => repository.renameAnimation(input.from, input.to));
}
