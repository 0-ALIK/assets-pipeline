import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface UnassignAtlasGroupInput {
  readonly atlas: string;
  readonly group: string;
}

/** Leaves a group without atlas; validation will fail until it is reassigned. */
export async function unassignAtlasGroup(
  context: UseCaseContext,
  input: UnassignAtlasGroupInput,
): Promise<void> {
  await changeRepository(context, (repository) =>
    repository.unassignGroup(input.atlas, input.group),
  );
}
