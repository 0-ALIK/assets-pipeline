import type { UseCaseContext } from '../../context.js';
import type { PathChangePlan } from '../../dto/repository-dto.js';
import { planPathChange } from '../../services/path-change-planner.js';

export interface PlanRemoveInput {
  readonly path: string;
}

/** Previews a removal without touching the filesystem or the metadata. */
export async function planRemove(
  context: UseCaseContext,
  input: PlanRemoveInput,
): Promise<PathChangePlan> {
  return planPathChange(context, { path: input.path });
}
