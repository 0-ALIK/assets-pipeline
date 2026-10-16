import type { Command } from 'commander';
import { PipelineError } from '@assets-pipeline/core';
import { launchDesktopApp, repositoryUrl } from '../adapters/launch-desktop.js';
import { repositoryRoot } from '../context.js';

interface OpenOptions {
  readonly print?: boolean;
}

async function resolveRoot(program: Command): Promise<string | undefined> {
  const { repo } = program.opts<{ repo?: string }>();
  try {
    return await repositoryRoot(program);
  } catch (error) {
    // Without an explicit --repo, a bare invocation opens the app launcher.
    if (error instanceof PipelineError && error.code === 'NOT_FOUND' && !repo) return undefined;
    throw error;
  }
}

export async function runOpen(program: Command, options: OpenOptions): Promise<void> {
  const root = await resolveRoot(program);
  if (options.print) {
    process.stdout.write(`${repositoryUrl(root)}\n`);
    return;
  }
  await launchDesktopApp(root);
  process.stdout.write(
    root ? `Abriendo Assets Pipeline en ${root}\n` : 'Abriendo Assets Pipeline\n',
  );
}

export function addOpenCommand(program: Command): void {
  program
    .command('open')
    .description('Abrir la app de escritorio sobre el repositorio actual')
    .option('--print', 'Mostrar la URL de apertura sin lanzar la app')
    .action(async (options: OpenOptions) => {
      await runOpen(program, options);
    });
}
