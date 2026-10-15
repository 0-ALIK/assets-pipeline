import type {
  AssetRecord,
  OperationRecord,
  ProjectConfiguration,
  RepositoryDatabase,
} from '../domain/repository.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Expected "${field}" to be a non-empty string.`);
  }
  return value;
}

export function validateRepositoryDatabase(value: unknown): RepositoryDatabase {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new TypeError('Unsupported or invalid repository database schema.');
  }

  const project = value.project;
  if (!isRecord(project) || project.schemaVersion !== 1) {
    throw new TypeError('Invalid project configuration in repository database.');
  }

  const validatedProject: ProjectConfiguration = {
    id: requireString(project, 'id'),
    name: requireString(project, 'name'),
    schemaVersion: 1,
    createdAt: requireString(project, 'createdAt'),
    updatedAt: requireString(project, 'updatedAt'),
  };

  if (!Array.isArray(value.assets) || !Array.isArray(value.operationHistory)) {
    throw new TypeError('Repository database assets and operationHistory must be arrays.');
  }

  const assets: AssetRecord[] = value.assets.map((item): AssetRecord => {
    if (!isRecord(item) || !isRecord(item.metadata)) {
      throw new TypeError('Invalid asset record in repository database.');
    }
    return {
      id: requireString(item, 'id'),
      sourcePath: requireString(item, 'sourcePath'),
      kind: requireString(item, 'kind'),
      importedAt: requireString(item, 'importedAt'),
      metadata: item.metadata,
    };
  });

  const operationHistory: OperationRecord[] = value.operationHistory.map(
    (item): OperationRecord => {
      if (!isRecord(item)) {
        throw new TypeError('Invalid operation record in repository database.');
      }
      const status = item.status;
      if (status !== 'pending' && status !== 'succeeded' && status !== 'failed') {
        throw new TypeError('Invalid operation status in repository database.');
      }
      const completedAt = item.completedAt;
      const summary = item.summary;
      if (completedAt !== undefined && typeof completedAt !== 'string') {
        throw new TypeError('Invalid completedAt in repository database operation.');
      }
      if (summary !== undefined && typeof summary !== 'string') {
        throw new TypeError('Invalid summary in repository database operation.');
      }
      return {
        id: requireString(item, 'id'),
        type: requireString(item, 'type'),
        startedAt: requireString(item, 'startedAt'),
        status,
        ...(completedAt === undefined ? {} : { completedAt }),
        ...(summary === undefined ? {} : { summary }),
      };
    },
  );

  return { schemaVersion: 1, project: validatedProject, assets, operationHistory };
}
