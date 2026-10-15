import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';

const packageJsonUrl = new URL('../../package.json', import.meta.url);

export async function readCliVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
    version?: unknown;
  };
  if (typeof packageJson.version !== 'string') {
    throw new TypeError('CLI package version is missing.');
  }
  return packageJson.version;
}

export function addVersionCommand(program: Command): void {
  program
    .command('version')
    .description('Show the Assets Pipeline CLI version')
    .action(async () => {
      process.stdout.write(`${await readCliVersion()}\n`);
    });
}
