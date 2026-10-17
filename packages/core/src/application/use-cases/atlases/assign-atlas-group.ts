import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface AssignAtlasGroupInput {
  readonly atlas: string;
  readonly group: string;
}

/** Assigns a derived group to an atlas; every group belongs to one atlas. */
export async function assignAtlasGroup(
  context: UseCaseContext,
  input: AssignAtlasGroupInput,
): Promise<void> {
  await changeRepository(context, (repository) => repository.assignGroup(input.atlas, input.group));
}
