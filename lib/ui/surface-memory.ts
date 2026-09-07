/**
 * Cross-surface UI memory (LocalEngine-first).
 * Mirrors native sidebar memory: instant local restore, optional later remote sync.
 * Hard size caps so payloads stay cross-platform safe.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';

export const SURFACE_MEMORY_KEY = (userId: string) => `f_surface_memory_${userId}`;

/** Soft ceiling for the whole document (~48KB UTF-16-ish). */
export const SURFACE_MEMORY_MAX_BYTES = 48_000;
export const SURFACE_DRAFT_MAX_CHARS = 8_000;
export const SURFACE_MAX_DRAFTS = 48;
export const SURFACE_MAX_SCROLLS = 64;
export const SURFACE_MAX_ACTIVE = 24;

export type SurfaceDraftEntry = {
  text: string;
  updatedAt: number;
  /** Optional tiny meta (ids only — no blobs). */
  meta?: Record<string, string | number | boolean | null>;
};

export type SurfaceScrollEntry = {
  top: number;
  left?: number;
  updatedAt: number;
};

export type SurfaceActiveEntry = {
  /** e.g. unified:moments | unified:moment-composer | rail:native | hangouts */
  kind: string;
  /** Stable discriminator — parent moment id, chat id, etc. */
  id?: string | null;
  route?: string | null;
  updatedAt: number;
  meta?: Record<string, string | number | boolean | null>;
};

export type SurfaceMemoryDoc = {
  version: 1;
  drafts: Record<string, SurfaceDraftEntry>;
  scrolls: Record<string, SurfaceScrollEntry>;
  active: Record<string, SurfaceActiveEntry>;
  updatedAt: number;
};

export function emptySurfaceMemory(): SurfaceMemoryDoc {
  return { version: 1, drafts: {}, scrolls: {}, active: {}, updatedAt: Date.now() };
}

/** Moment create = one global draft; reply drafts are per parent moment. */
export function momentDraftScope(opts: {
  userId: string;
  mode: 'create' | 'reply';
  parentMomentId?: string | null;
}): string {
  const uid = opts.userId || 'anon';
  if (opts.mode === 'reply') {
    const parent = String(opts.parentMomentId || '').trim() || 'unknown';
    return `draft:moment:reply:${uid}:${parent}`;
  }
  return `draft:moment:create:${uid}`;
}

export function scrollScope(kind: string, id?: string | null): string {
  return `scroll:${kind}${id ? `:${id}` : ''}`;
}

export function activeScope(kind: string): string {
  return `active:${kind}`;
}

function approxBytes(doc: SurfaceMemoryDoc): number {
  try {
    return JSON.stringify(doc).length * 2;
  } catch {
    return SURFACE_MEMORY_MAX_BYTES + 1;
  }
}

function pruneDoc(doc: SurfaceMemoryDoc): SurfaceMemoryDoc {
  const next: SurfaceMemoryDoc = {
    version: 1,
    drafts: { ...doc.drafts },
    scrolls: { ...doc.scrolls },
    active: { ...doc.active },
    updatedAt: Date.now(),
  };

  const trimMap = <T extends { updatedAt: number }>(
    map: Record<string, T>,
    max: number,
  ): Record<string, T> => {
    const entries = Object.entries(map).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    const kept = entries.slice(0, max);
    return Object.fromEntries(kept);
  };

  for (const [k, d] of Object.entries(next.drafts)) {
    const text = String(d.text || '').slice(0, SURFACE_DRAFT_MAX_CHARS);
    if (!text.trim()) {
      delete next.drafts[k];
      continue;
    }
    next.drafts[k] = { ...d, text };
  }

  next.drafts = trimMap(next.drafts, SURFACE_MAX_DRAFTS);
  next.scrolls = trimMap(next.scrolls, SURFACE_MAX_SCROLLS);
  next.active = trimMap(next.active, SURFACE_MAX_ACTIVE);

  // Byte budget — drop oldest drafts then scrolls
  let guard = 0;
  while (approxBytes(next) > SURFACE_MEMORY_MAX_BYTES && guard++ < 80) {
    const draftKeys = Object.keys(next.drafts).sort(
      (a, b) => (next.drafts[a]?.updatedAt || 0) - (next.drafts[b]?.updatedAt || 0),
    );
    if (draftKeys.length) {
      delete next.drafts[draftKeys[0]];
      continue;
    }
    const scrollKeys = Object.keys(next.scrolls).sort(
      (a, b) => (next.scrolls[a]?.updatedAt || 0) - (next.scrolls[b]?.updatedAt || 0),
    );
    if (scrollKeys.length) {
      delete next.scrolls[scrollKeys[0]];
      continue;
    }
    break;
  }

  return next;
}

