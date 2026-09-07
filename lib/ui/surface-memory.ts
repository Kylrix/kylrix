/**
 * Cross-surface UI memory (LocalEngine-first).
 * Mirrors native sidebar memory: instant local restore, optional later remote sync.
 *
 * Exclusive rule (STRICT):
 *   One route → at most ONE foreground surface (note detail XOR moments XOR hangouts…).
 *   Do NOT stack mutually exclusive UIs as “open”. Tabs/prefs are separate and not restored as open overlays.
 *   Stackable chrome (rare: sudo on top of a surface) is not stored here — live stack only.
 *
 * Hard size caps so payloads stay cross-platform safe.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';

export const SURFACE_MEMORY_KEY = (userId: string) => `f_surface_memory_${userId}`;

/** Soft ceiling for the whole document (~48KB UTF-16-ish). */
export const SURFACE_MEMORY_MAX_BYTES = 48_000;
export const SURFACE_DRAFT_MAX_CHARS = 8_000;
export const SURFACE_MAX_DRAFTS = 48;
export const SURFACE_MAX_SCROLLS = 64;
export const SURFACE_MAX_ROUTES = 40;
export const SURFACE_MAX_PREFS = 32;

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
  /**
   * Exclusive foreground kind for a route, e.g.
   * unified:moments | unified:moment-composer | unified:hangouts | rail:note | rail:goal
   */
  kind: string;
  /** Stable discriminator — parent moment id, note id, etc. */
  id?: string | null;
  route?: string | null;
  updatedAt: number;
  meta?: Record<string, string | number | boolean | null>;
};

export type SurfaceMemoryDoc = {
  version: 2;
  drafts: Record<string, SurfaceDraftEntry>;
  scrolls: Record<string, SurfaceScrollEntry>;
  /**
   * Last-wins exclusive foreground per route.
   * Opening moments replaces note detail for that route — never both.
   */
  foregroundByRoute: Record<string, SurfaceActiveEntry>;
  /**
   * Non-exclusive prefs (feed tab, collapsed flags). NEVER treated as “open this overlay”.
   */
  prefs: Record<string, SurfaceActiveEntry>;
  updatedAt: number;
};

export function emptySurfaceMemory(): SurfaceMemoryDoc {
  return {
    version: 2,
    drafts: {},
    scrolls: {},
    foregroundByRoute: {},
    prefs: {},
    updatedAt: Date.now(),
  };
}

