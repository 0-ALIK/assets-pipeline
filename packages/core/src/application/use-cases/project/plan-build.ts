import { planAtlasBuild, type AtlasBuildPlan } from '../../../builders/packing/pack-atlases.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

/** Plans the deterministic atlas build; pixel work belongs to an AssetBuilder. */
export async function planBuild(context: UseCaseContext): Promise<AtlasBuildPlan> {
  return planAtlasBuild((await readRepository(context)).toJSON());
}