let memoryCache: { userId: string; doc: SurfaceMemoryDoc } | null = null;
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function loadSurfaceMemory(userId: string): Promise<SurfaceMemoryDoc> {
  const uid = userId || 'guest';
  if (memoryCache?.userId === uid) return memoryCache.doc;
  try {
    const hit = await LocalEngine.cacheGet<SurfaceMemoryDoc>(SURFACE_MEMORY_KEY(uid));
    const doc =
      hit && hit.version === 1
        ? pruneDoc({ ...emptySurfaceMemory(), ...hit, drafts: hit.drafts || {}, scrolls: hit.scrolls || {}, active: hit.active || {} })
        : emptySurfaceMemory();
    memoryCache = { userId: uid, doc };
    return doc;
  } catch {
    const doc = emptySurfaceMemory();
    memoryCache = { userId: uid, doc };
    return doc;
  }
}

async function persistSurfaceMemory(userId: string, doc: SurfaceMemoryDoc): Promise<void> {
  const uid = userId || 'guest';
  const pruned = pruneDoc(doc);
  memoryCache = { userId: uid, doc: pruned };
  await LocalEngine.cacheSet(SURFACE_MEMORY_KEY(uid), pruned);
}

function schedulePersist(userId: string, doc: SurfaceMemoryDoc) {
  const uid = userId || 'guest';
  memoryCache = { userId: uid, doc };
  const prev = persistTimers.get(uid);
  if (prev) clearTimeout(prev);
  persistTimers.set(
    uid,
    setTimeout(() => {
      void persistSurfaceMemory(uid, doc);
      persistTimers.delete(uid);
    }, 280),
  );
}

export async function readSurfaceDraft(
  userId: string,
  scope: string,
): Promise<SurfaceDraftEntry | null> {
  const doc = await loadSurfaceMemory(userId);
  return doc.drafts[scope] || null;
}

export async function writeSurfaceDraft(
  userId: string,
  scope: string,
  text: string,
  meta?: SurfaceDraftEntry['meta'],
): Promise<void> {
  const doc = await loadSurfaceMemory(userId);
  const trimmed = String(text || '').slice(0, SURFACE_DRAFT_MAX_CHARS);
  if (!trimmed.trim()) {
    delete doc.drafts[scope];
  } else {
    doc.drafts[scope] = {
      text: trimmed,
      updatedAt: Date.now(),
      meta: meta || doc.drafts[scope]?.meta,
    };
  }
  doc.updatedAt = Date.now();
  schedulePersist(userId, doc);
}

export async function clearSurfaceDraft(userId: string, scope: string): Promise<void> {
  const doc = await loadSurfaceMemory(userId);
  if (!doc.drafts[scope]) return;
  delete doc.drafts[scope];
  doc.updatedAt = Date.now();
  schedulePersist(userId, doc);
}

export async function readSurfaceScroll(
  userId: string,
  scope: string,
): Promise<SurfaceScrollEntry | null> {
  const doc = await loadSurfaceMemory(userId);
  return doc.scrolls[scope] || null;
}

export async function writeSurfaceScroll(
  userId: string,
  scope: string,
  top: number,
  left = 0,
): Promise<void> {
  const doc = await loadSurfaceMemory(userId);
  doc.scrolls[scope] = {
    top: Math.max(0, Math.round(top)),
    left: Math.max(0, Math.round(left)),
    updatedAt: Date.now(),
  };
  doc.updatedAt = Date.now();
  schedulePersist(userId, doc);
}

export async function writeSurfaceActive(
  userId: string,
  kind: string,
  entry: Omit<SurfaceActiveEntry, 'kind' | 'updatedAt'> & { open?: boolean },
): Promise<void> {
  const doc = await loadSurfaceMemory(userId);
  const key = activeScope(kind);
  if (entry.open === false) {
    delete doc.active[key];
  } else {
    doc.active[key] = {
      kind,
      id: entry.id ?? null,
      route: entry.route ?? null,
      meta: entry.meta,
      updatedAt: Date.now(),
    };
  }
  doc.updatedAt = Date.now();
  schedulePersist(userId, doc);
}

export async function readSurfaceActive(
  userId: string,
  kind: string,
): Promise<SurfaceActiveEntry | null> {
  const doc = await loadSurfaceMemory(userId);
  return doc.active[activeScope(kind)] || null;
}
