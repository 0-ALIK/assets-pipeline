import { posix } from 'node:path';
import type { Command } from 'commander';
import { PipelineError } from '@assets-pipeline/core';
import { withContext } from '../context.js';
import { printPlan, requireConfirmation } from '../output/format.js';

interface ChangeOptions {
  yes?: boolean;
  dryRun?: boolean;
  recursive?: boolean;
}

export function addFilesystemCommands(program: Command): void {
  const fs = program.command('fs').description('Administrar archivos y carpetas del repositorio');
  fs.command('mkdir')
    .argument('<path>')
    .description('Crear una carpeta, incluidos padres faltantes')
    .action(async (path: string) => {
      await withContext(program, true, async ({ workspace }) => workspace.makeDirectory(path));
      process.stdout.write(`Carpeta creada: ${path}\n`);
    });

  const move = async (from: string, to: string, options: ChangeOptions): Promise<void> => {
    await withContext(program, !options.dryRun, async ({ workspace }) => {
      const plan = await workspace.planMove(from, to);
      printPlan(plan, 'move');
      if (options.dryRun) return;
      await requireConfirmation(
        Boolean(options.yes),
        'Se moverá la ruta y se actualizará la metadata.',
      );
      await workspace.movePath(from, to);
      process.stdout.write('Movimiento completado.\n');
    });
  };

  fs.command('move')
    .argument('<from>')
    .argument('<to>')
    .description('Mover un archivo o carpeta')
    .option('--dry-run', 'Mostrar los cambios sin aplicarlos')
    .option('--yes', 'Confirmar en un script')
    .action(move);

  fs.command('rename')
    .argument('<from>')
    .argument('<new-name>')
    .description('Renombrar dentro de la misma carpeta')
    .option('--dry-run', 'Mostrar los cambios sin aplicarlos')
    .option('--yes', 'Confirmar en un script')
    .action(async (from: string, name: string, options: ChangeOptions) => {
      if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
        throw new PipelineError('INVALID_INPUT', 'El nuevo nombre no puede contener carpetas.');
      }
      await move(from, posix.join(posix.dirname(from), name), options);
    });

  fs.command('rm')
    .argument('<path>')
    .description('Eliminar un archivo o carpeta')
    .option('--recursive', 'Permitir eliminar una carpeta no vacía')
    .option('--dry-run', 'Mostrar los cambios sin aplicarlos')
    .option('--yes', 'Confirmar en un script')
    .action(async (path: string, options: ChangeOptions) => {
      await withContext(program, !options.dryRun, async ({ workspace }) => {
        const plan = await workspace.planRemove(path);
        printPlan(plan, 'remove');
        if (options.dryRun) return;
        await requireConfirmation(Boolean(options.yes), 'Se eliminará la ruta y sus definiciones.');
        await workspace.removePath(path, Boolean(options.recursive));
        process.stdout.write('Eliminación completada.\n');
      });
    });
}
