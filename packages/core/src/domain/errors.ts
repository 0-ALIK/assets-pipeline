export type PipelineErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'IN_USE'
  | 'INVALID_SOURCE'
  | 'INVALID_REPOSITORY';

export class PipelineError extends Error {
  constructor(
    readonly code: PipelineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}
