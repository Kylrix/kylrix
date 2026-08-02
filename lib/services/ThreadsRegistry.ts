'use client';

/**
 * ThreadsRegistry — Idempotent discussion thread manager + local cache.
 * Uses canonical ThreadService (unique scopeKey) via secure-ops — never spins
 * duplicate ghost isThread notes for the same parent+channel.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';

export interface ObjectThread {
  threadId: string;
  resourceId: string;
  resourceType: string;
  title: string;
  isEncrypted?: boolean;
  createdAt: number;
}

function mapResourceTypeToParentKind(resourceType: string): string {
  const t = String(resourceType || '').toLowerCase();
  if (t === 'project' || t === 'workspace') return 'workspace';
  if (t === 'task' || t === 'goal') return 'goal';
  if (t === 'note' || t === 'idea') return 'note';
  if (t === 'event') return 'event';
  if (t === 'form') return 'form';
  if (t === 'call') return 'call';
  return t || 'object';
}

export const ThreadsRegistry = {
  /** Get or idempotently create a discussion thread for an object */
  async getOrCreateThreadForObject(
    resourceId: string,
    resourceType: string = 'project',
    title?: string,
    existingThreadId?: string
  ): Promise<string> {
    if (existingThreadId) {
      const cacheKey = `f_thread_${resourceType}_${resourceId}`;
      await LocalEngine.cacheSet(cacheKey, {
        threadId: existingThreadId,
        resourceId,
        resourceType,
        title: title || 'Discussion',
        createdAt: Date.now(),
      });
      return existingThreadId;
    }

    const cacheKey = `f_thread_${resourceType}_${resourceId}`;
    const cached = await LocalEngine.cacheGet<ObjectThread>(cacheKey);
    if (cached?.threadId) return cached.threadId;

    const lockKey = `f_thread_lock_${resourceType}_${resourceId}`;
    const inFlightLock = await LocalEngine.cacheGet<boolean>(lockKey);
    if (inFlightLock) {
      await new Promise((res) => setTimeout(res, 300));
      const retryCached = await LocalEngine.cacheGet<ObjectThread>(cacheKey);
      if (retryCached?.threadId) return retryCached.threadId;
    }

    await LocalEngine.cacheSet(lockKey, true);
    try {
      const { getOrCreateThread } = await import('@/lib/actions/client-ops');
      const parentKind = mapResourceTypeToParentKind(resourceType);
      const channel = parentKind === 'workspace' ? 'general' : 'discuss';
      const res = await getOrCreateThread({
        parentKind,
        parentId: resourceId,
        channel,
        title: title || 'Discussion',
      });
      const createdThreadId = (res as any)?.thread?.id || (res as any)?.id || '';
      if (createdThreadId) {
        await LocalEngine.cacheSet(cacheKey, {
          threadId: createdThreadId,
          resourceId,
          resourceType,
          title: title || 'Discussion',
          createdAt: Date.now(),
        });
      }
      return createdThreadId;
    } finally {
      await LocalEngine.cacheDelete(lockKey);
    }
  },

  async cacheDiscussionMessages(threadId: string, messages: any[]): Promise<void> {
    if (!threadId) return;
    await LocalEngine.cacheSet(`f_discussions_${threadId}`, messages);
  },

  async getLocalDiscussionMessages(threadId: string): Promise<any[] | null> {
    if (!threadId) return null;
    return await LocalEngine.cacheGet<any[]>(`f_discussions_${threadId}`);
  },
};
