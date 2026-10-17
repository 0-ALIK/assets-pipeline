import { randomUUID } from 'node:crypto';
import { open, realpath, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { Command } from 'commander';
import {
  createJsonRepositoryStore,
  PipelineError,
  RepositoryWorkspace,
  validateRepositoryDatabase,
} from '@assets-pipeline/core';
import {
  createNodeRepositoryFileSystem,
  databasePath,
  ensureCacheDirectory,
  findRepository,
  NodeManagedFiles,
} from './adapters/node-files.js';
import { NodeAtlasBuilder } from './adapters/node-atlas-builder.js';
import { createNodeEventPublisher } from './adapters/node-events.js';
import { createNodeImporters } from './adapters/node-importers.js';

export interface CliContext {
  readonly root: string;
  readonly workspace: RepositoryWorkspace;
}

export function createContext(root: string): CliContext {
  const store = createJsonRepositoryStore({
    databasePath: databasePath(root),
    fileSystem: createNodeRepositoryFileSystem(),
    validate: validateRepositoryDatabase,
  });
  const events = createNodeEventPublisher();
  return {
    root,
    workspace: new RepositoryWorkspace({
      store,
      files: new NodeManagedFiles(root),
      now: () => new Date().toISOString(),
      importers: createNodeImporters(root),
      builder: new NodeAtlasBuilder(),
      ...(events ? { events } : {}),
    }),
  };
}

export async function repositoryRoot(program: Command): Promise<string> {
  const { repo } = program.opts<{ repo?: string }>();
  const root = await findRepository(repo ? resolve(repo) : process.cwd());
  if (!root)
    throw new PipelineError(
      'NOT_FOUND',
      'No hay repositorio. Ejecuta assets-pipeline init primero.',
    );
  if (repo && (await realpath(resolve(repo))) !== root) {
    throw new PipelineError('INVALID_INPUT', '--repo debe apuntar a la raíz de un repositorio.');
  }
  return root;
}

export async function withContext<T>(
  program: Command,
  write: boolean,
  action: (context: CliContext) => Promise<T>,
): Promise<T> {
  const root = await repositoryRoot(program);
  const context = createContext(root);
  return write ? withRepositoryLock(root, () => action(context)) : action(context);
}

export async function withRepositoryLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  const path = join(root, '.assets-pipeline-cache', 'lock');
  await ensureCacheDirectory(root);
  let handle;
  try {
    handle = await open(path, 'wx');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') {
      throw new PipelineError(
        'IN_USE',
        'El repositorio está ocupado. Si quedó un lock tras un fallo, revísalo antes de eliminarlo.',
      );
    }
    throw error;
  }
  try {
    await handle.writeFile(`${process.pid} ${randomUUID()}\n`);
    return await action();
  } finally {
    await handle.close();
    await rm(path, { force: true });
  }
}
