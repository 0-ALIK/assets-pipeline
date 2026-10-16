import { invoke } from '@tauri-apps/api/core';
import { PipelineError } from '@assets-pipeline/core';

type PipelineErrorCode = PipelineError['code'];

const knownCodes = new Set<string>([
  'INVALID_INPUT',
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'IN_USE',
  'INVALID_SOURCE',
  'INVALID_REPOSITORY',
]);

/** Maps structured Rust command errors to the Core error type. */
export function toPipelineError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const { code, message } = error as { code: unknown; message: unknown };
    if (typeof message === 'string') {
      const resolved =
        typeof code === 'string' && knownCodes.has(code)
          ? (code as PipelineErrorCode)
          : 'INVALID_REPOSITORY';
      return new PipelineError(resolved, message);
    }
  }
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toPipelineError(error);
  }
}
