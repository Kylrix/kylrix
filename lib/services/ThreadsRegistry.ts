'use client';

/**
 * ThreadsRegistry — Centralized Idempotent Discussion Thread Manager & Local Copy Engine.
 * Ensures each object (project, task, event, etc.) has exactly ONE discussion thread.
 * Prevents duplicate thread creation and provides 0ms local copy hydration.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import { createGhostNoteForProject } from '@/lib/actions/client-ops';

export interface ObjectThread {
  threadId: string;
  resourceId: string;
  resourceType: string;
  title: string;
  isEncrypted?: boolean;
  createdAt: number;
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
        title: title || 'Discussion Thread',
        createdAt: Date.now(),
      });
      return existingThreadId;
    }

    const cacheKey = `f_thread_${resourceType}_${resourceId}`;
    const cached = await LocalEngine.cacheGet<ObjectThread>(cacheKey);
    if (cached && cached.threadId) {
      return cached.threadId;
    }

    // Single-in-flight lock to prevent race conditions during rapid icon clicks
    const lockKey = `f_thread_lock_${resourceType}_${resourceId}`;
    const inFlightLock = await LocalEngine.cacheGet<boolean>(lockKey);
    if (inFlightLock) {
      // Small backoff wait
      await new Promise((res) => setTimeout(res, 300));
      const retryCached = await LocalEngine.cacheGet<ObjectThread>(cacheKey);
      if (retryCached && retryCached.threadId) return retryCached.threadId;
    }

    await LocalEngine.cacheSet(lockKey, true);
    try {
      let createdThreadId = '';
      if (resourceType === 'project') {
        const res = await createGhostNoteForProject(resourceId, title || 'Project Discussion');
        createdThreadId = (res as any)?.$id || String(res || '');
      } else {
        const { createNote } = await import('@/lib/actions/client-ops');
        const res = await createNote({
          title: title || `${resourceType} Discussion`,
          content: '',
          isGhost: true,
          isThread: true,
          isPublic: false,
          isGuest: false,
        });
        createdThreadId = res.$id;
      }

      if (createdThreadId) {
        await LocalEngine.cacheSet(cacheKey, {
          threadId: createdThreadId,
          resourceId,
          resourceType,
          title: title || 'Discussion Thread',
          createdAt: Date.now(),
        });
      }
      return createdThreadId;
    } finally {
      await LocalEngine.cacheDelete(lockKey);
    }
  },

  /** Store discussion comments locally for 0ms instant render */
  async cacheDiscussionMessages(threadId: string, messages: any[]): Promise<void> {
    if (!threadId) return;
    await LocalEngine.cacheSet(`f_discussions_${threadId}`, messages);
  },

  /** Retrieve local discussion comments at 0ms speed */
  async getLocalDiscussionMessages(threadId: string): Promise<any[] | null> {
    if (!threadId) return null;
    return await LocalEngine.cacheGet<any[]>(`f_discussions_${threadId}`);
  },
};
