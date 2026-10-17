import { PipelineError } from '../errors.js';
import type { AtlasDefinition } from '../repository.js';
import { assertAtlasGap, assertAtlasSize } from '../value-objects/atlas.js';

/**
 * Atlas configuration: square page size, gap and the groups assigned to it.
 * Group exclusivity across atlases is an aggregate-level rule.
 */
export class Atlas {
  private size: number;
  private gap: number;
  private groups: string[];

  private constructor(size: number, gap: number, groups: readonly string[]) {
    this.size = size;
    this.gap = gap;
    this.groups = [...groups];
  }

  static create(size: number, gap: number): Atlas {
    assertAtlasSize(size);
    assertAtlasGap(gap, size);
    return new Atlas(size, gap, []);
  }

  static fromJSON(definition: AtlasDefinition): Atlas {
    return new Atlas(definition.size, definition.gap, definition.groups);
  }

  get pageSize(): number {
    return this.size;
  }

  get pageGap(): number {
    return this.gap;
  }

  get groupNames(): readonly string[] {
    return this.groups;
  }

  hasGroup(group: string): boolean {
    return this.groups.includes(group);
  }

  setSizeAndGap(size?: number, gap?: number): void {
    if (size === undefined && gap === undefined) {
      throw new PipelineError('INVALID_INPUT', 'Indica --size o --gap.');
    }
    const nextSize = size ?? this.size;
    const nextGap = gap ?? this.gap;
    assertAtlasSize(nextSize);
    assertAtlasGap(nextGap, nextSize);
    this.size = nextSize;
    this.gap = nextGap;
  }

  assignGroup(group: string): void {
    this.groups = [...this.groups, group].sort((left, right) => left.localeCompare(right));
  }

  unassignGroup(group: string): void {
    this.groups = this.groups.filter((candidate) => candidate !== group);
  }

  toJSON(): AtlasDefinition {
    return { size: this.size, gap: this.gap, groups: [...this.groups] };
  }
}
