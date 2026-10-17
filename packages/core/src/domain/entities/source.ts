import { PipelineError } from '../errors.js';
import type { Pivot, Rectangle, SourceDefinitions, SpriteDefinition } from '../repository.js';
import { Animation } from './animation.js';

function cloneSprite(rect: Rectangle, pivot: Pivot): SpriteDefinition {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    pivot: { x: pivot.x, y: pivot.y },
  };
}

/**
 * Definitions of one source file: its sprites and animations. Sprite-id
 * uniqueness is repository-wide, so the aggregate checks it; this entity owns
 * the local rules (frames reference sprites from the same file, a source with
 * animations cannot lose its last sprite).
 */
export class Source {
  private sprites: Record<string, SpriteDefinition>;
  private animations: Record<string, Animation>;

  private constructor(
    readonly path: string,
    sprites: Record<string, SpriteDefinition>,
    animations: Record<string, Animation>,
  ) {
    this.sprites = sprites;
    this.animations = animations;
  }

  static create(path: string): Source {
    return new Source(path, {}, {});
  }

  static fromJSON(path: string, definitions: SourceDefinitions): Source {
    const sprites: Record<string, SpriteDefinition> = {};
    for (const [id, sprite] of Object.entries(definitions.sprites)) {
      sprites[id] = cloneSprite(sprite, sprite.pivot);
    }
    const animations: Record<string, Animation> = {};
    for (const [id, definition] of Object.entries(definitions.animations)) {
      const animation = Animation.fromJSON(definition);
      for (const frame of animation.list) {
        if (!Object.hasOwn(sprites, frame.sprite)) {
          throw new PipelineError(
            'INVALID_REPOSITORY',
            `El frame de ${id} referencia un sprite ajeno o inexistente: ${frame.sprite}`,
          );
        }
      }
      animations[id] = animation;
    }
    return new Source(path, sprites, animations);
  }

  get isEmpty(): boolean {
    return Object.keys(this.sprites).length === 0 && Object.keys(this.animations).length === 0;
  }

  get spriteIds(): readonly string[] {
    return Object.keys(this.sprites);
  }

  get animationIds(): readonly string[] {
    return Object.keys(this.animations);
  }

  hasSprite(id: string): boolean {
    return Object.hasOwn(this.sprites, id);
  }

  sprite(id: string): SpriteDefinition | undefined {
    return Object.hasOwn(this.sprites, id) ? this.sprites[id] : undefined;
  }

  animation(id: string): Animation | undefined {
    return Object.hasOwn(this.animations, id) ? this.animations[id] : undefined;
  }

  addSprite(id: string, rect: Rectangle, pivot: Pivot): void {
    this.sprites[id] = cloneSprite(rect, pivot);
  }

  setSprite(id: string, rect: Rectangle, pivot: Pivot): void {
    this.sprites[id] = cloneSprite(rect, pivot);
  }

  renameSprite(from: string, to: string): void {
    const sprite = this.sprites[from]!;
    const sprites: Record<string, SpriteDefinition> = {};
    for (const [id, definition] of Object.entries(this.sprites)) {
      if (id !== from) sprites[id] = definition;
    }
    sprites[to] = sprite;
    this.sprites = sprites;
    for (const animation of Object.values(this.animations)) {
      animation.renameSpriteReference(from, to);
    }
  }

  duplicateSprite(from: string, to: string): void {
    this.sprites[to] = this.sprites[from]!;
  }

  /** Removes a sprite; fails while animations still reference it. */
  removeSprite(id: string): { readonly sourceDropped: boolean } {
    for (const [animationId, animation] of Object.entries(this.animations)) {
      if (animation.usesSprite(id)) {
        throw new PipelineError('IN_USE', `El sprite ${id} se usa en la animación ${animationId}.`);
      }
    }
    if (Object.keys(this.sprites).length === 1) {
      if (Object.keys(this.animations).length > 0) {
        throw new PipelineError('IN_USE', 'Elimina primero las animaciones del archivo.');
      }
      delete this.sprites[id];
      return { sourceDropped: true };
    }
    delete this.sprites[id];
    return { sourceDropped: false };
  }

  addAnimation(id: string, playback: string): Animation {
    const animation = Animation.create(playback);
    this.animations[id] = animation;
    return animation;
  }

  renameAnimation(from: string, to: string): void {
    const animation = this.animations[from]!;
    const animations: Record<string, Animation> = {};
    for (const [id, definition] of Object.entries(this.animations)) {
      if (id !== from) animations[id] = definition;
    }
    animations[to] = animation;
    this.animations = animations;
  }

  removeAnimation(id: string): void {
    delete this.animations[id];
  }

  toJSON(): SourceDefinitions {
    const sprites: Record<string, SpriteDefinition> = {};
    for (const [id, sprite] of Object.entries(this.sprites)) {
      sprites[id] = cloneSprite(sprite, sprite.pivot);
    }
    const animations: Record<string, ReturnType<Animation['toJSON']>> = {};
    for (const [id, animation] of Object.entries(this.animations)) {
      animations[id] = animation.toJSON();
    }
    return { sprites, animations };
  }
}
