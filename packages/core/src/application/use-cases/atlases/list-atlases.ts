import type { AtlasSummary } from '../../../domain/entities/repository.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

export async function listAtlases(context: UseCaseContext): Promise<readonly AtlasSummary[]> {
  return (await readRepository(context)).listAtlases();
}
