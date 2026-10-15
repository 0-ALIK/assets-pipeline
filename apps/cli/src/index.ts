#!/usr/bin/env node
import { Command } from 'commander';
import { addVersionCommand } from './commands/version.js';

const program = new Command();
program.name('assets-pipeline').description('Assets Pipeline command-line tools');
addVersionCommand(program);

await program.parseAsync(process.argv);
