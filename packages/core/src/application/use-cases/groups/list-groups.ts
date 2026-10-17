import type { GroupSummary } from '../../../domain/entities/repository.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

/** Lists the groups derived from the first segment of every sprite id. */
export async function listGroups(context: UseCaseContext): Promise<readonly GroupSummary[]> {
  return (await readRepository(context)).listGroups();
}
