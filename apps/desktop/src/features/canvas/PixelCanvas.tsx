import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point, Rect } from './sprite-editor.js';
import { clamp, screenToImage } from './sprite-editor.js';

export interface OverlayItem {
  readonly id: string;
  readonly rect: Rect;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly pivot: Point | null;
}

export interface PointerInfo {
  readonly image: Point;
  readonly button: number;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly ctrl: boolean;
}

export type PointerPhase = 'down' | 'move' | 'up' | 'leave';

interface PixelCanvasProps {
  readonly image: ImageBitmap | null;
  readonly zoom: number;
  readonly offset: Point;
  readonly items: readonly OverlayItem[];
  readonly drawPreview: Rect | null;
  readonly cursor: string;
  readonly onChangeViewport: (zoom: number, offset: Point) => void;
  readonly onViewportResize: (size: { width: number; height: number }) => void;
  readonly onPointer: (phase: PointerPhase, info: PointerInfo) => void;
}

export function PixelCanvas({
  image,
  zoom,
  offset,
  items,
  drawPreview,
  cursor,
  onChangeViewport,
  onViewportResize,
  onPointer,
}: PixelCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const panRef = useRef<{ pointerId: number; start: Point } | null>(null);
  const spaceRef = useRef(false);
  const viewportRef = useRef({ zoom, offset });
  viewportRef.current = { zoom, offset };

  // Track the container size so the canvas matches the layout.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = {
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      };
      setSize(next);
      onViewportResize(next);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [onViewportResize]);

  // Space temporarily enables panning.
  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        spaceRef.current = true;
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent): void => {
      if (event.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Wheel zooms at the cursor keeping the pixel under it anchored.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      const { zoom: currentZoom, offset: currentOffset } = viewportRef.current;
      const factor = event.deltaY < 0 ? 1.5 : 1 / 1.5;
      const nextZoom = clamp(Math.round(currentZoom * factor), 1, 32);
      if (nextZoom === currentZoom) return;
      const rect = overlay.getBoundingClientRect();
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const nextOffset = {
        x: screen.x - ((screen.x - currentOffset.x) / currentZoom) * nextZoom,
        y: screen.y - ((screen.y - currentOffset.y) / currentZoom) * nextZoom,
      };
      onChangeViewport(nextZoom, nextOffset);
    };
    overlay.addEventListener('wheel', wheel, { passive: false });
    return () => overlay.removeEventListener('wheel', wheel);
  }, [onChangeViewport]);

  // Redraw the image and the overlay.
  useEffect(() => {
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!base || !overlay || size.width === 0 || size.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    for (const canvas of [base, overlay]) {
      const width = Math.round(size.width * dpr);
      const height = Math.round(size.height * dpr);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    }

    const baseContext = base.getContext('2d');
    if (!baseContext) return;
    baseContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseContext.clearRect(0, 0, size.width, size.height);
    if (image) {
      baseContext.imageSmoothingEnabled = false;
      baseContext.save();
      baseContext.translate(offset.x, offset.y);
      baseContext.scale(zoom, zoom);
      baseContext.drawImage(image, 0, 0);
      baseContext.restore();
    }

    const context = overlay.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.lineWidth = 1;

    const drawRect = (rect: Rect, color: string, lineWidth: number): void => {
      context.lineWidth = lineWidth;
      context.strokeStyle = color;
      const x = Math.round(offset.x + rect.x * zoom);
      const y = Math.round(offset.y + rect.y * zoom);
      const width = Math.max(Math.round(rect.width * zoom), 1);
      const height = Math.max(Math.round(rect.height * zoom), 1);
      context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    };

    const ordered = [...items].sort((left, right) => {
      const rank = (item: OverlayItem): number => (item.selected ? 2 : item.hovered ? 1 : 0);
      return rank(left) - rank(right);
    });
    for (const item of ordered) {
      if (item.selected) {
        drawRect(item.rect, 'rgba(155, 215, 156, 0.95)', 2);
      } else if (item.hovered) {
        drawRect(item.rect, 'rgba(221, 192, 122, 0.9)', 2);
      } else {
        drawRect(item.rect, 'rgba(155, 215, 156, 0.35)', 1);
      }
    }

    if (drawPreview) {
      context.setLineDash([6, 4]);
      drawRect(drawPreview, 'rgba(138, 182, 224, 0.95)', 2);
      context.setLineDash([]);
    }

    const selected = items.find((item) => item.selected);
    if (selected) {
      const handleSize = 8;
      const corners: readonly Point[] = [
        { x: selected.rect.x, y: selected.rect.y },
        { x: selected.rect.x + selected.rect.width, y: selected.rect.y },
        { x: selected.rect.x, y: selected.rect.y + selected.rect.height },
        {
          x: selected.rect.x + selected.rect.width,
          y: selected.rect.y + selected.rect.height,
        },
      ];
      context.fillStyle = '#f4f6f5';
      context.strokeStyle = '#101312';
      for (const corner of corners) {
        const x = offset.x + corner.x * zoom;
        const y = offset.y + corner.y * zoom;
        context.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        context.strokeRect(
          x - handleSize / 2 - 0.5,
          y - handleSize / 2 - 0.5,
          handleSize + 1,
          handleSize + 1,
        );
      }
      if (selected.pivot) {
        const x = Math.round(offset.x + selected.pivot.x * zoom) + 0.5;
        const y = Math.round(offset.y + selected.pivot.y * zoom) + 0.5;
        context.strokeStyle = '#f2c14e';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(x - 7, y);
        context.lineTo(x + 7, y);
        context.moveTo(x, y - 7);
        context.lineTo(x, y + 7);
        context.stroke();
        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }, [drawPreview, image, items, offset, size, zoom]);

  const toImage = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = event.currentTarget.getBoundingClientRect();
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      return screenToImage(screen, viewportRef.current.offset, viewportRef.current.zoom);
    },
    [],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const panning = event.button === 1 || (event.button === 0 && spaceRef.current);
    if (panning) {
      const rect = event.currentTarget.getBoundingClientRect();
      panRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      };
      return;
    }
    onPointer('down', {
      image: toImage(event),
      button: event.button,
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey || event.metaKey,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      const rect = event.currentTarget.getBoundingClientRect();
      const current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const { zoom: currentZoom, offset: currentOffset } = viewportRef.current;
      onChangeViewport(currentZoom, {
        x: currentOffset.x + (current.x - pan.start.x),
        y: currentOffset.y + (current.y - pan.start.y),
      });
      pan.start = current;
      return;
    }
    onPointer('move', {
      image: toImage(event),
      button: event.button,
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey || event.metaKey,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      return;
    }
    onPointer('up', {
      image: toImage(event),
      button: event.button,
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey || event.metaKey,
    });
  };

  return (
    <div className="pixel-canvas" ref={wrapperRef}>
      <canvas className="pixel-canvas-layer" ref={baseRef} style={{ cursor }} />
      <canvas
        ref={overlayRef}
        className="pixel-canvas-layer pixel-canvas-overlay"
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => onPointer('leave', {
          image: { x: 0, y: 0 },
          button: 0,
          shift: false,
          alt: false,
          ctrl: false,
        })}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  );
}
