import { PipelineError } from './errors.js';
import type { Pivot, Rectangle } from './repository.js';

export function assertSourcePath(path: string): void {
  assertSegments(path, 'Ruta');
  if (path.split('/').some((segment) => segment.toLowerCase() === '.assets-pipeline-cache')) {
    throw new PipelineError('INVALID_INPUT', 'La carpeta interna del repositorio está reservada.');
  }
}

export function assertIdentifier(id: string): void {
  assertSegments(id, 'ID');
  if (!/^[\p{L}\p{N}_.-]+(?:\/[\p{L}\p{N}_.-]+)*$/u.test(id)) {
    throw new PipelineError('INVALID_INPUT', `ID inválido: ${id}`);
  }
}

export function groupFromIdentifier(id: string): string {
  assertIdentifier(id);
  return id.split('/')[0]!;
}

export function assertAtlasName(name: string): void {
  if (!/^[\p{L}\p{N}_-]+$/u.test(name) || name === '.' || name === '..') {
    throw new PipelineError('INVALID_INPUT', `Nombre de atlas inválido: ${name}`);
  }
}

export function assertAtlasSize(size: number): void {
  if (!Number.isInteger(size) || size <= 0 || size > 8192) {
    throw new PipelineError(
      'INVALID_INPUT',
      'El tamaño del atlas debe ser un entero entre 1 y 8192 píxeles.',
    );
  }
}

export function assertAtlasGap(gap: number, size: number): void {
  if (!Number.isInteger(gap) || gap < 0 || gap >= size) {
    throw new PipelineError(
      'INVALID_INPUT',
      'El gap del atlas debe ser un entero entre 0 y tamaño - 1 píxeles.',
    );
  }
}

function assertSegments(value: string, label: string): void {
  if (
    value.length === 0 ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes(':') ||
    value
      .split('/')
      .some(
        (segment) =>
          segment === '' ||
          segment === '.' ||
          segment === '..' ||
          segment === '__proto__' ||
          segment === 'constructor' ||
          segment === 'prototype',
      )
  ) {
    throw new PipelineError('INVALID_INPUT', `${label} inválida: ${value}`);
  }
}

export function isSupportedSource(path: string): boolean {
  return /\.(png|aseprite)$/i.test(path);
}

export function assertRectangle(rect: Rectangle, width?: number, height?: number): void {
  if (
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    !Number.isInteger(rect.width) ||
    !Number.isInteger(rect.height) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    (width !== undefined && rect.x + rect.width > width) ||
    (height !== undefined && rect.y + rect.height > height)
  ) {
    throw new PipelineError(
      'INVALID_INPUT',
      'La región debe tener enteros positivos y caber en la imagen.',
    );
  }
}

export function assertPivot(pivot: Pivot): void {
  if (
    !Number.isFinite(pivot.x) ||
    !Number.isFinite(pivot.y) ||
    pivot.x < 0 ||
    pivot.x > 1 ||
    pivot.y < 0 ||
    pivot.y > 1
  ) {
    throw new PipelineError('INVALID_INPUT', 'El pivot debe estar entre 0 y 1 en ambos ejes.');
  }
}

export function assertDuration(durationMs: number): void {
  if (!Number.isInteger(durationMs) || durationMs <= 0) {
    throw new PipelineError(
      'INVALID_INPUT',
      'La duración debe ser un entero positivo en milisegundos.',
    );
  }
}
