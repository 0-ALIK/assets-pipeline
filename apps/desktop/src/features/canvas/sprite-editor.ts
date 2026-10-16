export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Pivot {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CanvasBounds {
  readonly width: number;
  readonly height: number;
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Keeps a rectangle inside the canvas with at least a 1x1 size. */
export function clampRect(rect: Rect, bounds: CanvasBounds): Rect {
  const width = clamp(Math.round(rect.width), 1, bounds.width);
  const height = clamp(Math.round(rect.height), 1, bounds.height);
  const x = clamp(Math.round(rect.x), 0, bounds.width - width);
  const y = clamp(Math.round(rect.y), 0, bounds.height - height);
  return { x, y, width, height };
}

export function moveRect(rect: Rect, dx: number, dy: number, bounds: CanvasBounds): Rect {
  return clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, bounds);
}

/** Resizes from a corner while keeping the opposite corner anchored. */
export function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  bounds: CanvasBounds,
): Rect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  if (handle === 'nw' || handle === 'sw') left += dx;
  if (handle === 'ne' || handle === 'se') right += dx;
  if (handle === 'nw' || handle === 'ne') top += dy;
  if (handle === 'sw' || handle === 'se') bottom += dy;
  left = clamp(Math.round(left), 0, right - 1);
  top = clamp(Math.round(top), 0, bottom - 1);
  right = clamp(Math.round(right), left + 1, bounds.width);
  bottom = clamp(Math.round(bottom), top + 1, bounds.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Builds a rectangle from a drag between two image points (new sprite mode). */
export function rectFromDrag(start: Point, end: Point, bounds: CanvasBounds): Rect {
  const x = clamp(Math.round(Math.min(start.x, end.x)), 0, bounds.width - 1);
  const y = clamp(Math.round(Math.min(start.y, end.y)), 0, bounds.height - 1);
  const right = clamp(Math.round(Math.max(start.x, end.x)), x + 1, bounds.width);
  const bottom = clamp(Math.round(Math.max(start.y, end.y)), y + 1, bounds.height);
  return { x, y, width: right - x, height: bottom - y };
}

export function pivotFromPoint(point: Point, rect: Rect): Pivot {
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  return {
    x: clamp(round((point.x - rect.x) / rect.width), 0, 1),
    y: clamp(round((point.y - rect.y) / rect.height), 0, 1),
  };
}

export function pivotPosition(rect: Rect, pivot: Pivot): Point {
  return { x: rect.x + rect.width * pivot.x, y: rect.y + rect.height * pivot.y };
}

export function rectContains(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

export function withinTolerance(left: Point, right: Point, tolerance: number): boolean {
  return Math.abs(left.x - right.x) <= tolerance && Math.abs(left.y - right.y) <= tolerance;
}

export function handleAtPoint(point: Point, rect: Rect, tolerance: number): ResizeHandle | null {
  const corners: ReadonlyArray<readonly [ResizeHandle, Point]> = [
    ['nw', { x: rect.x, y: rect.y }],
    ['ne', { x: rect.x + rect.width, y: rect.y }],
    ['sw', { x: rect.x, y: rect.y + rect.height }],
    ['se', { x: rect.x + rect.width, y: rect.y + rect.height }],
  ];
  for (const [handle, corner] of corners) {
    if (withinTolerance(point, corner, tolerance)) return handle;
  }
  return null;
}

export function screenToImage(screen: Point, offset: Point, zoom: number): Point {
  return { x: (screen.x - offset.x) / zoom, y: (screen.y - offset.y) / zoom };
}

export function imageToScreen(point: Point, offset: Point, zoom: number): Point {
  return { x: point.x * zoom + offset.x, y: point.y * zoom + offset.y };
}

export function fitZoom(
  bounds: CanvasBounds,
  viewport: { readonly width: number; readonly height: number },
  padding = 32,
): number {
  const availableWidth = Math.max(viewport.width - padding, 1);
  const availableHeight = Math.max(viewport.height - padding, 1);
  const zoom = Math.floor(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
  );
  return clamp(zoom, 1, 16);
}

/** Centers the image inside the viewport for a given zoom. */
export function centeredOffset(
  bounds: CanvasBounds,
  viewport: { readonly width: number; readonly height: number },
  zoom: number,
): Point {
  return {
    x: Math.round((viewport.width - bounds.width * zoom) / 2),
    y: Math.round((viewport.height - bounds.height * zoom) / 2),
  };
}
