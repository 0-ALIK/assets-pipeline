export interface AssetRecord {
  readonly id: string;
  readonly sourcePath: string;
  readonly kind: string;
  readonly importedAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface OperationRecord {
  readonly id: string;
  readonly type: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: 'pending' | 'succeeded' | 'failed';
  readonly summary?: string;
}

export interface ProjectConfiguration {
  readonly id: string;
  readonly name: string;
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RepositoryDatabase {
  readonly schemaVersion: 1;
  readonly project: ProjectConfiguration;
  readonly assets: readonly AssetRecord[];
  readonly operationHistory: readonly OperationRecord[];
}
