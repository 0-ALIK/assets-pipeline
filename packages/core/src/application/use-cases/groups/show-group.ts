import type { GroupSummary } from '../../../domain/entities/repository.js';
import { PipelineError } from '../../../domain/errors.js';
import { assertIdentifier } from '../../../domain/value-objects/identifier.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

export interface ShowGroupInput {
  readonly name: string;
}

/** Shows one derived group; accepts the first id segment only. */
export async function showGroup(
  context: UseCaseContext,
  input: ShowGroupInput,
): Promise<GroupSummary> {
  assertIdentifier(input.name);
  if (input.name.includes('/')) {
    throw new PipelineError('INVALID_INPUT', 'Un grupo es solo el primer segmento de un ID.');
  }
  const repository = await readRepository(context);
  return repository.requireGroup(input.name);
}
