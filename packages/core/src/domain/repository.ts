export interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Pivot {
  readonly x: number;
  readonly y: number;
}

export interface SpriteDefinition extends Rectangle {
  readonly pivot: Pivot;
}

export interface AnimationFrame {
  readonly sprite: string;
  readonly durationMs: number;
}

export interface AnimationDefinition {
  readonly playback: 'loop' | 'once';
  readonly frames: readonly AnimationFrame[];
}

export interface SourceDefinitions {
  readonly sprites: Readonly<Record<string, SpriteDefinition>>;
  readonly animations: Readonly<Record<string, AnimationDefinition>>;
}

export interface AtlasDefinition {
  /** Width and height of every square atlas page, in pixels. */
  readonly size: number;
  /** Transparent pixels inserted between sprites and rows, never around the outer edge. */
  readonly gap: number;
  /** First ID segments assigned to this atlas. */
  readonly groups: readonly string[];
}

export interface ProjectConfiguration {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Preserves data created with the original, pre-CLI repository scaffold. */
export interface LegacyData {
  readonly assets: readonly Readonly<Record<string, unknown>>[];
  readonly operationHistory: readonly Readonly<Record<string, unknown>>[];
}

export interface RepositoryDatabase {
  readonly schemaVersion: 4;
  readonly project: ProjectConfiguration;
  readonly sources: Readonly<Record<string, SourceDefinitions>>;
  readonly atlases: Readonly<Record<string, AtlasDefinition>>;
  readonly legacy?: LegacyData;
}
