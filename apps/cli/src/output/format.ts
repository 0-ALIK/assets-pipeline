import { createInterface } from 'node:readline/promises';
import type { AutoRegionPlan, ListedFile, PathChangePlan } from '@assets-pipeline/core';
import { PipelineError } from '@assets-pipeline/core';

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printListing(files: readonly ListedFile[]): void {
  for (const file of files) {
    const label = file.kind === 'directory' ? `${file.path}/` : file.path;
    const colored =
      file.status === 'defined' && process.stdout.isTTY && !process.env.NO_COLOR
        ? `\x1b[34m${label}\x1b[0m`
        : label;
    process.stdout.write(`${file.status.padEnd(9)} ${colored}\n`);
  }
}

export function printPlan(plan: PathChangePlan, operation: 'move' | 'remove'): void {
  process.stdout.write(
    `${operation === 'move' ? 'Mover' : 'Eliminar'} ${plan.kind}: ${plan.from}${plan.to ? ` → ${plan.to}` : ''}\n`,
  );
  if (plan.definitions.length > 0) {
    process.stdout.write('Definiciones afectadas:\n');
    for (const path of plan.definitions) {
      process.stdout.write(
        `  ${path}${plan.to ? ` → ${plan.to}${path.slice(plan.from.length)}` : ' (se eliminarán)'}\n`,
      );
    }
  }
  const withoutDefinitions = plan.files.filter((path) => !plan.definitions.includes(path));
  if (withoutDefinitions.length > 0) {
    process.stdout.write('Archivos sin definiciones afectados:\n');
    for (const path of withoutDefinitions) process.stdout.write(`  ${path}\n`);
  }
  if (plan.directoriesToCreate.length > 0) {
    process.stdout.write('Carpetas padre que se crearán:\n');
    for (const path of plan.directoriesToCreate) process.stdout.write(`  ${path}/\n`);
  }
}

export function printAutoRegionWarning(): void {
  process.stdout.write(
    [
      'Aviso: regiones automáticas.',
      '  Se crea una región por cada zona de contenido opaco del archivo.',
      '  No respeta la lógica de tus sprites: partes sueltas, sombras o píxeles',
      '  aislados también generan regiones.',
      '  Las definiciones existentes se conservan y las nuevas nunca se solapan.',
      '',
    ].join('\n'),
  );
}

export function printAutoRegionPlan(plan: AutoRegionPlan): void {
  if (plan.sprites.length === 0) {
    process.stdout.write('No se detectó contenido nuevo para regionar.\n');
    if (plan.skipped > 0) {
      process.stdout.write(
        `Omitidas: ${plan.skipped} (ya cubiertas por definiciones existentes).\n`,
      );
    }
    return;
  }
  process.stdout.write(
    `Regiones detectadas: ${plan.sprites.length} en «${plan.group}»${plan.skipped > 0 ? ` · ${plan.skipped} omitidas` : ''}\n`,
  );
  for (const sprite of plan.sprites) {
    const { x, y, width, height } = sprite.rect;
    process.stdout.write(`  ${sprite.id.padEnd(12)} x=${x} y=${y} ${width}×${height}\n`);
  }
}

export async function requireConfirmation(yes: boolean, description: string): Promise<void> {
  if (yes) return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new PipelineError('INVALID_INPUT', 'Se requiere confirmación. En scripts, usa --yes.');
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`${description} ¿Continuar? [s/N] `);
    if (!['s', 'si', 'sí', 'y', 'yes'].includes(answer.trim().toLowerCase())) {
      throw new PipelineError('INVALID_INPUT', 'Operación cancelada.');
    }
  } finally {
    prompt.close();
  }
}
