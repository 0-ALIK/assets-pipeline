import { PipelineError } from '@assets-pipeline/core';
import type { Pivot, Rectangle } from '@assets-pipeline/core';

export function number(value: string, label: string): number {
  const parsed = Number(value);
  if (value.trim() === '' || !Number.isFinite(parsed)) {
    throw new PipelineError('INVALID_INPUT', `${label} debe ser un número.`);
  }
  return parsed;
}

export function index(value: string): number {
  const parsed = number(value, 'El índice');
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new PipelineError('INVALID_INPUT', 'El índice debe ser un entero desde 0.');
  }
  return parsed;
}

export function rectangle(value: string): Rectangle {
  const parts = value.split(',');
  if (parts.length !== 4) {
    throw new PipelineError('INVALID_INPUT', '--rect usa x,y,width,height.');
  }
  return {
    x: number(parts[0]!, 'x'),
    y: number(parts[1]!, 'y'),
    width: number(parts[2]!, 'width'),
    height: number(parts[3]!, 'height'),
  };
}

export function pivot(value: string): Pivot {
  const parts = value.split(',');
  if (parts.length !== 2) throw new PipelineError('INVALID_INPUT', '--pivot usa x,y.');
  return { x: number(parts[0]!, 'pivot.x'), y: number(parts[1]!, 'pivot.y') };
}
