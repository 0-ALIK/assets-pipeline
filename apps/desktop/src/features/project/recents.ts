export interface RecentProject {
  readonly name: string;
  readonly root: string;
  readonly lastOpenedAt: string;
}

const storageKey = 'assets-pipeline.recent-projects';
const maxRecents = 12;

/** Pure merge used by the launcher and covered by unit tests. */
export function mergeRecent(
  recents: readonly RecentProject[],
  project: { name: string; root: string; lastOpenedAt: string },
): RecentProject[] {
  const normalized = project.root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const others = recents.filter(
    (entry) => entry.root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() !== normalized,
  );
  return [project, ...others].slice(0, maxRecents);
}

export function readRecents(): readonly RecentProject[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentProject =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentProject).name === 'string' &&
        typeof (entry as RecentProject).root === 'string' &&
        typeof (entry as RecentProject).lastOpenedAt === 'string',
    );
  } catch {
    return [];
  }
}

function writeRecents(recents: readonly RecentProject[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(recents));
  } catch {
    // Recent projects are a convenience; failing to persist must not break the app.
  }
}

export function rememberProject(name: string, root: string): readonly RecentProject[] {
  const recents = mergeRecent(readRecents(), {
    name,
    root,
    lastOpenedAt: new Date().toISOString(),
  });
  writeRecents(recents);
  return recents;
}

export function forgetProject(root: string): readonly RecentProject[] {
  const normalized = root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const recents = readRecents().filter(
    (entry) => entry.root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() !== normalized,
  );
  writeRecents(recents);
  return recents;
}
