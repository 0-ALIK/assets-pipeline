import { Repository } from '../../domain/entities/repository.js';
import { PipelineError } from '../../domain/errors.js';
import type { RepositoryEventPayload } from '../../domain/events/repository-events.js';
import type { UseCaseContext } from '../context.js';

/** Reads the persisted database and materializes the aggregate. */
export async function readRepository(context: UseCaseContext): Promise<Repository> {
  const database = await context.store.read();
  if (!database) {
    throw new PipelineError('NOT_FOUND', 'No se encontró db.json del repositorio.');
  }
  return Repository.fromJSON(database);
}

/**
 * Transactional change: read, apply the domain command, refresh `updatedAt`,
 * persist and finally publish the events the command completed.
 *
 * The store validates the persisted shape, so an invalid state never lands on
 * disk and the caller can surface the failure without a rollback.
 */
export async function changeRepository(
  context: UseCaseContext,
  action: (repository: Repository) => void | Promise<void>,
): Promise<void> {
  const repository = await readRepository(context);
  await action(repository);
  repository.touch(context.now());
  await context.store.write(repository.toJSON());
  await publishEvents(context, repository.drainEvents());
}

export async function publishEvents(
  context: UseCaseContext,
  events: readonly RepositoryEventPayload[],
): Promise<void> {
  if (!context.events || events.length === 0) return;
  const occurredAt = context.now();
  for (const payload of events) {
    await context.events.publish({ type: payload.type, occurredAt, payload });
  }
}
