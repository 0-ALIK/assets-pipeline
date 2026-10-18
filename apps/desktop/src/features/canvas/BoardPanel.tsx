import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Expand } from 'pixelarticons/react/Expand.js';
import { EyeOff } from 'pixelarticons/react/EyeOff.js';
import { Pencil } from 'pixelarticons/react/Pencil.js';
import { Reload } from 'pixelarticons/react/Reload.js';
import { ZoomIn } from 'pixelarticons/react/ZoomIn.js';
import { ZoomOut } from 'pixelarticons/react/ZoomOut.js';
import {
  PipelineError,
  assertIdentifier,
  assertPivot,
  assertRectangle,
} from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Spinner as PixelSpinner } from '../../components/ui/pixelact-ui/spinner.js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui/pixelact-ui/tooltip.js';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';
import { useToast } from '../../components/Toast.js';
import { askConfirmation } from '../../adapters/tauri/dialogs.js';
import { useRepository } from '../project/repository-context.js';
import { PixelCanvas } from './PixelCanvas.js';
import type { PointerInfo, PointerPhase } from './PixelCanvas.js';
import { NewSpriteDialog } from './NewSpriteDialog.js';
import { SpritePanel } from './SpritePanel.js';
import { EditSpriteDialog } from './EditSpriteDialog.js';
import { AnimationPanel } from './AnimationPanel.js';
import { NewAnimationDialog } from './NewAnimationDialog.js';
import type { AnimationFrameInput } from './NewAnimationDialog.js';
import { AnimationPlayer } from '../preview/AnimationPlayer.js';
import { useSourceImage } from './useSourceImage.js';
import {
  centeredOffset,
  clamp,
  fitZoom,
  handleAtPoint,
  moveRect,
  pivotFromPoint,
  pivotPosition,
  rectContains,
  rectFromDrag,
  resizeRect,
  withinTolerance,
} from './sprite-editor.js';
import type { CanvasBounds, Point, Pivot, Rect, ResizeHandle } from './sprite-editor.js';

type DragState =
  | {
      readonly kind: 'move' | 'resize';
      readonly handle: ResizeHandle | null;
      readonly start: Point;
      readonly startRect: Rect;
      readonly moved: boolean;
    }
  | { readonly kind: 'pivot'; readonly startRect: Rect }
  | { readonly kind: 'draw'; readonly start: Point };

/** Values being edited for one sprite (canvas drags and the edit dialog). */
interface SpriteDraft {
  readonly originalId: string;
  readonly id: string;
  readonly rect: Rect;
  readonly pivot: Pivot;
}

const zoomSteps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 32];

interface BoardPanelProps {
  readonly root: string;
  readonly path: string;
}

