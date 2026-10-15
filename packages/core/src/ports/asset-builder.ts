export interface BuildRequest {
  readonly assetIds: readonly string[];
  readonly options: Readonly<Record<string, unknown>>;
}

export interface BuildArtifact {
  readonly fileName: string;
  readonly mediaType: string;
  readonly contents: Uint8Array;
}

export interface AssetBuilder {
  readonly format: string;
  build(request: BuildRequest): Promise<readonly BuildArtifact[]>;
}
