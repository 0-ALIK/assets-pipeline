import { PipelineError } from '../../domain/errors.js';
import { groupFromIdentifier } from '../../domain/rules.js';
import type {
  AnimationDefinition,
  Pivot,
  RepositoryDatabase,
  SpriteDefinition,
} from '../../domain/repository.js';

export interface AtlasSourceSprite extends SpriteDefinition {
  readonly id: string;
  readonly sourcePath: string;
}

export interface AtlasAnimationPlan extends AnimationDefinition {
  readonly id: string;
}

export interface AtlasPlacement {
  readonly id: string;
  readonly sourcePath: string;
  readonly source: Readonly<Pick<SpriteDefinition, 'x' | 'y' | 'width' | 'height'>>;
  readonly pivot: Pivot;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AtlasPagePlan {
  readonly atlas: string;
  readonly page: number;
  readonly fileName: string;
  readonly size: number;
  readonly gap: number;
  readonly sprites: readonly AtlasPlacement[];
  readonly animations: readonly AtlasAnimationPlan[];
}

export interface AtlasBuildPlan {
  readonly pages: readonly AtlasPagePlan[];
  readonly index: Readonly<Record<string, string>>;
}

interface MutablePage {
  readonly x: number;
  readonly y: number;
  readonly rowHeight: number;
  readonly sprites: readonly AtlasPlacement[];
  readonly animations: readonly AtlasAnimationPlan[];
}

function allSprites(database: RepositoryDatabase): AtlasSourceSprite[] {
  return Object.entries(database.sources).flatMap(([sourcePath, source]) =>
    Object.entries(source.sprites).map(([id, sprite]) => ({ id, sourcePath, ...sprite })),
  );
}

function allAnimations(database: RepositoryDatabase): AtlasAnimationPlan[] {
  return Object.values(database.sources).flatMap((source) =>
    Object.entries(source.animations).map(([id, animation]) => ({ id, ...animation })),
  );
}

function connectedSpriteUnits(
  sprites: readonly AtlasSourceSprite[],
  animations: readonly AtlasAnimationPlan[],
): AtlasSourceSprite[][] {
  const parent = new Map(sprites.map((sprite) => [sprite.id, sprite.id]));
  const find = (id: string): string => {
    const current = parent.get(id);
    if (!current) throw new PipelineError('INVALID_REPOSITORY', `Sprite inexistente: ${id}.`);
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  for (const animation of animations) {
    const first = animation.frames[0]!.sprite;
    for (const frame of animation.frames.slice(1)) union(first, frame.sprite);
  }

  const units = new Map<string, AtlasSourceSprite[]>();
  for (const sprite of sprites) {
    const root = find(sprite.id);
    units.set(root, [...(units.get(root) ?? []), sprite]);
  }
  const spriteOrder = (left: AtlasSourceSprite, right: AtlasSourceSprite): number =>
    right.height - left.height || right.width - left.width || left.id.localeCompare(right.id);
  return [...units.values()]
    .map((unit) => unit.sort(spriteOrder))
    .sort(
      (left, right) =>
        Math.max(...right.map((sprite) => sprite.height)) -
          Math.max(...left.map((sprite) => sprite.height)) ||
        right.reduce((area, sprite) => area + sprite.width * sprite.height, 0) -
          left.reduce((area, sprite) => area + sprite.width * sprite.height, 0) ||
        left[0]!.id.localeCompare(right[0]!.id),
    );
}

function emptyPage(): MutablePage {
  return { x: 0, y: 0, rowHeight: 0, sprites: [], animations: [] };
}

function tryPlaceUnit(
  initial: MutablePage,
  sprites: readonly AtlasSourceSprite[],
  size: number,
  gap: number,
): MutablePage | null {
  let x = initial.x;
  let y = initial.y;
  let rowHeight = initial.rowHeight;
  const placements = [...initial.sprites];
  for (const sprite of sprites) {
    let placementX = x === 0 ? 0 : x + gap;
    if (placementX + sprite.width > size) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
      placementX = 0;
    }
    if (y + sprite.height > size) return null;
    placements.push({
      id: sprite.id,
      sourcePath: sprite.sourcePath,
      source: {
        x: sprite.x,
        y: sprite.y,
        width: sprite.width,
        height: sprite.height,
      },
      pivot: sprite.pivot,
      x: placementX,
      y,
      width: sprite.width,
      height: sprite.height,
    });
    x = placementX + sprite.width;
    rowHeight = Math.max(rowHeight, sprite.height);
  }
  return { x, y, rowHeight, sprites: placements, animations: initial.animations };
}

/** Creates a deterministic shelf-packed build plan. It does not read or write image pixels. */
export function planAtlasBuild(database: RepositoryDatabase): AtlasBuildPlan {
  const sprites = allSprites(database);
  const animations = allAnimations(database);
  if (sprites.length === 0) {
    throw new PipelineError('INVALID_INPUT', 'No hay sprites definidos para construir.');
  }
  if (Object.keys(database.atlases).length === 0) {
    throw new PipelineError('INVALID_INPUT', 'Define al menos un atlas antes de construir.');
  }

  const availableGroups = new Set(sprites.map((sprite) => groupFromIdentifier(sprite.id)));
  const assignment = new Map<string, string>();
  for (const [atlasName, atlas] of Object.entries(database.atlases)) {
    if (atlas.groups.length === 0) {
      throw new PipelineError('INVALID_INPUT', `El atlas ${atlasName} no tiene grupos.`);
    }
    for (const group of atlas.groups) {
      if (!availableGroups.has(group)) {
        throw new PipelineError(
          'INVALID_INPUT',
          `El atlas ${atlasName} referencia un grupo inexistente: ${group}.`,
        );
      }
      if (assignment.has(group)) {
        throw new PipelineError('INVALID_REPOSITORY', `Grupo asignado más de una vez: ${group}`);
      }
      assignment.set(group, atlasName);
    }
  }
  const unassigned = [...availableGroups].filter((group) => !assignment.has(group)).sort();
  if (unassigned.length > 0) {
    throw new PipelineError('INVALID_INPUT', `Grupos sin atlas: ${unassigned.join(', ')}.`);
  }

  const animationAtlases = new Map<string, string>();
  for (const animation of animations) {
    if (animation.frames.length === 0) {
      throw new PipelineError('INVALID_INPUT', `La animación ${animation.id} no tiene frames.`);
    }
    const atlases = new Set(
      animation.frames.map((frame) => assignment.get(groupFromIdentifier(frame.sprite))),
    );
    if (atlases.size !== 1 || atlases.has(undefined)) {
      throw new PipelineError(
        'INVALID_INPUT',
        `Los frames de la animación ${animation.id} pertenecen a atlas diferentes.`,
      );
    }
    animationAtlases.set(animation.id, [...atlases][0]!);
  }

  const pages: AtlasPagePlan[] = [];
  const index: Record<string, string> = {};
  for (const [atlasName, atlas] of Object.entries(database.atlases)) {
    const atlasSprites = sprites.filter(
      (sprite) => assignment.get(groupFromIdentifier(sprite.id)) === atlasName,
    );
    const atlasAnimations = animations
      .filter((animation) => animationAtlases.get(animation.id) === atlasName)
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const sprite of atlasSprites) {
      if (sprite.width > atlas.size || sprite.height > atlas.size) {
        throw new PipelineError(
          'INVALID_INPUT',
          `El sprite ${sprite.id} (${sprite.width}x${sprite.height}) no cabe en ${atlasName} (${atlas.size}x${atlas.size}).`,
        );
      }
    }

    const mutablePages: MutablePage[] = [];
    for (const unit of connectedSpriteUnits(atlasSprites, atlasAnimations)) {
      const current = mutablePages.at(-1);
      let placed = current ? tryPlaceUnit(current, unit, atlas.size, atlas.gap) : null;
      if (!placed) {
        placed = tryPlaceUnit(emptyPage(), unit, atlas.size, atlas.gap);
        if (!placed) {
          const unitIds = new Set(unit.map((sprite) => sprite.id));
          const animationIds = atlasAnimations
            .filter((animation) => animation.frames.some((frame) => unitIds.has(frame.sprite)))
            .map((animation) => animation.id);
          throw new PipelineError(
            'INVALID_INPUT',
            `Los frames conectados por ${animationIds.join(', ')} no caben juntos en ${atlasName} (${atlas.size}x${atlas.size}).`,
          );
        }
        mutablePages.push(placed);
      } else {
        mutablePages[mutablePages.length - 1] = placed;
      }
    }

    for (const animation of atlasAnimations) {
      const pageIndex = mutablePages.findIndex((page) =>
        page.sprites.some((sprite) => sprite.id === animation.frames[0]!.sprite),
      );
      const page = mutablePages[pageIndex];
      if (
        !page ||
        animation.frames.some((frame) => !page.sprites.some((sprite) => sprite.id === frame.sprite))
      ) {
        throw new PipelineError(
          'INVALID_REPOSITORY',
          `La animación ${animation.id} quedó dividida entre páginas.`,
        );
      }
      mutablePages[pageIndex] = {
        ...page,
        animations: [...page.animations, animation],
      };
    }

    mutablePages.forEach((page, pageIndex) => {
      const fileName = `${atlasName}_${pageIndex}.png`;
      for (const sprite of page.sprites) index[sprite.id] = fileName;
      pages.push({
        atlas: atlasName,
        page: pageIndex,
        fileName,
        size: atlas.size,
        gap: atlas.gap,
        sprites: page.sprites,
        animations: page.animations,
      });
    });
  }
  return {
    pages,
    index: Object.fromEntries(
      Object.entries(index).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}
