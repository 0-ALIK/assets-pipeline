import { Plus, Repeat2, Trash2 } from 'lucide-react';
import type { AnimationDefinition } from '@assets-pipeline/core';
import { totalDuration } from '../preview/pivot-math.js';

interface AnimationPanelProps {
  readonly animations: Readonly<Record<string, AnimationDefinition>>;
  readonly animationIds: readonly string[];
  readonly activeId: string | null;
  readonly busy: boolean;
  readonly onOpen: (id: string) => void;
  readonly onNew: () => void;
  readonly onDelete: (id: string) => void;
  readonly onTogglePlayback: (id: string) => void;
}

export function AnimationPanel({
  animations,
  animationIds,
  activeId,
  busy,
  onOpen,
  onNew,
  onDelete,
  onTogglePlayback,
}: AnimationPanelProps) {
  return (
    <section className="side-section" aria-label="Animaciones">
      <header className="side-section-header">
        <h3>
          Animaciones <span className="side-count">{animationIds.length}</span>
        </h3>
        <button type="button" className="btn btn-sm" onClick={onNew} disabled={busy}>
          <Plus size={13} /> Nueva
        </button>
      </header>
      {animationIds.length === 0 ? (
        <p className="side-placeholder">
          Sin animaciones en este archivo. Crea una eligiendo sprites, orden y duración.
        </p>
      ) : (
        <ul className="animation-list">
          {animationIds.map((id) => {
            const animation = animations[id]!;
            return (
              <li key={id} className={`animation-item${id === activeId ? ' is-selected' : ''}`}>
                <button type="button" className="animation-main" onClick={() => onOpen(id)}>
                  <span className="animation-name">{id}</span>
                  <span className="animation-meta">
                    {animation.playback === 'loop' ? 'loop' : 'once'} · {animation.frames.length}{' '}
                    frames · {totalDuration(animation.frames)} ms
                  </span>
                </button>
                <div className="animation-actions">
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    title={
                      animation.playback === 'loop'
                        ? 'Cambiar a reproducción única'
                        : 'Cambiar a bucle'
                    }
                    aria-label="Cambiar modo de reproducción"
                    disabled={busy}
                    onClick={() => onTogglePlayback(id)}
                  >
                    <Repeat2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    title="Eliminar animación"
                    aria-label={`Eliminar ${id}`}
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
    </section>
  );
}
