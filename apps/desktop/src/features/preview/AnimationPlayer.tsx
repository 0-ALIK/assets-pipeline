import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pause, Pencil, Play, RotateCcw } from 'lucide-react';
import type { AnimationDefinition, SpriteDefinition } from '@assets-pipeline/core';
import { useSourceImage } from '../canvas/useSourceImage.js';
import { AddFrameDialog } from './AddFrameDialog.js';
import { FrameStrip } from './FrameStrip.js';
import { RenameAnimationDialog } from './RenameAnimationDialog.js';
import { findFrameAt, layoutAnimationFrames, totalDuration } from './pivot-math.js';

interface AnimationPlayerProps {
  readonly root: string;
  readonly path: string;
  readonly animationId: string;
  readonly animation: AnimationDefinition;
  readonly sprites: Readonly<Record<string, SpriteDefinition>>;
  readonly busy: boolean;
  readonly onBack: () => void;
  readonly onRename: (id: string) => Promise<boolean>;
  readonly onSetPlayback: (playback: 'loop' | 'once') => void;
  readonly onAddFrame: (sprite: string, durationMs: number, at?: number) => void;
  readonly onSetFrameDuration: (at: number, durationMs: number) => void;
  readonly onMoveFrame: (from: number, to: number) => void;
  readonly onDuplicateFrame: (at: number) => void;
  readonly onRemoveFrame: (at: number) => void;
}

