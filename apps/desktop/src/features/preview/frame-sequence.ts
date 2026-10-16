/** Moves an item inside a list, returning the original list when nothing changes. */
export function moveItem<T>(list: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return list;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
