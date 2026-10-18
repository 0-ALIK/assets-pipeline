import { Copy } from 'pixelarticons/react/Copy.js';
import { Delete } from 'pixelarticons/react/Delete.js';
import { Plus } from 'pixelarticons/react/Plus.js';
import type { SpriteDefinition } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';

interface SpritePanelProps {
  readonly sprites: Readonly<Record<string, SpriteDefinition>>;
  readonly spriteIds: readonly string[];
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  readonly busy: boolean;
  /** Clicking a sprite selects it and opens the edit dialog. */
  readonly onSelect: (id: string) => void;
  readonly onHover: (id: string | null) => void;
  readonly onNew: () => void;
  readonly onDuplicate: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export function SpritePanel({
  sprites,
  spriteIds,
  selectedId,
  hoveredId,
  busy,
  onSelect,
  onHover,
  onNew,
  onDuplicate,
  onDelete,
}: SpritePanelProps) {
  return (
    <section className="side-section" aria-label="Sprites">
      <header className="side-section-header">
        <h3>
          Sprites <span className="side-count">{spriteIds.length}</span>
        </h3>
        <Button size="sm" onClick={onNew} disabled={busy}>
          <Plus width={24} height={24} /> Nuevo
        </Button>
      </header>
      {spriteIds.length === 0 ? (
        <p className="side-placeholder">
          Este archivo no tiene sprites definidos. Crea el primero con «Nuevo» o dibujando una
          región en el lienzo.
        </p>
      ) : (
        <ul className="sprite-list">
          {spriteIds.map((id) => {
            const sprite = sprites[id]!;
            return (
              <li
                key={id}
                className={`sprite-item${id === selectedId ? ' is-selected' : ''}${id === hoveredId ? ' is-hovered' : ''}`}
                onPointerEnter={() => onHover(id)}
                onPointerLeave={() => onHover(null)}
              >
                <button type="button" className="sprite-main" onClick={() => onSelect(id)}>
                  <span className="sprite-name">{id}</span>
                  <span className="sprite-meta">
                    {sprite.width}×{sprite.height} · ({sprite.x}, {sprite.y}) · pivot{' '}
                    {sprite.pivot.x},{sprite.pivot.y}
                  </span>
                </button>
                <div className="sprite-actions">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Duplicar ${id}`}
                    title="Duplicar"
                    disabled={busy}
                    onClick={() => onDuplicate(id)}
                  >
                    <Copy width={24} height={24} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar ${id}`}
                    title="Eliminar"
                    disabled={busy}
                    onClick={() => onDelete(id)}
                  >
                    <Delete width={24} height={24} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