export function AnimationPlayer({
  root,
  path,
  animationId,
  animation,
  sprites,
  busy,
  onBack,
  onRename,
  onSetPlayback,
  onAddFrame,
  onSetFrameDuration,
  onMoveFrame,
  onDuplicateFrame,
  onRemoveFrame,
}: AnimationPlayerProps) {
  const { image, error } = useSourceImage(root, path);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [crops, setCrops] = useState<ReadonlyMap<string, ImageBitmap>>(new Map());
  const [renameOpen, setRenameOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<number | 'end' | null>(null);
  const elapsedRef = useRef(0);
  const indexRef = useRef(0);

  const frames = animation.frames;
  const spriteIds = useMemo(
    () => Object.keys(sprites).sort((left, right) => left.localeCompare(right)),
    [sprites],
  );
  const layout = useMemo(
    () =>
      layoutAnimationFrames(
        frames.map((frame) => {
          const sprite = sprites[frame.sprite];
          return {
            width: sprite?.width ?? 0,
            height: sprite?.height ?? 0,
            pivot: sprite?.pivot ?? { x: 0, y: 0 },
          };
        }),
      ),
    [frames, sprites],
  );
  const total = useMemo(() => totalDuration(frames), [frames]);

  // Crop one bitmap per distinct sprite in the animation. Bitmaps are only
  // closed on unmount so the redraw effect never draws a closed bitmap.
  const allCropsRef = useRef<ImageBitmap[]>([]);
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    void (async () => {
      const next = new Map<string, ImageBitmap>();
      for (const frame of frames) {
        const sprite = sprites[frame.sprite];
        if (!sprite || next.has(frame.sprite)) continue;
        const bitmap = await createImageBitmap(
          image,
          sprite.x,
          sprite.y,
          sprite.width,
          sprite.height,
        );
        allCropsRef.current.push(bitmap);
        next.set(frame.sprite, bitmap);
      }
      if (!cancelled) setCrops(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [frames, image, sprites]);

  useEffect(() => {
    return () => {
      for (const bitmap of allCropsRef.current) bitmap.close();
      allCropsRef.current = [];
    };
  }, []);

  // Restart playback when the animation changes.
  useEffect(() => {
    elapsedRef.current = 0;
    indexRef.current = 0;
    setFrameIndex(0);
    setPlaying(true);
  }, [animationId]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Playback clock.
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      elapsedRef.current += now - last;
      last = now;
      const result = findFrameAt(frames, elapsedRef.current, animation.playback === 'loop');
      if (result.index !== indexRef.current) {
        indexRef.current = result.index;
        setFrameIndex(result.index);
      }
      if (result.finished) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animation.playback, frames, playing]);

  const safeIndex = Math.max(0, Math.min(frameIndex, frames.length - 1));

  // Redraw the composition whenever the frame, crops or size change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(size.width * dpr);
    const height = Math.round(size.height * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    const frame = frames[safeIndex];
    if (!frame || layout.width === 0 || layout.height === 0) return;
    const zoom = Math.max(
      1,
      Math.min(
        16,
        Math.floor(Math.min((size.width - 48) / layout.width, (size.height - 48) / layout.height)),
      ),
    );
    const originX = Math.round((size.width - layout.width * zoom) / 2);
    const originY = Math.round((size.height - layout.height * zoom) / 2);
    const offset = layout.offsets[safeIndex];
    const crop = crops.get(frame.sprite);
    if (crop && offset) {
      context.imageSmoothingEnabled = false;
      context.drawImage(
        crop,
        originX + offset.x * zoom,
        originY + offset.y * zoom,
        crop.width * zoom,
        crop.height * zoom,
      );
    }

    // Shared pivot marker so misaligned frames are easy to spot.
    const pivotX = originX + layout.pivot.x * zoom + 0.5;
    const pivotY = originY + layout.pivot.y * zoom + 0.5;
    context.strokeStyle = 'rgba(242, 193, 78, 0.85)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(pivotX - 6, pivotY);
    context.lineTo(pivotX + 6, pivotY);
    context.moveTo(pivotX, pivotY - 6);
    context.lineTo(pivotX, pivotY + 6);
    context.stroke();
  }, [crops, frames, layout, safeIndex, size]);

  const selectFrame = (index: number): void => {
    elapsedRef.current = frames.slice(0, index).reduce((sum, item) => sum + item.durationMs, 0);
    indexRef.current = index;
    setFrameIndex(index);
    setPlaying(false);
  };

  const restart = (): void => {
    elapsedRef.current = 0;
    indexRef.current = 0;
    setFrameIndex(0);
    setPlaying(true);
  };

  const defaultDuration = frames[frames.length - 1]?.durationMs ?? 100;

  return (
    <div className="player">
      <header className="player-header">
        <button type="button" className="btn btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Volver al archivo
        </button>
        <span className="player-title mono" title={animationId}>
          {animationId}
        </span>
        <button
          type="button"
          className="btn btn-icon btn-sm"
          title="Renombrar animación"
          aria-label="Renombrar animación"
          disabled={busy}
          onClick={() => setRenameOpen(true)}
        >
          <Pencil size={13} />
        </button>
        <span className="player-meta">
          {frames.length} frames · {total} ms
        </span>
        <select
          className="select player-playback"
          value={animation.playback}
          disabled={busy}
          title="Modo de reproducción"
          onChange={(event) => onSetPlayback(event.target.value === 'once' ? 'once' : 'loop')}
        >
          <option value="loop">loop</option>
          <option value="once">once</option>
        </select>
        <div className="player-controls">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setPlaying((current) => !current)}
            disabled={
              frames.length === 0 ||
              (!playing && elapsedRef.current >= total && animation.playback === 'once')
            }
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? 'Pausar' : 'Reproducir'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={restart}
            disabled={frames.length === 0}
          >
            <RotateCcw size={14} /> Reiniciar
          </button>
        </div>
      </header>

      <div className="player-canvas" ref={wrapperRef}>
        {error ? <p className="form-error">{error}</p> : null}
        <canvas ref={canvasRef} className="player-layer" />
        <div className="player-frame-label">
          Frame {Math.min(safeIndex + 1, Math.max(frames.length, 1))}/{frames.length}
        </div>
      </div>

      <FrameStrip
        frames={frames}
        currentIndex={safeIndex}
        busy={busy}
        onSelect={selectFrame}
        onDuration={(index, durationMs) => onSetFrameDuration(index, durationMs)}
        onMove={(from, to) => onMoveFrame(from, to)}
        onDuplicate={(index) => onDuplicateFrame(index)}
        onRemove={(index) => onRemoveFrame(index)}
        onInsertBefore={(index) => setAddTarget(index)}
        onAppend={() => setAddTarget('end')}
      />

      {renameOpen ? (
        <RenameAnimationDialog
          currentId={animationId}
          busy={busy}
          onRename={onRename}
          onClose={() => setRenameOpen(false)}
        />
      ) : null}

      {addTarget !== null ? (
        <AddFrameDialog
          sprites={sprites}
          spriteIds={spriteIds}
          insertAt={addTarget === 'end' ? null : addTarget}
          defaultDuration={defaultDuration}
          busy={busy}
          onPick={(sprite, durationMs) =>
            onAddFrame(sprite, durationMs, addTarget === 'end' ? undefined : addTarget)
          }
          onClose={() => setAddTarget(null)}
        />
      ) : null}
    </div>
  );
}
