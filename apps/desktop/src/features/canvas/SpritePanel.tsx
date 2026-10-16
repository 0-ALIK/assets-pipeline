import { Copy, Plus, Trash2 } from 'lucide-react';
import type { SpriteDefinition } from '@assets-pipeline/core';
import type { Point, Pivot, Rect } from './sprite-editor.js';

export interface SpriteDraft {
  readonly originalId: string;
  readonly id: string;
  readonly rect: Rect;
  readonly pivot: Pivot;
}

interface SpritePanelProps {
  readonly sprites: Readonly<Record<string, SpriteDefinition>>;
  readonly spriteIds: readonly string[];
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  readonly draft: SpriteDraft | null;
  readonly busy: boolean;
  readonly cursor: Point | null;
  readonly onSelect: (id: string | null) => void;
  readonly onHover: (id: string | null) => void;
  readonly onDraft: (draft: SpriteDraft) => void;
  readonly onApply: () => void;
  readonly onReset: () => void;
  readonly onNew: () => void;
  readonly onDuplicate: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export function SpritePanel({
  sprites,
  spriteIds,
  selectedId,
  hoveredId,
  draft,
  busy,
  cursor,
  onSelect,
  onHover,
  onDraft,
  onApply,
  onReset,
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
        <button type="button" className="btn btn-sm" onClick={onNew} disabled={busy}>
          <Plus size={13} /> Nuevo
        </button>
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
                    {sprite.pivot.x}, {sprite.pivot.y}
                  </span>
                </button>
                <div className="sprite-actions">
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    aria-label={`Duplicar ${id}`}
                    title="Duplicar"
                    disabled={busy}
                    onClick={() => onDuplicate(id)}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    aria-label={`Eliminar ${id}`}
                    title="Eliminar"
                    disabled={busy}
                    onClick={() => onDelete(id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {draft ? (
        <form
          className="sprite-form"
          onSubmit={(event) => {
            event.preventDefault();
            onApply();
          }}
        >
          <h4>Editar sprite</h4>
          <label className="field">
            <span className="field-label">ID</span>
            <input
              className="input mono"
              value={draft.id}
              onChange={(event) => onDraft({ ...draft, id: event.target.value })}
            />
          </label>
          <div className="grid-4">
            <NumberInput
              label="x"
              value={draft.rect.x}
              onChange={(value) => onDraft({ ...draft, rect: { ...draft.rect, x: value } })}
            />
            <NumberInput
              label="y"
              value={draft.rect.y}
              onChange={(value) => onDraft({ ...draft, rect: { ...draft.rect, y: value } })}
            />
            <NumberInput
              label="Ancho"
              value={draft.rect.width}
              onChange={(value) => onDraft({ ...draft, rect: { ...draft.rect, width: value } })}
            />
            <NumberInput
              label="Alto"
              value={draft.rect.height}
              onChange={(value) => onDraft({ ...draft, rect: { ...draft.rect, height: value } })}
            />
          </div>
          <div className="grid-2">
            <NumberInput
              label="Pivot x"
              step={0.05}
              value={draft.pivot.x}
              onChange={(value) => onDraft({ ...draft, pivot: { ...draft.pivot, x: value } })}
            />
            <NumberInput
              label="Pivot y"
              step={0.05}
              value={draft.pivot.y}
              onChange={(value) => onDraft({ ...draft, pivot: { ...draft.pivot, y: value } })}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={onReset} disabled={busy}>
              Descartar
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Aplicar
            </button>
          </div>
        </form>
      ) : null}

      <footer className="side-footer">
        {cursor ? (
          <span className="mono">
            {Math.floor(cursor.x)}, {Math.floor(cursor.y)}
          </span>
        ) : (
          <span />
        )}
        <span className="side-hint">Rueda: zoom · Espacio/central: mover vista</span>
      </footer>
    </section>
  );
}

interface NumberInputProps {
  readonly label: string;
  readonly value: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
}

function NumberInput({ label, value, step, onChange }: NumberInputProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="number"
        step={step ?? 1}
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
