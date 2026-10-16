import { lstat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Command } from 'commander';
import { PipelineError } from '@assets-pipeline/core';
import { createContext, withContext, withRepositoryLock } from '../context.js';
import { findRepository } from '../adapters/node-files.js';
import { printListing } from '../output/format.js';

export function addProjectCommands(program: Command): void {
  program
    .command('init')
    .description('Inicializar un repositorio de assets')
    .argument('<name>', 'Nombre del proyecto')
    .option('--path <directory>', 'Carpeta existente del repositorio', '.')
    .action(async (name: string, options: { path: string }) => {
      const target = resolve(options.path);
      const stat = await lstat(target);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new PipelineError(
          'INVALID_INPUT',
          'El repositorio debe ser una carpeta real existente.',
        );
      }
      const root = await realpath(target);
      if (await findRepository(root)) {
        throw new PipelineError(
          'ALREADY_EXISTS',
          'Esta carpeta está dentro de un repositorio existente.',
        );
      }
      await withRepositoryLock(root, async () =>
        createContext(root).workspace.initialize(name, randomUUID()),
      );
      process.stdout.write(`Repositorio creado en ${root}\n`);
    });

  program
    .command('info')
    .description('Mostrar información del repositorio')
    .action(async () => {
      await withContext(program, false, async ({ root, workspace }) => {
        const database = await workspace.read();
        process.stdout.write(
          `Proyecto: ${database.project.name}\nID: ${database.project.id}\nRaíz: ${root}\nEsquema: ${database.schemaVersion}\nArchivos definidos: ${Object.keys(database.sources).length}\n`,
        );
        if (database.legacy)
          process.stdout.write(
            `Datos heredados conservados: ${database.legacy.assets.length} assets\n`,
          );
      });
    });

  program
    .command('status')
    .description('Resumir el estado de los archivos')
    .action(async () => {
      await withContext(program, false, async ({ workspace }) => {
        const listed = await workspace.list();
        for (const status of ['defined', 'undefined', 'missing'] as const) {
          process.stdout.write(
            `${status}: ${listed.filter((file) => file.status === status).length}\n`,
          );
        }
      });
    });

  program
    .command('ls')
    .description('Listar el contenido del repositorio')
    .option('--untracked', 'Mostrar solo PNG y Aseprite sin definiciones')
    .action(async (options: { untracked?: boolean }) => {
      await withContext(program, false, async ({ workspace }) => {
        const files = await workspace.list();
        printListing(
          options.untracked ? files.filter((file) => file.status === 'undefined') : files,
        );
      });
    });

  program
    .command('validate')
    .description('Validar las definiciones y los archivos de origen')
    .argument('[path]', 'Archivo del repositorio')
    .action(async (path?: string) => {
      await withContext(program, false, async ({ workspace }) => {
        const issues = await workspace.validate(path);
        if (issues.length > 0) {
          for (const issue of issues) process.stderr.write(`• ${issue}\n`);
          throw new PipelineError('INVALID_SOURCE', `${issues.length} problema(s) de validación.`);
        }
        process.stdout.write('Validación correcta.\n');
      });
    });
}
