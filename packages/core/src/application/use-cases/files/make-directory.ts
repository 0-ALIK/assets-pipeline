import { PipelineError } from '../../../domain/errors.js';
import { assertSourcePath } from '../../../domain/value-objects/source-path.js';
import type { UseCaseContext } from '../../context.js';
import { publishEvents } from '../../services/change-repository.js';

export interface MakeDirectoryInput {
  readonly path: string;
}

/** Creates a directory, including missing parents; fails when it exists. */
export async function makeDirectory(
  context: UseCaseContext,
  input: MakeDirectoryInput,
): Promise<void> {
  assertSourcePath(input.path);
  if (await context.files.kind(input.path)) {
    throw new PipelineError('ALREADY_EXISTS', `La ruta ya existe: ${input.path}`);
  }
  await context.files.mkdir(input.path);
  await publishEvents(context, [{ type: 'directory.made', path: input.path }]);
}
