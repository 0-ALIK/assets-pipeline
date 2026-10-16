#!/usr/bin/env node
import { Command } from 'commander';
import { PipelineError } from '@assets-pipeline/core';
import { addAnimationCommands } from './commands/animation.js';
import { addAtlasCommands } from './commands/atlas.js';
import { addBuildCommand } from './commands/build.js';
import { addFilesystemCommands } from './commands/filesystem.js';
import { addProjectCommands } from './commands/project.js';
import { addSpriteCommands } from './commands/sprite.js';
import { addVersionCommand } from './commands/version.js';

const program = new Command();
program.name('assets-pipeline').description('Assets Pipeline command-line tools');
program.option('--repo <directory>', 'Raíz de un repositorio existente');
addVersionCommand(program);
addProjectCommands(program);
addFilesystemCommands(program);
addSpriteCommands(program);
addAnimationCommands(program);
addAtlasCommands(program);
addBuildCommand(program);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof PipelineError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
  } else if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(`${String(error)}\n`);
  }
  process.exitCode = 1;
}
