import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface MoveFrameInput {
  readonly animation: string;
  readonly from: number;
  readonly to: number;
}

/** Moves a frame inside its animation; `to` may equal the frame count (end). */
export async function moveFrame(context: UseCaseContext, input: MoveFrameInput): Promise<void> {
  await changeRepository(context, (repository) =>
    repository.moveFrame(input.animation, input.from, input.to),
  );
}
