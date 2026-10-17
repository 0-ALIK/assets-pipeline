import { PipelineError } from '../../../domain/errors.js';
import type { Pivot, Rectangle } from '../../../domain/repository.js';
import { assertPivot } from '../../../domain/value-objects/pivot.js';
import { assertRectangle } from '../../../domain/value-objects/rectangle.js';
import type { UseCaseContext } from '../../context.js';
import { changeRepository, readRepository } from '../../services/change-repository.js';

export interface SetSpriteInput {
  readonly id: string;
  readonly rect?: Rectangle;
  readonly pivot?: Pivot;
}

/** Changes the region or the pivot of an existing sprite. */
export async function setSprite(context: UseCaseContext, input: SetSpriteInput): Promise<void> {
  if (!input.rect && !input.pivot) {
    throw new PipelineError('INVALID_INPUT', 'Indica --rect o --pivot.');
  }
  if (input.pivot) assertPivot(input.pivot);
  const repository = await readRepository(context);
  const current = repository.requireSprite(input.id);
  const next = {
    ...current.sprite,
    ...(input.rect ?? {}),
    ...(input.pivot ? { pivot: input.pivot } : {}),
  };
  const size = await context.files.imageSize(current.path);
  assertRectangle(next, size.width, size.height);
  await changeRepository(context, (target) => target.setSprite(input.id, input.rect, input.pivot));
}
