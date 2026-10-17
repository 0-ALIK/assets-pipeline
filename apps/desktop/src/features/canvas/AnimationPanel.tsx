import { Delete } from 'pixelarticons/react/Delete.js';
import { Plus } from 'pixelarticons/react/Plus.js';
import { Repeat } from 'pixelarticons/react/Repeat.js';
import type { AnimationDefinition } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
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
        <Button size="sm" onClick={onNew} disabled={busy}>
          <Plus width={24} height={24} /> Nueva
        </Button>
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={
                      animation.playback === 'loop'
                        ? 'Cambiar a reproducción única'
                        : 'Cambiar a bucle'
                    }
                    aria-label="Cambiar modo de reproducción"
                    disabled={busy}
                    onClick={() => onTogglePlayback(id)}
                  >
                    <Repeat width={24} height={24} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Eliminar animación"
                    aria-label={`Eliminar ${id}`}
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
