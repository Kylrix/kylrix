'use client';

import { LocalEngine } from '@/lib/services/LocalEngine';

const SEEN_STORAGE_KEY_PREFIX = 'f_seen_moments_';
const MAX_SEEN_HISTORY = 1000;

// In-memory set for instantaneous 0ms checks
const memorySeen = new Set<string>();
let activeUserId: string = 'anon';
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const pendingSaves = new Set<string>();

/**
 * Initialize seen posts registry for current user
 */
export async function initSeenMoments(userId?: string): Promise<Set<string>> {
  if (typeof window === 'undefined') return memorySeen;
  activeUserId = userId || 'anon';
  const key = `${SEEN_STORAGE_KEY_PREFIX}${activeUserId}`;

  try {
    // 1. Check local storage
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed: string[] = JSON.parse(raw);
      parsed.forEach((id) => memorySeen.add(id));
    }

    // 2. Check LocalEngine
    const cached = await LocalEngine.cacheGet<string[]>(key).catch(() => null);
    if (Array.isArray(cached)) {
      cached.forEach((id) => memorySeen.add(id));
    }
  } catch {}

  return memorySeen;
}

export function isMomentSeen(id: string): boolean {
  return memorySeen.has(id);
}

/**
 * Mark a moment as seen (debounced persistence to LocalEngine and localStorage)
 */
export function markMomentSeen(id: string) {
  if (!id || memorySeen.has(id)) return;
  memorySeen.add(id);
  pendingSaves.add(id);

  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushSeenToStorage();
  }, 1000);
}

/**
 * Mark multiple moments as seen
 */
export function markMomentsSeen(ids: string[]) {
  let changed = false;
  for (const id of ids) {
    if (id && !memorySeen.has(id)) {
      memorySeen.add(id);
      pendingSaves.add(id);
      changed = true;
    }
  }
  if (changed) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flushSeenToStorage();
    }, 500);
  }
}

/**
 * Reset seen history
 */
export async function resetSeenMoments(userId?: string) {
  const uid = userId || activeUserId;
  const key = `${SEEN_STORAGE_KEY_PREFIX}${uid}`;
  memorySeen.clear();
  pendingSaves.clear();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
  await LocalEngine.cacheSet(key, []).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:seen-moments-changed'));
  }
}

function flushSeenToStorage() {
  if (typeof window === 'undefined') return;
  const key = `${SEEN_STORAGE_KEY_PREFIX}${activeUserId}`;
  const list = Array.from(memorySeen).slice(-MAX_SEEN_HISTORY);

  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {}

  void LocalEngine.cacheSet(key, list).catch(() => {});
  window.dispatchEvent(new CustomEvent('kylrix:seen-moments-changed'));
}
