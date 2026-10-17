import { Repository } from '../../../domain/entities/repository.js';
import { PipelineError } from '../../../domain/errors.js';
import type { RepositoryDatabase } from '../../../domain/repository.js';
import type { UseCaseContext } from '../../context.js';
import { publishEvents } from '../../services/change-repository.js';

export interface InitializeRepositoryInput {
  readonly name: string;
  readonly id: string;
}

/** Creates a fresh versioned repository; fails when one already exists. */
export async function initializeRepository(
  context: UseCaseContext,
  input: InitializeRepositoryInput,
): Promise<RepositoryDatabase> {
  if (input.name.trim() === '' || input.id.trim() === '') {
    throw new PipelineError('INVALID_INPUT', 'El nombre y el ID del proyecto son obligatorios.');
  }
  if (await context.store.read()) {
    throw new PipelineError('ALREADY_EXISTS', 'Ya existe un repositorio en esta carpeta.');
  }
  const now = context.now();
  const repository = Repository.create({
    id: input.id,
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
  });
  const database = repository.toJSON();
  await context.store.write(database);
  await publishEvents(context, repository.drainEvents());
  return database;
}