/** Collapse dynamic ids so memory keys stay stable across similar screens. */
export function surfaceRouteKey(pathname?: string | null): string {
  if (typeof pathname === 'string' && pathname) {
    return pathname
      .replace(/\/[a-f0-9]{8,}(?:-[a-f0-9]+)*$/i, '/:id')
      .replace(/\/\d+$/g, '/:id');
  }
  if (typeof window !== 'undefined' && window.location?.pathname) {
    return surfaceRouteKey(window.location.pathname);
  }
  return '/';
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

export function prefScope(kind: string): string {
  return `pref:${kind}`;
}

function approxBytes(doc: SurfaceMemoryDoc): number {
  try {
    return JSON.stringify(doc).length * 2;
  } catch {
    return SURFACE_MEMORY_MAX_BYTES + 1;
  }
}

function migrateFromV1(raw: any): SurfaceMemoryDoc {
  const base = emptySurfaceMemory();
  if (!raw || typeof raw !== 'object') return base;
  base.drafts = raw.drafts || {};
  base.scrolls = raw.scrolls || {};
  // v1 stored many active:* keys — keep only the newest as a single global foreground
  const actives = Object.values(raw.active || {}) as SurfaceActiveEntry[];
  if (actives.length) {
    const newest = [...actives].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    if (newest?.kind) {
      const route = newest.route || '/';
      base.foregroundByRoute[route] = { ...newest, route, updatedAt: newest.updatedAt || Date.now() };
    }
  }
  return pruneDoc(base);
}

function pruneDoc(doc: SurfaceMemoryDoc): SurfaceMemoryDoc {
  const next: SurfaceMemoryDoc = {
    version: 2,
    drafts: { ...doc.drafts },
    scrolls: { ...doc.scrolls },
    foregroundByRoute: { ...doc.foregroundByRoute },
    prefs: { ...doc.prefs },
    updatedAt: Date.now(),
  };

  const trimMap = <T extends { updatedAt: number }>(
    map: Record<string, T>,
    max: number,
  ): Record<string, T> => {
    const entries = Object.entries(map).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    return Object.fromEntries(entries.slice(0, max));
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
  next.foregroundByRoute = trimMap(next.foregroundByRoute, SURFACE_MAX_ROUTES);
  next.prefs = trimMap(next.prefs, SURFACE_MAX_PREFS);

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
    const hit = await LocalEngine.cacheGet<any>(SURFACE_MEMORY_KEY(uid));
    let doc: SurfaceMemoryDoc;
    if (hit?.version === 2) {
      doc = pruneDoc({
        ...emptySurfaceMemory(),
        ...hit,
        drafts: hit.drafts || {},
        scrolls: hit.scrolls || {},
        foregroundByRoute: hit.foregroundByRoute || {},
        prefs: hit.prefs || {},
      });
    } else if (hit?.version === 1 || hit?.active) {
      doc = migrateFromV1(hit);
      void LocalEngine.cacheSet(SURFACE_MEMORY_KEY(uid), doc);
    } else {
      doc = emptySurfaceMemory();
    }
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

/**
 * Set the single exclusive foreground for a route (replaces whatever was there).
 * Pass null / open:false to clear — never leave two overlays “enabled”.
 */
export async function writeSurfaceForeground(
  userId: string,
  entry:
    | (Omit<SurfaceActiveEntry, 'updatedAt' | 'route'> & {
        route?: string | null;
        open?: boolean;
      })
    | null,
  routePath?: string | null,
): Promise<void> {
  const doc = await loadSurfaceMemory(userId);
  const route = surfaceRouteKey(entry?.route ?? routePath);
  if (!entry || entry.open === false) {
    delete doc.foregroundByRoute[route];
  } else {
    doc.foregroundByRoute[route] = {
      kind: entry.kind,
      id: entry.id ?? null,
      route,
      meta: entry.meta,
      updatedAt: Date.now(),
    };
  }
  doc.updatedAt = Date.now();
  schedulePersist(userId, doc);
}

export async function readSurfaceForeground(
  userId: string,
  routePath?: string | null,
): Promise<SurfaceActiveEntry | null> {
  const doc = await loadSurfaceMemory(userId);
  return doc.foregroundByRoute[surfaceRouteKey(routePath)] || null;
}

/** Non-exclusive prefs (tabs, toggles) — never restore as open stacks. */
export async function writeSurfacePref(
  userId: string,
  kind: string,
  entry: Omit<SurfaceActiveEntry, 'kind' | 'updatedAt'> & { open?: boolean },
): Promise<void> {
  const doc = await loadSurfaceMemory(userId);
  const key = prefScope(kind);
  if (entry.open === false) {
    delete doc.prefs[key];
  } else {
    doc.prefs[key] = {
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

export async function readSurfacePref(
  userId: string,
  kind: string,
): Promise<SurfaceActiveEntry | null> {
  const doc = await loadSurfaceMemory(userId);
  return doc.prefs[prefScope(kind)] || null;
}

/**
 * @deprecated Use writeSurfaceForeground (exclusive) or writeSurfacePref (tabs).
 * Kept as a thin adapter so old call sites don't stack kinds in a free-for-all map.
 */
export async function writeSurfaceActive(
  userId: string,
  kind: string,
  entry: Omit<SurfaceActiveEntry, 'kind' | 'updatedAt'> & { open?: boolean },
): Promise<void> {
  // Tabs / nested chrome → prefs. Everything else → exclusive foreground.
  if (kind.includes('-tab') || kind.endsWith(':tab') || kind.startsWith('pref:')) {
    await writeSurfacePref(userId, kind, entry);
    return;
  }
  if (entry.open === false) {
    await writeSurfaceForeground(userId, { kind, open: false, route: entry.route });
    return;
  }
  await writeSurfaceForeground(userId, {
    kind,
    id: entry.id,
    route: entry.route,
    meta: entry.meta,
  });
}

/** @deprecated Use readSurfaceForeground or readSurfacePref. */
export async function readSurfaceActive(
  userId: string,
  kind: string,
): Promise<SurfaceActiveEntry | null> {
  if (kind.includes('-tab') || kind.endsWith(':tab') || kind.startsWith('pref:')) {
    return readSurfacePref(userId, kind);
  }
  const fg = await readSurfaceForeground(userId);
  return fg?.kind === kind ? fg : null;
}
