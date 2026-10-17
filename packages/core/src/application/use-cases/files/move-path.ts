import { PipelineError } from '../../../domain/errors.js';
import { validateRepositoryDatabase } from '../../../validation/repository-database.js';
import type { UseCaseContext } from '../../context.js';
import type { PathChangePlan } from '../../dto/repository-dto.js';
import { publishEvents, readRepository } from '../../services/change-repository.js';
import { planPathChange } from '../../services/path-change-planner.js';

export interface MovePathInput {
  readonly from: string;
  readonly to: string;
}

/**
 * Moves files or directories and rewrites the definition paths, creating the
 * missing destination parents. Restores the filesystem when the metadata write
 * fails so both sides stay consistent.
 */
export async function movePath(
  context: UseCaseContext,
  input: MovePathInput,
): Promise<PathChangePlan> {
  const { from, to } = input;
  const plan = await planPathChange(context, { path: from, to });
  const repository = await readRepository(context);
  repository.relocateSources(
    plan.definitions.map((path) => ({ from: path, to: `${to}${path.slice(from.length)}` })),
  );
  repository.touch(context.now());
  for (const directory of plan.directoriesToCreate) {
    await context.files.mkdir(directory);
  }
  await context.files.move(from, to);
  try {
    await context.store.write(validateRepositoryDatabase(repository.toJSON()));
  } catch (error) {
    try {
      await context.files.move(to, from);
    } catch {
      throw new PipelineError(
        'INVALID_REPOSITORY',
        `No se pudo revertir el movimiento ${from} → ${to}; revisa el archivo y db.json.`,
      );
    }
    throw error;
  }
  await publishEvents(context, [{ type: 'path.moved', from, to }]);
  return plan;
}
