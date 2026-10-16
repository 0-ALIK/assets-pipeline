import type { Command } from 'commander';
import { buildAtlases } from '../adapters/node-atlas-builder.js';
import { withContext } from '../context.js';

export function addBuildCommand(program: Command): void {
  program
    .command('build')
    .description('Generar páginas PNG, sus JSON e index.json')
    .option('--output <directory>', 'Subcarpeta de salida del repositorio', 'dist/assets')
    .option('--clean', 'Descartar cualquier resultado intermedio (el build actual ya es completo)')
    .action(async (options: { output: string; clean?: boolean }) => {
      await withContext(program, true, async ({ root, workspace }) => {
        const plan = await workspace.planBuild();
        const result = await buildAtlases(root, options.output, plan);
        process.stdout.write(
          `Build completado en ${result.output}\n${result.files.map((file) => `  ${file}`).join('\n')}\n`,
        );
      });
    });
}
