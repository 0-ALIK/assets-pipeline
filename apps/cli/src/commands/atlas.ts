import type { Command } from 'commander';
import { withContext } from '../context.js';
import { printJson, requireConfirmation } from '../output/format.js';
import { number } from './values.js';

export function addAtlasCommands(program: Command): void {
  const group = program.command('group').description('Consultar grupos derivados de los IDs');
  group
    .command('list')
    .description('Listar los primeros segmentos de los IDs de sprites')
    .action(async () => {
      await withContext(program, false, async ({ workspace }) =>
        printJson(await workspace.listGroups()),
      );
    });
  group
    .command('show')
    .argument('<name>')
    .description('Mostrar los sprites que pertenecen a un grupo')
    .action(async (name: string) => {
      await withContext(program, false, async ({ workspace }) =>
        printJson(await workspace.showGroup(name)),
      );
    });

  const atlas = program.command('atlas').description('Configurar atlas y sus grupos');
  atlas
    .command('list')
    .description('Listar atlas configurados')
    .action(async () => {
      await withContext(program, false, async ({ workspace }) =>
        printJson(await workspace.listAtlases()),
      );
    });
  atlas
    .command('show')
    .argument('<name>')
    .description('Mostrar tamaño y grupos de un atlas')
    .action(async (name: string) => {
      await withContext(program, false, async ({ workspace }) =>
        printJson(await workspace.showAtlas(name)),
      );
    });
  atlas
    .command('add')
    .argument('<name>')
    .requiredOption('--size <pixels>', 'Ancho y alto máximos de cada página')
    .option('--gap <pixels>', 'Espacio transparente entre sprites', '0')
    .description('Crear un atlas inicialmente sin grupos')
    .action(async (name: string, options: { size: string; gap: string }) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.addAtlas(name, number(options.size, 'El tamaño'), number(options.gap, 'El gap')),
      );
      process.stdout.write(`Atlas creado: ${name}\n`);
    });
  atlas
    .command('set')
    .argument('<name>')
    .option('--size <pixels>', 'Ancho y alto máximos de cada página')
    .option('--gap <pixels>', 'Espacio transparente entre sprites')
    .description('Cambiar el tamaño o gap de un atlas')
    .action(async (name: string, options: { size?: string; gap?: string }) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.setAtlas(
          name,
          options.size === undefined ? undefined : number(options.size, 'El tamaño'),
          options.gap === undefined ? undefined : number(options.gap, 'El gap'),
        ),
      );
      process.stdout.write(`Atlas actualizado: ${name}\n`);
    });
  atlas
    .command('rm')
    .argument('<name>')
    .option('--yes', 'Confirmar en un script')
    .description('Eliminar la configuración de un atlas')
    .action(async (name: string, options: { yes?: boolean }) => {
      await withContext(program, true, async ({ workspace }) => {
        const current = await workspace.showAtlas(name);
        process.stdout.write(
          `Eliminar atlas ${name} con ${current.atlas.groups.length} grupo(s).\n`,
        );
        await requireConfirmation(Boolean(options.yes), 'Se eliminará la configuración del atlas.');
        await workspace.removeAtlas(name);
      });
      process.stdout.write(`Atlas eliminado: ${name}\n`);
    });

  const atlasGroup = atlas.command('group').description('Asignar grupos a un atlas');
  atlasGroup
    .command('add')
    .argument('<atlas>')
    .argument('<group>')
    .description('Asignar un grupo existente a un atlas')
    .action(async (name: string, groupName: string) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.assignGroup(name, groupName),
      );
      process.stdout.write(`Grupo ${groupName} asignado a ${name}.\n`);
    });
  atlasGroup
    .command('rm')
    .argument('<atlas>')
    .argument('<group>')
    .option('--yes', 'Confirmar en un script')
    .description('Quitar un grupo de un atlas')
    .action(async (name: string, groupName: string, options: { yes?: boolean }) => {
      await withContext(program, true, async ({ workspace }) => {
        await workspace.showAtlas(name);
        await requireConfirmation(Boolean(options.yes), 'El grupo quedará sin atlas.');
        await workspace.unassignGroup(name, groupName);
      });
      process.stdout.write(`Grupo ${groupName} quitado de ${name}.\n`);
    });
}
