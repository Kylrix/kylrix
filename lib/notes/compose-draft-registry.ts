const globalAny = typeof globalThis !== 'undefined' ? (globalThis as any) : (window as any);
if (!globalAny.__unpersistedDraftIds) {
  globalAny.__unpersistedDraftIds = new Set<string>();
}
if (!globalAny.__persistedRemoteIds) {
  globalAny.__persistedRemoteIds = new Set<string>();
}
const unpersistedDraftIds: Set<string> = globalAny.__unpersistedDraftIds;
const persistedRemoteIds: Set<string> = globalAny.__persistedRemoteIds;

const PERSISTED_SESSION_KEY = 'kylrix:compose:persisted';
const persistLocks = new Map<string, Promise<unknown>>();


function readPersistedSessionIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(PERSISTED_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writePersistedSessionId(noteId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = new Set(readPersistedSessionIds());
    existing.add(noteId);
    sessionStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify([...existing]));
  } catch {
    // ignore quota errors
  }
}

function hydratePersistedRemoteIds(): void {
  for (const id of readPersistedSessionIds()) {
    persistedRemoteIds.add(id);
    // Do NOT clear unpersistedDraftIds — "has remote row" ≠ "no local pending edits".
  }
}

if (typeof window !== 'undefined') {
  hydratePersistedRemoteIds();
}

export function markComposeDraft(noteId: string): boolean {
  const id = String(noteId || '').trim();
  if (!id) return false;
  if (unpersistedDraftIds.has(id)) return false;
  unpersistedDraftIds.add(id);
  return true;
}

export function markComposePersisted(noteId: string): boolean {
  const id = String(noteId || '').trim();
  if (!id) return false;
  if (!unpersistedDraftIds.has(id)) return false;
  unpersistedDraftIds.delete(id);
  return true;
}

/**
 * Mark that Appwrite has a row for this ID (create-vs-update gate only).
 * Never clears pending — that is unregisterComposeSession / markComposePersisted only.
 */
export function markNotePersistedRemote(noteId: string): void {
  const id = String(noteId || '').trim();
  if (!id) return;
  persistedRemoteIds.add(id);
  writePersistedSessionId(id);
}

function isNotePersistedRemote(noteId?: string | null): boolean {
  const id = String(noteId || '').trim();
  if (!id) return false;
  if (persistedRemoteIds.has(id)) return true;
  if (typeof window !== 'undefined') {
    const sessionIds = readPersistedSessionIds();
    if (sessionIds.includes(id)) {
      persistedRemoteIds.add(id);
      // Keep unpersistedDraftIds intact — a remote row can still have pending local edits.
      return true;
    }
  }
  return false;
}

export function isUnpersistedComposeDraft(noteId?: string | null): boolean {
  const id = String(noteId || '').trim();
  if (!id) return false;
  // Pending local edits (including edits to already-remote rows) live in this set.
  // Do NOT short-circuit on isNotePersistedRemote — that only gates create vs update.
  return unpersistedDraftIds.has(id);
}

/** Snapshot of client-only pending ids for the sync engine (never sent to Appwrite). */

/** Whether the next save should call create (vs update) for this compose note ID. */
export function shouldCreateComposeNote(noteId?: string | null): boolean {
  const id = String(noteId || '').trim();
  if (!id) return true;
  if (id.startsWith('live-') || id.startsWith('thread-')) return true;
  if (isNotePersistedRemote(id)) return false;
  return isUnpersistedComposeDraft(id);
}

/** Legacy live-* drafts plus unpersisted Appwrite-format compose IDs (local-only delete). */
export function isEphemeralComposeNoteId(noteId?: string | null): boolean {
  const id = String(noteId || '').trim();
  if (!id) return false;
  if (id.startsWith('live-') || id.startsWith('thread-')) return true;
  return isUnpersistedComposeDraft(id) && !isNotePersistedRemote(id);
}

export function isAlreadyExistsAppwriteError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || error || '').toLowerCase();
  return message.includes('already exists') || message.includes('duplicate');
}

/** Serialize persist operations per note ID to prevent parallel create races. */
export async function withNotePersistLock<T>(noteId: string, fn: () => Promise<T>): Promise<T> {
  const id = String(noteId || '').trim();
  if (!id) return fn();

  const previous = persistLocks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const run = previous
    .catch(() => undefined)
    .then(() => gate)
    .then(fn)
    .finally(() => release());

  persistLocks.set(id, run);
  try {
    return await run;
  } finally {
    if (persistLocks.get(id) === run) {
      persistLocks.delete(id);
    }
  }
}
