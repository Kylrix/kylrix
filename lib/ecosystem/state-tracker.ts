export const STATE_STORAGE_KEY = 'kylrix_ecosystem_state_tracker';
const MAX_HISTORY = 15;

export interface RouteState {
  path: string;
  scrollY: number;
  timestamp: number;
}

export function saveEcosystemState(path: string, scrollY: number) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    let history: RouteState[] = raw ? JSON.parse(raw) : [];

    // Filter out duplicates of the same path
    history = history.filter(s => s.path !== path);

    // Unshift the new state
    history.unshift({ path, scrollY, timestamp: Date.now() });

    // Truncate to max history
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }

    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore quota errors
  }
}

export function getLastEcosystemRoute(): RouteState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return null;
    const history: RouteState[] = JSON.parse(raw);
    return history.length > 0 ? history[0] : null;
  } catch {
    return null;
  }
}
