import type { Command } from 'commander';
import { withContext } from '../context.js';
import {
  printAutoRegionPlan,
  printAutoRegionWarning,
  printJson,
  requireConfirmation,
} from '../output/format.js';
import { number, pivot, rectangle } from './values.js';

interface SpriteOptions {
  id?: string;
  rect?: string;
  pivot?: string;
}

export function addSpriteCommands(program: Command): void {
  const sprite = program.command('sprite').description('Definir regiones de sprites');
  sprite
    .command('list')
    .argument('<file>')
    .description('Listar sprites definidos en un archivo')
    .action(async (file: string) => {
      await withContext(program, false, async ({ workspace }) =>
        printJson(await workspace.listSprites(file)),
      );
    });

  sprite
    .command('show')
    .argument('<id>')
    .description('Mostrar un sprite')
    .action(async (id: string) => {
      await withContext(program, false, async ({ workspace }) =>
        printJson(await workspace.showSprite(id)),
      );
    });

  sprite
    .command('add')
    .argument('<file>')
    .description('Definir un sprite dentro de un PNG o Aseprite')
    .requiredOption('--id <id>')
    .requiredOption('--rect <x,y,width,height>')
    .requiredOption('--pivot <x,y>')
    .action(async (file: string, options: Required<SpriteOptions>) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.addSprite(file, options.id, rectangle(options.rect), pivot(options.pivot)),
      );
      process.stdout.write(`Sprite creado: ${options.id}\n`);
    });

  sprite
    .command('auto')
    .argument('<file>')
    .description('Crear regiones automáticas a partir del contenido del archivo')
    .option('--padding <pixels>', 'Margen alrededor de cada región', '0')
    .option('--dry-run', 'Mostrar las regiones sin crearlas')
    .option('--yes', 'Confirmar en un script')
    .action(async (file: string, options: { padding: string; dryRun?: boolean; yes?: boolean }) => {
      await withContext(program, !options.dryRun, async ({ workspace }) => {
        const padding = number(options.padding, 'El padding');
        printAutoRegionWarning();
        const plan = await workspace.autoRegionSprites(file, { padding, dryRun: true });
        printAutoRegionPlan(plan);
        if (options.dryRun || plan.sprites.length === 0) return;
        await requireConfirmation(
          Boolean(options.yes),
          `Se crearán ${plan.sprites.length} regiones en «${plan.group}».`,
        );
        const applied = await workspace.autoRegionSprites(file, { padding });
        const skipped = applied.skipped > 0 ? ` · ${applied.skipped} omitidas` : '';
        process.stdout.write(
          `Regiones creadas: ${applied.sprites.length} en «${applied.group}»${skipped}.\n`,
        );
      });
    });

  sprite
    .command('set')
    .argument('<id>')
    .description('Cambiar región o pivot')
    .option('--rect <x,y,width,height>')
    .option('--pivot <x,y>')
    .action(async (id: string, options: SpriteOptions) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.setSprite(
          id,
          options.rect ? rectangle(options.rect) : undefined,
          options.pivot ? pivot(options.pivot) : undefined,
        ),
      );
      process.stdout.write(`Sprite actualizado: ${id}\n`);
    });

  sprite
    .command('rename')
    .argument('<from>')
    .argument('<to>')
    .description('Renombrar un ID y actualizar los frames que lo usan')
    .action(async (from: string, to: string) => {
      await withContext(program, true, async ({ workspace }) => workspace.renameSprite(from, to));
      process.stdout.write(`Sprite renombrado: ${from} → ${to}\n`);
    });

  sprite
    .command('duplicate')
    .argument('<from>')
    .requiredOption('--id <id>')
    .description('Duplicar una definición en el mismo archivo')
    .action(async (from: string, options: { id: string }) => {
      await withContext(program, true, async ({ workspace }) =>
        workspace.duplicateSprite(from, options.id),
      );
      process.stdout.write(`Sprite duplicado: ${options.id}\n`);
    });

  sprite
    .command('rm')
    .argument('<id>')
    .description('Eliminar una definición que no tenga referencias')
    .option('--yes', 'Confirmar en un script')
    .action(async (id: string, options: { yes?: boolean }) => {
      await withContext(program, true, async ({ workspace }) => {
        const location = await workspace.showSprite(id);
        process.stdout.write(`Eliminar sprite ${id} de ${location.path}.\n`);
        await requireConfirmation(Boolean(options.yes), 'Se eliminará la definición.');
        await workspace.removeSprite(id);
      });
      process.stdout.write(`Sprite eliminado: ${id}\n`);
    });
}
