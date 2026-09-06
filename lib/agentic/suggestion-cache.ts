/**
 * Local Kylie-assist suggestion cache — cushions AI against delete/retype thrash.
 * Exact draft hits + near-prefix recovery. Persisted in LocalEngine per scope.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';

const MAX_ENTRIES = 120;
const TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const PREFIX_SLACK = 28; // chars deleted from end still reuse nearest longer/shorter hit

type CacheEntry = {
  draft: string;
  suggestion: string;
  at: number;
  kind: 'suffix' | 'takeover';
};

type CacheBlob = { entries: CacheEntry[]; updatedAt: number };

const memory = new Map<string, CacheEntry[]>();

function persistKey(scope: string, userId?: string): string {
  const uid = String(userId || 'anon').trim() || 'anon';
  return `f_kylie_suggest_cache_${scope}_${uid}`;
}

/** Normalize for stable keys — trim end only so mid-word edits stay distinct. */
export function normalizeSuggestDraft(draft: string): string {
  return String(draft || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trimEnd()
    .slice(0, 4000);
}

function prune(entries: CacheEntry[]): CacheEntry[] {
  const now = Date.now();
  const fresh = entries.filter((e) => e && e.draft && e.suggestion && now - e.at < TTL_MS);
  // Dedupe by draft+kind keeping newest
  const byKey = new Map<string, CacheEntry>();
  for (const e of fresh) {
    const k = `${e.kind}::${e.draft}`;
    const prev = byKey.get(k);
    if (!prev || e.at >= prev.at) byKey.set(k, e);
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_ENTRIES);
}

async function loadEntries(scope: string, userId?: string): Promise<CacheEntry[]> {
  const key = persistKey(scope, userId);
  if (memory.has(key)) return memory.get(key)!;
  try {
    const blob = await LocalEngine.cacheGet<CacheBlob>(key);
    const entries = prune(Array.isArray(blob?.entries) ? blob!.entries : []);
    memory.set(key, entries);
    return entries;
  } catch {
    memory.set(key, []);
    return [];
  }
}

async function saveEntries(scope: string, userId: string | undefined, entries: CacheEntry[]): Promise<void> {
  const key = persistKey(scope, userId);
  const next = prune(entries);
  memory.set(key, next);
  try {
    await LocalEngine.cacheSet(key, { entries: next, updatedAt: Date.now() } satisfies CacheBlob);
  } catch {}
}

function pickBest(entries: CacheEntry[], draftNorm: string, kind: CacheEntry['kind']): CacheEntry | null {
  if (!draftNorm || draftNorm.length < 2) return null;
  const pool = entries.filter((e) => e.kind === kind);
  const exact = pool.find((e) => e.draft === draftNorm);
  if (exact) return exact;

  // User deleted from the end: current draft is a prefix of a longer cached draft
  let bestLonger: CacheEntry | null = null;
  for (const e of pool) {
    if (!e.draft.startsWith(draftNorm)) continue;
    const delta = e.draft.length - draftNorm.length;
    if (delta <= 0 || delta > PREFIX_SLACK) continue;
    if (!bestLonger || e.draft.length < bestLonger.draft.length) bestLonger = e;
  }
  if (bestLonger) {
    // Reconstruct: remaining typed chars from the longer draft + original suggestion
    const remainder = bestLonger.draft.slice(draftNorm.length);
    const rebuilt = `${remainder}${bestLonger.suggestion}`;
    if (rebuilt.trim().length >= 2) {
      return { ...bestLonger, draft: draftNorm, suggestion: rebuilt };
    }
  }

  // User re-added toward a shorter cached draft (prefix of current)
  let bestShorter: CacheEntry | null = null;
  for (const e of pool) {
    if (!draftNorm.startsWith(e.draft)) continue;
    const delta = draftNorm.length - e.draft.length;
    if (delta <= 0 || delta > PREFIX_SLACK) continue;
    // Only reuse if the extra chars are a prefix of the prior suggestion (they typed into it)
    const extra = draftNorm.slice(e.draft.length);
    const sug = e.suggestion;
    if (sug.startsWith(extra) || sug.replace(/^\s+/, '').startsWith(extra.replace(/^\s+/, ''))) {
      const rest = sug.startsWith(extra) ? sug.slice(extra.length) : sug.replace(/^\s+/, '').slice(extra.replace(/^\s+/, '').length);
      if (rest.trim().length >= 2) {
        const candidate = { ...e, draft: draftNorm, suggestion: rest };
        if (!bestShorter || e.draft.length > bestShorter.draft.length) bestShorter = candidate;
      }
    }
  }
  return bestShorter;
}

/** Lookup cached suffix for this draft — no network. */
export async function lookupCachedSuggestion(opts: {
  scope: string;
  userId?: string;
  draft: string;
}): Promise<string | null> {
  const draftNorm = normalizeSuggestDraft(opts.draft);
  if (draftNorm.length < 3) return null;
  const entries = await loadEntries(opts.scope, opts.userId);
  const hit = pickBest(entries, draftNorm, 'suffix');
  return hit?.suggestion?.trim() ? hit.suggestion : null;
}

/** Persist a live suffix suggestion (offline or AI). */
export async function rememberSuggestion(opts: {
  scope: string;
  userId?: string;
  draft: string;
  suggestion: string;
}): Promise<void> {
  const draftNorm = normalizeSuggestDraft(opts.draft);
  const suggestion = String(opts.suggestion || '').trim();
  if (draftNorm.length < 3 || suggestion.length < 2) return;
  const entries = await loadEntries(opts.scope, opts.userId);
  entries.unshift({
    draft: draftNorm,
    suggestion,
    at: Date.now(),
    kind: 'suffix',
  });
  await saveEntries(opts.scope, opts.userId, entries);
}

/** Lookup cached takeover body. */
export async function lookupCachedTakeover(opts: {
  scope: string;
  userId?: string;
  draft: string;
}): Promise<string | null> {
  const draftNorm = normalizeSuggestDraft(opts.draft);
  if (draftNorm.length < 2) return null;
  const entries = await loadEntries(opts.scope, opts.userId);
  const hit = pickBest(entries, draftNorm, 'takeover');
  return hit?.suggestion?.trim() ? hit.suggestion : null;
}

export async function rememberTakeover(opts: {
  scope: string;
  userId?: string;
  draft: string;
  body: string;
}): Promise<void> {
  const draftNorm = normalizeSuggestDraft(opts.draft);
  const body = String(opts.body || '').trim();
  if (body.length < 8) return;
  const entries = await loadEntries(opts.scope, opts.userId);
  entries.unshift({
    draft: draftNorm || '__empty__',
    suggestion: body,
    at: Date.now(),
    kind: 'takeover',
  });
  await saveEntries(opts.scope, opts.userId, entries);
}
