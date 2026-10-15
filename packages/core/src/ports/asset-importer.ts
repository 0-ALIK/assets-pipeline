export interface ImportRequest {
  readonly sourcePath: string;
}

export interface ImportedAsset {
  readonly kind: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly payload: Uint8Array;
}

export interface AssetImporter {
  readonly format: string;
  canImport(sourcePath: string): boolean;
  import(request: ImportRequest): Promise<ImportedAsset>;
}