export function BoardPanel({ root, path }: BoardPanelProps) {
  const { database, mutate, busy } = useRepository();
  const toast = useToast();
  const source = database.sources[path];
  const sprites = useMemo(() => source?.sprites ?? {}, [source]);
  const spriteIds = useMemo(
    () => Object.keys(sprites).sort((left, right) => left.localeCompare(right)),
    [sprites],
  );
  const animations = useMemo(() => source?.animations ?? {}, [source]);
  const animationIds = useMemo(
    () => Object.keys(animations).sort((left, right) => left.localeCompare(right)),
    [animations],
  );
  const {
    image,
    loading: imageLoading,
    error: imageError,
    reload: reloadImage,
  } = useSourceImage(root, path);

  const [viewport, setViewport] = useState<{ zoom: number; offset: Point }>({
    zoom: 1,
    offset: { x: 0, y: 0 },
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SpriteDraft | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [cursorStyle, setCursorStyle] = useState('default');
  const [drawMode, setDrawMode] = useState(false);
  const [drawRect, setDrawRect] = useState<Rect | null>(null);
  const [newSprite, setNewSprite] = useState<{ rect: Rect | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  const [playingAnimationId, setPlayingAnimationId] = useState<string | null>(null);
  const [newAnimationOpen, setNewAnimationOpen] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;
  const viewportInitialized = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const draftRef = useRef<SpriteDraft | null>(null);
  const nudgeTimer = useRef<number | null>(null);

  // A renamed or deleted sprite may not be in the database yet; derive the
  // effective selection from the current definitions.
  const activeSelectedId = selectedId && sprites[selectedId] ? selectedId : null;
  const activeEditingId = editingId && sprites[editingId] ? editingId : null;
  const bounds: CanvasBounds = { width: image?.width ?? 0, height: image?.height ?? 0 };
  const activeAnimationId =
    playingAnimationId && animations[playingAnimationId] ? playingAnimationId : null;
  const activeAnimation = activeAnimationId ? animations[activeAnimationId] : undefined;

  const setDraftSync = useCallback((next: SpriteDraft | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  useEffect(() => {
    viewportInitialized.current = false;
    setSelectedId(null);
    setDraftSync(null);
    setDrawMode(false);
    setDrawRect(null);
    setNewSprite(null);
    setEditingId(null);
    setDuplicateOf(null);
    setPlayingAnimationId(null);
    setNewAnimationOpen(false);
    setCursor(null);
    setHoveredId(null);
  }, [path, setDraftSync]);

  const fitViewport = useCallback((target: ImageBitmap | null) => {
    const size = stageSizeRef.current;
    if (!target || size.width === 0 || size.height === 0) return;
    const targetBounds = { width: target.width, height: target.height };
    const zoom = fitZoom(targetBounds, size);
    setViewport({ zoom, offset: centeredOffset(targetBounds, size, zoom) });
    viewportInitialized.current = true;
  }, []);

  useEffect(() => {
    if (image && !viewportInitialized.current) fitViewport(image);
  }, [fitViewport, image]);

  useEffect(() => {
    return () => {
      if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    };
  }, []);

  const selectSprite = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) {
        setDraftSync(null);
        return;
      }
      const sprite = sprites[id];
      if (!sprite) return;
      setDraftSync({
        originalId: id,
        id,
        rect: { x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height },
        pivot: { x: sprite.pivot.x, y: sprite.pivot.y },
      });
    },
    [setDraftSync, sprites],
  );

  const applyDraft = useCallback((updater: (current: SpriteDraft) => SpriteDraft) => {
    setDraft((current) => {
      if (!current) return current;
      const next = updater(current);
      draftRef.current = next;
      return next;
    });
  }, []);

  const commitDraft = useCallback(
    async (next: SpriteDraft): Promise<boolean> => {
      try {
        assertIdentifier(next.id);
        assertRectangle(next.rect, bounds.width || undefined, bounds.height || undefined);
        assertPivot(next.pivot);
      } catch (caught) {
        toast.error(caught instanceof PipelineError ? caught.message : String(caught));
        return false;
      }
      const previousId = next.originalId;
      const ok = await mutate(async (workspace) => {
        if (next.id !== previousId) await workspace.renameSprite(previousId, next.id);
        await workspace.setSprite(next.id, next.rect, next.pivot);
      });
      if (ok) {
        setSelectedId(next.id);
        setDraftSync({ ...next });
      } else {
        selectSprite(previousId);
      }
      return ok;
    },
    [bounds.height, bounds.width, mutate, selectSprite, setDraftSync, toast],
  );

  const spriteAtPoint = useCallback(
    (point: Point): string | null => {
      for (let index = spriteIds.length - 1; index >= 0; index -= 1) {
        const id = spriteIds[index]!;
        const sprite = sprites[id]!;
        if (rectContains(point, sprite)) return id;
      }
      return null;
    },
    [spriteIds, sprites],
  );

  const cursorForPoint = useCallback(
    (point: Point): string => {
      const active = draftRef.current;
      if (!active || !activeSelectedId) return 'default';
      const tolerance = 6 / viewport.zoom;
      if (withinTolerance(point, pivotPosition(active.rect, active.pivot), tolerance)) {
        return 'move';
      }
      const handle = handleAtPoint(point, active.rect, tolerance);
      if (handle === 'nw' || handle === 'se') return 'nwse-resize';
      if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
      if (rectContains(point, active.rect)) return 'move';
      return 'default';
    },
    [activeSelectedId, viewport.zoom],
  );

  const nudge = (dx: number, dy: number): void => {
    const current = draftRef.current;
    if (!current) return;
    const next = { ...current, rect: moveRect(current.rect, dx, dy, bounds) };
    setDraftSync(next);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => {
      if (draftRef.current) void commitDraft(draftRef.current);
    }, 350);
  };

  const handlePointer = (phase: PointerPhase, info: PointerInfo): void => {
    if (phase === 'leave') {
      setCursor(null);
      return;
    }
    if (phase === 'move') {
      setCursor(info.image);
      const nextCursor = cursorForPoint(info.image);
      setCursorStyle((current) => (current === nextCursor ? current : nextCursor));
    }

    if (drawMode) {
      if (phase === 'down') {
        dragRef.current = { kind: 'draw', start: info.image };
        setDrawRect(rectFromDrag(info.image, info.image, bounds));
      } else if (phase === 'move' && dragRef.current?.kind === 'draw') {
        setDrawRect(rectFromDrag(dragRef.current.start, info.image, bounds));
      } else if (phase === 'up' && dragRef.current?.kind === 'draw') {
        const start = dragRef.current.start;
        dragRef.current = null;
        const rect = rectFromDrag(start, info.image, bounds);
        setDrawMode(false);
        setDrawRect(null);
        setNewSprite({ rect });
      }
      return;
    }

    if (phase === 'down') {
      const active = draftRef.current;
      const tolerance = 6 / viewport.zoom;
      if (active && activeSelectedId) {
        if (withinTolerance(info.image, pivotPosition(active.rect, active.pivot), tolerance)) {
          dragRef.current = { kind: 'pivot', startRect: active.rect };
          return;
        }
        const handle = handleAtPoint(info.image, active.rect, tolerance);
        if (handle) {
          dragRef.current = {
            kind: 'resize',
            handle,
            start: info.image,
            startRect: active.rect,
            moved: false,
          };
          return;
        }
        if (rectContains(info.image, active.rect)) {
          dragRef.current = {
            kind: 'move',
            handle: null,
            start: info.image,
            startRect: active.rect,
            moved: false,
          };
          return;
        }
      }
      const hit = spriteAtPoint(info.image);
      if (hit !== selectedId) selectSprite(hit);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    if (phase === 'move') {
      if (drag.kind === 'move') {
        const dx = info.image.x - drag.start.x;
        const dy = info.image.y - drag.start.y;
        dragRef.current = { ...drag, moved: true };
        applyDraft((current) => ({
          ...current,
          rect: moveRect(drag.startRect, dx, dy, bounds),
        }));
      } else if (drag.kind === 'resize' && drag.handle) {
        const dx = info.image.x - drag.start.x;
        const dy = info.image.y - drag.start.y;
        dragRef.current = { ...drag, moved: true };
        applyDraft((current) => ({
          ...current,
          rect: resizeRect(drag.startRect, drag.handle!, dx, dy, bounds),
        }));
      } else if (drag.kind === 'pivot') {
        applyDraft((current) => ({
          ...current,
          pivot: pivotFromPoint(info.image, drag.startRect),
        }));
      }
      return;
    }

    if (phase === 'up') {
      dragRef.current = null;
      if (drag.kind === 'pivot' || (drag.kind !== 'draw' && drag.moved)) {
        const current = draftRef.current;
        if (current) void commitDraft(current);
      }
    }
  };

  const zoomTo = (nextZoom: number): void => {
    const clamped = clamp(nextZoom, 1, 32);
    const { zoom, offset } = viewport;
    if (clamped === zoom) return;
    const anchor = { x: stageSize.width / 2, y: stageSize.height / 2 };
    setViewport({
      zoom: clamped,
      offset: {
        x: anchor.x - ((anchor.x - offset.x) / zoom) * clamped,
        y: anchor.y - ((anchor.y - offset.y) / zoom) * clamped,
      },
    });
  };

  const stepZoom = (direction: 1 | -1): void => {
    const current = viewport.zoom;
    if (direction > 0) {
      zoomTo(zoomSteps.find((step) => step > current) ?? 32);
    } else {
      const lower = [...zoomSteps].reverse().find((step) => step < current) ?? 1;
      zoomTo(lower);
    }
  };

  const items = useMemo(
    () =>
      spriteIds.map((id) => {
        const isSelected = id === activeSelectedId;
        const usesDraft = isSelected && draft !== null;
        const sprite = sprites[id]!;
        const rect: Rect = usesDraft
          ? draft.rect
          : { x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height };
        const pivot = usesDraft ? draft.pivot : sprite.pivot;
        return {
          id,
          rect,
          selected: isSelected,
          hovered: id === hoveredId,
          pivot: isSelected ? pivotPosition(rect, pivot) : null,
        };
      }),
    [activeSelectedId, draft, hoveredId, spriteIds, sprites],
  );

  const onViewportResize = useCallback(
    (size: { width: number; height: number }) => {
      setStageSize((current) =>
        current.width === size.width && current.height === size.height ? current : size,
      );
      if (image && !viewportInitialized.current) fitViewport(image);
    },
    [fitViewport, image],
  );

  const deleteSprite = async (id: string): Promise<void> => {
    const confirmed = await askConfirmation(
      'Eliminar sprite',
      `Se eliminará la definición ${id}. Si alguna animación la usa, la operación fallará.`,
    );
    if (!confirmed) return;
    const ok = await mutate((workspace) => workspace.removeSprite(id));
    if (ok && selectedId === id) selectSprite(null);
  };

  const submitNewSprite = async (id: string, rect: Rect, pivot: Pivot): Promise<boolean> => {
    const ok = await mutate((workspace) => workspace.addSprite(path, id, rect, pivot));
    if (ok) {
      toast.success(`Sprite creado: ${id}`);
      setSelectedId(id);
      setDraftSync({ originalId: id, id, rect, pivot });
    }
    return ok;
  };

  const deleteAnimation = async (id: string): Promise<void> => {
    const confirmed = await askConfirmation(
      'Eliminar animación',
      `Se eliminará la animación ${id}. Sus sprites no se tocan.`,
    );
    if (!confirmed) return;
    const ok = await mutate((workspace) => workspace.removeAnimation(id));
    if (ok && playingAnimationId === id) setPlayingAnimationId(null);
  };

  const togglePlayback = async (id: string): Promise<void> => {
    const animation = animations[id];
    if (!animation) return;
    await mutate((workspace) =>
      workspace.setAnimationPlayback(id, animation.playback === 'loop' ? 'once' : 'loop'),
    );
  };

  const editSetPlayback = async (playback: 'loop' | 'once'): Promise<void> => {
    if (!activeAnimationId) return;
    await mutate(async (workspace) => {
      await workspace.setAnimationPlayback(activeAnimationId, playback);
    });
  };

  const editRenameAnimation = async (nextId: string): Promise<boolean> => {
    if (!activeAnimationId) return false;
    const ok = await mutate(async (workspace) => {
      await workspace.renameAnimation(activeAnimationId, nextId);
    });
    if (ok) setPlayingAnimationId(nextId);
    return ok;
  };

  const editAddFrame = async (sprite: string, durationMs: number, at?: number): Promise<void> => {
    if (!activeAnimationId) return;
    await mutate(async (workspace) => {
      await workspace.addFrame(activeAnimationId, sprite, durationMs, at);
    });
  };

  const editSetFrameDuration = async (at: number, durationMs: number): Promise<void> => {
    if (!activeAnimationId) return;
    await mutate(async (workspace) => {
      await workspace.setFrame(activeAnimationId, at, undefined, durationMs);
    });
  };

  const editMoveFrame = async (from: number, to: number): Promise<void> => {
    if (!activeAnimationId) return;
    await mutate(async (workspace) => {
      await workspace.moveFrame(activeAnimationId, from, to);
    });
  };

  const editDuplicateFrame = async (at: number): Promise<void> => {
    const animation = activeAnimationId ? animations[activeAnimationId] : undefined;
    const frame = animation?.frames[at];
    if (!activeAnimationId || !frame) return;
    await mutate(async (workspace) => {
      await workspace.addFrame(activeAnimationId, frame.sprite, frame.durationMs, at + 1);
    });
  };

  const editRemoveFrame = async (at: number): Promise<void> => {
    if (!activeAnimationId) return;
    const confirmed = await askConfirmation(
      'Eliminar frame',
      `Se eliminará el frame ${at} de ${activeAnimationId}.`,
    );
    if (!confirmed) return;
    await mutate(async (workspace) => {
      await workspace.removeFrame(activeAnimationId, at);
    });
  };

  const submitNewAnimation = async (
    id: string,
    playback: 'loop' | 'once',
    frames: readonly AnimationFrameInput[],
  ): Promise<boolean> => {
    const ok = await mutate(async (workspace) => {
      await workspace.addAnimation(path, id, playback);
      for (const frame of frames) {
        await workspace.addFrame(id, frame.sprite, frame.durationMs);
      }
    });
    if (ok) {
      toast.success(`Animación creada: ${id}`);
      setPlayingAnimationId(id);
    }
    return ok;
  };

  return (
    <div className="board-body">
      {activeAnimation && activeAnimationId ? (
        <AnimationPlayer
          root={root}
          path={path}
          animationId={activeAnimationId}
          animation={activeAnimation}
          sprites={sprites}
          busy={busy}
          onBack={() => setPlayingAnimationId(null)}
          onRename={editRenameAnimation}
          onSetPlayback={(playback) => void editSetPlayback(playback)}
          onAddFrame={(sprite, durationMs, at) => void editAddFrame(sprite, durationMs, at)}
          onSetFrameDuration={(at, durationMs) => void editSetFrameDuration(at, durationMs)}
          onMoveFrame={(from, to) => void editMoveFrame(from, to)}
          onDuplicateFrame={(at) => void editDuplicateFrame(at)}
          onRemoveFrame={(at) => void editRemoveFrame(at)}
        />
      ) : (
        <div className="board-stage">
          <header className="board-header">
            <span className="board-path mono" title={path}>
              {path}
            </span>
            {image ? (
              <span className="board-dims">
                {image.width}×{image.height}
              </span>
            ) : null}
            {imageLoading ? (
              <PixelSpinner width={24} height={24} aria-label="Cargando imagen" />
            ) : null}
            <div className="zoom-controls">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Alejar"
                    onClick={() => stepZoom(-1)}
                  >
                    <ZoomOut width={24} height={24} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Alejar</TooltipContent>
              </Tooltip>
              <span className="zoom-value mono">{viewport.zoom}×</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Acercar"
                    onClick={() => stepZoom(1)}
                  >
                    <ZoomIn width={24} height={24} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Acercar</TooltipContent>
              </Tooltip>
              <Button size="sm" onClick={() => fitViewport(image)}>
                <Expand width={24} height={24} /> Ajustar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!image) return;
                  setViewport({
                    zoom: 1,
                    offset: centeredOffset(
                      { width: image.width, height: image.height },
                      stageSize,
                      1,
                    ),
                  });
                }}
              >
                100%
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Recargar imagen"
                    onClick={reloadImage}
                  >
                    <Reload width={24} height={24} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recargar la imagen desde el disco</TooltipContent>
              </Tooltip>
            </div>
          </header>

          <div
            className="board-canvas"
            tabIndex={0}
            onKeyDown={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('input, textarea, select') !== null) return;
              if (event.key === 'Escape') {
                if (drawMode) {
                  setDrawMode(false);
                  setDrawRect(null);
                }
                dragRef.current = null;
                return;
              }
              if (!draftRef.current) return;
              const step = event.shiftKey ? 8 : 1;
              if (event.key === 'ArrowLeft') nudge(-step, 0);
              else if (event.key === 'ArrowRight') nudge(step, 0);
              else if (event.key === 'ArrowUp') nudge(0, -step);
              else if (event.key === 'ArrowDown') nudge(0, step);
              else return;
              event.preventDefault();
            }}
          >
            {imageError ? (
              <div className="board-image-error">
                <EyeOff width={32} height={32} />
                <p>{imageError}</p>
                <Button size="sm" onClick={reloadImage}>
                  Reintentar
                </Button>
              </div>
            ) : (
              <PixelCanvas
                image={image}
                zoom={viewport.zoom}
                offset={viewport.offset}
                items={items}
                drawPreview={drawRect}
                cursor={drawMode ? 'crosshair' : cursorStyle}
                onChangeViewport={(zoom, offset) => setViewport({ zoom, offset })}
                onViewportResize={onViewportResize}
                onPointer={handlePointer}
              />
            )}
            {drawMode ? (
              <div className="draw-hint">
                <Pencil width={20} height={20} /> Arrastra para dibujar la región · Esc para
                cancelar
              </div>
            ) : null}
          </div>

          <footer className="board-footer">
            <span className="side-hint">
              Rueda: zoom · Espacio o botón central: mover vista · Flechas: ajuste fino
            </span>
            <div className="board-footer-meta">
              <span className="board-cursor mono">
                {cursor ? `x: ${Math.floor(cursor.x)} · y: ${Math.floor(cursor.y)}` : '—'}
              </span>
              {imageLoading ? <span className="side-hint">Cargando imagen…</span> : null}
            </div>
          </footer>
        </div>
      )}

      <aside className="board-sidebar">
        <SpritePanel
          sprites={sprites}
          spriteIds={spriteIds}
          selectedId={activeSelectedId}
          hoveredId={hoveredId}
          busy={busy}
          onSelect={(id) => {
            selectSprite(id);
            setEditingId(id);
          }}
          onHover={setHoveredId}
          onNew={() => setNewSprite({ rect: null })}
          onDuplicate={(id) => setDuplicateOf(id)}
          onDelete={(id) => void deleteSprite(id)}
        />
        <AnimationPanel
          animations={animations}
          animationIds={animationIds}
          activeId={activeAnimationId}
          busy={busy}
          onOpen={(id) => setPlayingAnimationId(id)}
          onNew={() => setNewAnimationOpen(true)}
          onDelete={(id) => void deleteAnimation(id)}
          onTogglePlayback={(id) => void togglePlayback(id)}
        />
      </aside>

      {newSprite ? (
        <NewSpriteDialog
          initialRect={newSprite.rect}
          imageWidth={bounds.width}
          imageHeight={bounds.height}
          onRequestDraw={() => {
            setNewSprite(null);
            setDrawMode(true);
          }}
          onSubmit={submitNewSprite}
          onClose={() => setNewSprite(null)}
        />
      ) : null}

      {activeEditingId ? (
        <EditSpriteDialog
          spriteId={activeEditingId}
          sprite={sprites[activeEditingId]!}
          imageWidth={bounds.width}
          imageHeight={bounds.height}
          busy={busy}
          onSubmit={async (values) => {
            const target = activeEditingId;
            const ok = await commitDraft({
              originalId: target,
              id: values.id,
              rect: values.rect,
              pivot: values.pivot,
            });
            if (ok) setEditingId(null);
            return ok;
          }}
          onClose={() => setEditingId(null)}
        />
      ) : null}

      {duplicateOf ? (
        <DuplicateSpriteDialog
          from={duplicateOf}
          onClose={() => setDuplicateOf(null)}
          onSubmit={async (id) => {
            const ok = await mutate((workspace) => workspace.duplicateSprite(duplicateOf, id));
            if (ok) {
              toast.success(`Sprite duplicado: ${id}`);
              setDuplicateOf(null);
            }
            return ok;
          }}
        />
      ) : null}

      {newAnimationOpen ? (
        <NewAnimationDialog
          sprites={sprites}
          spriteIds={spriteIds}
          onSubmit={submitNewAnimation}
          onClose={() => setNewAnimationOpen(false)}
        />
      ) : null}
    </div>
  );
}

interface DuplicateSpriteDialogProps {
  readonly from: string;
  readonly onClose: () => void;
  readonly onSubmit: (id: string) => Promise<boolean>;
}

function DuplicateSpriteDialog({ from, onClose, onSubmit }: DuplicateSpriteDialogProps) {
  const [id, setId] = useState(`${from}_copy`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      assertIdentifier(id);
    } catch (caught) {
      setError(caught instanceof PipelineError ? caught.message : String(caught));
      return;
    }
    setBusy(true);
    const ok = await onSubmit(id);
    setBusy(false);
    if (!ok) setError('No se pudo duplicar (revisa el aviso de error).');
  };

  return (
    <Modal
      title={`Duplicar ${from}`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Duplicando…' : 'Duplicar'}
          </Button>
        </>
      }
    >
      <Field label="ID del nuevo sprite">
        <Input
          className="mono"
          value={id}
          autoFocus
          onChange={(event) => setId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
        />
      </Field>
      {error ? <p className="form-error">{error}</p> : null}
    </Modal>
  );
}
