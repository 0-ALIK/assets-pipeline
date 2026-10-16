import type { Command } from 'commander';
import { PipelineError } from '@assets-pipeline/core';
import { withContext } from '../context.js';
import { printJson, requireConfirmation } from '../output/format.js';
import { index, number } from './values.js';

interface FrameOptions {
  sprite?: string;
  duration?: string;
  at?: string;
  from?: string;
  to?: string;
}

export function addAnimationCommands(program: Command): void {
  const animation = program.command('animation').description('Definir animaciones de sprites');
  animation
    .command('add')
    .argument('<file>')
    .requiredOption('--id <id>')
    .requiredOption('--playback <loop|once>')
    .description('Crear una animación inicialmente sin frames')
    .action(async (file: string, options: { id: string; playback: string }) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.addAnimation(file, options.id, options.playback),
      );
      process.stdout.write(`Animación creada: ${options.id}\n`);
    });

  animation
    .command('show')
    .argument('<id>')
    .description('Mostrar una animación')
    .action(async (id: string) => {
      await withContext(program, false, async ({ workspace }) =>
        printJson(await workspace.showAnimation(id)),
      );
    });

  animation
    .command('set')
    .argument('<id>')
    .requiredOption('--playback <loop|once>')
    .description('Cambiar el modo de reproducción')
    .action(async (id: string, options: { playback: string }) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.setAnimationPlayback(id, options.playback),
      );
      process.stdout.write(`Animación actualizada: ${id}\n`);
    });

  animation
    .command('rename')
    .argument('<from>')
    .argument('<to>')
    .description('Renombrar un ID de animación')
    .action(async (from: string, to: string) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.renameAnimation(from, to),
      );
      process.stdout.write(`Animación renombrada: ${from} → ${to}\n`);
    });

  animation
    .command('rm')
    .argument('<id>')
    .description('Eliminar una animación')
    .option('--yes', 'Confirmar en un script')
    .action(async (id: string, options: { yes?: boolean }) => {
      await withContext(program, true, async ({ workspace }) => {
        const location = await workspace.showAnimation(id);
        process.stdout.write(`Eliminar animación ${id} de ${location.path}.\n`);
        await requireConfirmation(Boolean(options.yes), 'Se eliminará la definición.');
        await workspace.removeAnimation(id);
      });
      process.stdout.write(`Animación eliminada: ${id}\n`);
    });

  const frame = animation
    .command('frame')
    .description('Editar la secuencia de frames (índices desde 0)');
  frame
    .command('add')
    .argument('<animation-id>')
    .requiredOption('--sprite <id>')
    .requiredOption('--duration <ms>')
    .description('Añadir un frame al final')
    .action(async (id: string, options: Required<FrameOptions>) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.addFrame(id, options.sprite, number(options.duration, 'La duración')),
      );
      process.stdout.write('Frame añadido.\n');
    });

  frame
    .command('insert')
    .argument('<animation-id>')
    .requiredOption('--at <index>')
    .requiredOption('--sprite <id>')
    .requiredOption('--duration <ms>')
    .description('Insertar en un índice desde 0')
    .action(async (id: string, options: Required<FrameOptions>) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.addFrame(
          id,
          options.sprite,
          number(options.duration, 'La duración'),
          index(options.at),
        ),
      );
      process.stdout.write('Frame insertado.\n');
    });

  frame
    .command('set')
    .argument('<animation-id>')
    .requiredOption('--at <index>')
    .option('--sprite <id>')
    .option('--duration <ms>')
    .description('Cambiar sprite o duración de un frame')
    .action(async (id: string, options: FrameOptions) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.setFrame(
          id,
          index(options.at!),
          options.sprite,
          options.duration === undefined ? undefined : number(options.duration, 'La duración'),
        ),
      );
      process.stdout.write('Frame actualizado.\n');
    });

  frame
    .command('move')
    .argument('<animation-id>')
    .requiredOption('--from <index>')
    .requiredOption('--to <index>')
    .description('Mover un frame dentro de la secuencia')
    .action(async (id: string, options: Required<FrameOptions>) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.moveFrame(id, index(options.from), index(options.to)),
      );
      process.stdout.write('Frame movido.\n');
    });

  frame
    .command('rm')
    .argument('<animation-id>')
    .requiredOption('--at <index>')
    .description('Quitar un frame')
    .option('--yes', 'Confirmar en un script')
    .action(async (id: string, options: { at: string; yes?: boolean }) => {
      await withContext(program, true, async ({ workspace }) => {
        const location = await workspace.showAnimation(id);
        const at = index(options.at);
        if (at >= location.animation.frames.length) {
          throw new PipelineError('INVALID_INPUT', `Índice de frame fuera de rango: ${at}.`);
        }
        process.stdout.write(`Eliminar frame ${at} de ${id}.\n`);
        await requireConfirmation(Boolean(options.yes), 'Se eliminará el frame.');
        await workspace.removeFrame(id, at);
      });
      process.stdout.write('Frame eliminado.\n');
    });
}
