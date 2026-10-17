import type { UseCaseContext } from '../../context.js';
import type { PathChangePlan } from '../../dto/repository-dto.js';
import { planPathChange } from '../../services/path-change-planner.js';

export interface PlanMoveInput {
  readonly from: string;
  readonly to: string;
}

/** Previews a move without touching the filesystem or the metadata. */
export async function planMove(
  context: UseCaseContext,
  input: PlanMoveInput,
): Promise<PathChangePlan> {
  return planPathChange(context, { path: input.from, to: input.to });
}
