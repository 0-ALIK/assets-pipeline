import { groupFromIdentifier } from '@assets-pipeline/core';
import type { RepositoryDatabase } from '@assets-pipeline/core';

export interface GroupInfo {
  readonly name: string;
  readonly spriteIds: readonly string[];
  /** Atlas this group is assigned to, or null when unassigned. */
  readonly atlas: string | null;
}

export interface AtlasInfo {
  readonly name: string;
  readonly size: number;
  readonly gap: number;
  readonly groups: readonly string[];
  readonly spriteCount: number;
}

/** Derived groups (first ID segment) with their atlas assignment. */
export function deriveGroups(database: RepositoryDatabase): readonly GroupInfo[] {
  const groups = new Map<string, string[]>();
  for (const source of Object.values(database.sources)) {
    for (const id of Object.keys(source.sprites)) {
      const group = groupFromIdentifier(id);
      groups.set(group, [...(groups.get(group) ?? []), id]);
    }
  }
  const assignment = new Map<string, string>();
  for (const [atlasName, atlas] of Object.entries(database.atlases)) {
    for (const group of atlas.groups) assignment.set(group, atlasName);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, spriteIds]) => ({
      name,
      spriteIds: [...spriteIds].sort((left, right) => left.localeCompare(right)),
      atlas: assignment.get(name) ?? null,
    }));
}

export function listAtlases(database: RepositoryDatabase): readonly AtlasInfo[] {
  const spriteCountByGroup = new Map(
    deriveGroups(database).map((group) => [group.name, group.spriteIds.length]),
  );
  return Object.entries(database.atlases)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, atlas]) => ({
      name,
      size: atlas.size,
      gap: atlas.gap,
      groups: [...atlas.groups],
      spriteCount: atlas.groups.reduce(
        (total, group) => total + (spriteCountByGroup.get(group) ?? 0),
        0,
      ),
    }));
}

export function unassignedGroups(database: RepositoryDatabase): readonly GroupInfo[] {
  return deriveGroups(database).filter((group) => group.atlas === null);
}
