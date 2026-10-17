import { PipelineError } from '../../../domain/errors.js';
import { validateRepositoryDatabase } from '../../../validation/repository-database.js';
import type { UseCaseContext } from '../../context.js';
import type { PathChangePlan } from '../../dto/repository-dto.js';
import { publishEvents, readRepository } from '../../services/change-repository.js';
import { planPathChange } from '../../services/path-change-planner.js';

export interface RemovePathInput {
  readonly path: string;
  readonly recursive: boolean;
}

/**
 * Removes a path in two phases: the files move to the repository trash, the
 * metadata is written and only then the trash is discarded. A failed write
 * rolls the files back.
 */
export async function removePath(
  context: UseCaseContext,
  input: RemovePathInput,
): Promise<PathChangePlan> {
  const { path, recursive } = input;
  const plan = await planPathChange(context, { path });
  if (plan.kind === 'directory' && !recursive) {
    const entries = await context.files.list();
    if (entries.some((entry) => entry.path.startsWith(`${path}/`))) {
      throw new PipelineError('INVALID_INPUT', 'La carpeta no está vacía; usa --recursive.');
    }
  }
  const repository = await readRepository(context);
  repository.removeSources(plan.definitions);
  repository.touch(context.now());
  const staged = await context.files.stageRemoval(path);
  try {
    await context.store.write(validateRepositoryDatabase(repository.toJSON()));
  } catch (error) {
    await staged.rollback();
    throw error;
  }
  await staged.commit();
  await publishEvents(context, [{ type: 'path.removed', path }]);
  return plan;
}
