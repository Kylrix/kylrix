/**
 * Agentic session local copy — LocalEngine partition between UI, AI provider, and Appwrite.
 * Messages are written locally first (pending), then flushed to agentic_sessions.
 */

import type { AgenticMessageBlock } from './message-blocks';

export type AgenticSyncStatus = 'pending' | 'synced' | 'error';

export interface AgenticLocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  syncStatus?: AgenticSyncStatus;
  isPublic?: boolean;
  isGuest?: boolean;
  blocks?: AgenticMessageBlock[];
  nextSteps?: Array<{ label: string; prompt: string }>;
  tools?: unknown[];
}

export interface AgenticLocalSession {
  id: string;
  userId: string;
  context?: string;
  chatHistory: AgenticLocalMessage[];
  isPublic?: boolean;
  isGuest?: boolean;
  isPinned?: boolean;
  targetType?: string | null;
  targetId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgenticSessionListItem {
  id: string;
  userId: string;
  context?: string;
  chatHistory: string;
  isPublic?: boolean;
  isGuest?: boolean;
  isPinned?: boolean;
  targetType?: string | null;
  targetId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function sortSessions(rows: AgenticSessionListItem[]): AgenticSessionListItem[] {
  return [...rows].sort((a: any, b: any) => {
    const pinDelta = Number(b.isPinned === true) - Number(a.isPinned === true);
    if (pinDelta !== 0) return pinDelta;
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* non-fatal */
    }
  });
}

export function subscribeAgenticLocalStore(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function sessionsListKey(userId: string) {
  return `f_agent_sessions_${userId}`;
}

function sessionKey(sessionId: string) {
  return `f_agent_session_${sessionId}`;
}

function activeSessionKey(userId: string) {
  return `f_agent_active_session_${userId}`;
}

export const AgenticSessionLocalStore = {
  sessionsListKey,
  sessionKey,
  activeSessionKey,

  async getSessionsList(userId: string): Promise<AgenticSessionListItem[]> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const hit = await LocalEngine.cacheGet<AgenticSessionListItem[]>(sessionsListKey(userId));
    return Array.isArray(hit) ? hit : [];
  },

  async setSessionsList(userId: string, rows: AgenticSessionListItem[]): Promise<void> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    await LocalEngine.cacheSet(sessionsListKey(userId), sortSessions(rows));
    emit();
  },

  async getSession(sessionId: string): Promise<AgenticLocalSession | null> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    return LocalEngine.cacheGet<AgenticLocalSession>(sessionKey(sessionId));
  },

  async upsertSession(session: AgenticLocalSession): Promise<void> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const now = new Date().toISOString();
    const row: AgenticLocalSession = {
      ...session,
      updatedAt: now,
      createdAt: session.createdAt || now};
    await LocalEngine.cacheSet(sessionKey(session.id), row);

    const list = await this.getSessionsList(session.userId);
    const chatHistoryStr = JSON.stringify(row.chatHistory || []);
    const idx = list.findIndex((s) => s.id === session.id);
    const summary: AgenticSessionListItem = {
      id: session.id,
      userId: session.userId,
      context: session.context || '',
      chatHistory: chatHistoryStr,
      isPublic: session.isPublic,
      isGuest: session.isGuest,
      isPinned: session.isPinned,
      targetType: (session as any).targetType || null,
      targetId: (session as any).targetId || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt};
    if (idx >= 0) list[idx] = summary;
    else list.unshift(summary);
    await this.setSessionsList(session.userId, list.slice(0, 120));
    emit();
  },

  async setActiveSessionId(userId: string, sessionId: string | null): Promise<void> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    await LocalEngine.cacheSet(activeSessionKey(userId), sessionId);
    emit();
  },

  async getActiveSessionId(userId: string): Promise<string | null> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    return LocalEngine.cacheGet<string | null>(activeSessionKey(userId));
  },

  async getActiveMessages(userId: string): Promise<AgenticLocalMessage[]> {
    const sessionId = await this.getActiveSessionId(userId);
    if (!sessionId) return [];
    const session = await this.getSession(sessionId);
    return session?.chatHistory || [];
  },

  async setActiveMessages(userId: string, sessionId: string, messages: AgenticLocalMessage[]): Promise<void> {
    const existing = (await this.getSession(sessionId)) || {
      id: sessionId,
      userId,
      chatHistory: []};
    await this.upsertSession({
      ...existing,
      id: sessionId,
      userId,
      chatHistory: messages});
    await this.setActiveSessionId(userId, sessionId);
  },

  async appendMessages(
    userId: string,
    sessionId: string,
    messages: AgenticLocalMessage[]): Promise<void> {
    const existing = (await this.getSession(sessionId)) || {
      id: sessionId,
      userId,
      chatHistory: []};
    const merged = [...(existing.chatHistory || []), ...messages];
    await this.upsertSession({ ...existing, id: sessionId, userId, chatHistory: merged });
    await this.setActiveSessionId(userId, sessionId);
  },

  async patchMessage(
    sessionId: string,
    messageId: string,
    patch: Partial<AgenticLocalMessage>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;
    const next = session.chatHistory.map((m: any) => (m.id === messageId ? { ...m, ...patch } : m));
    await this.upsertSession({ ...session, chatHistory: next });
  },

  async markMessagesSynced(sessionId: string, messageIds: string[]): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;
    const idSet = new Set(messageIds);
    const next = session.chatHistory.map((m: any) =>
      idSet.has(m.id) ? { ...m, syncStatus: 'synced' as const } : m);
    await this.upsertSession({ ...session, chatHistory: next });
  },

  async removeSession(sessionId: string, userId: string): Promise<void> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    await LocalEngine.cacheDelete(sessionKey(sessionId));
    const list = await this.getSessionsList(userId);
    await this.setSessionsList(
      userId,
      list.filter((s) => s.id !== sessionId));
    const active = await this.getActiveSessionId(userId);
    if (active === sessionId) await this.setActiveSessionId(userId, null);
    emit();
  },

  async patchSessionMeta(
    userId: string,
    sessionId: string,
    patch: Partial<Pick<AgenticLocalSession, 'isPublic' | 'isGuest' | 'isPinned' | 'context' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.upsertSession({ ...session, ...patch, id: sessionId, userId });
      return;
    }

    const list = await this.getSessionsList(userId);
    const next = list.map((row: any) => (row.id === sessionId ? { ...row, ...patch } : row));
    await this.setSessionsList(userId, next);
  },

  async getOrCreateKylieHangoutSession(userId: string): Promise<AgenticLocalSession> {
    const list = await this.getSessionsList(userId);
    const existingSummary = list.find((s) => s.targetType === 'kylieHangout');
    if (existingSummary) {
      const full = await this.getSession(existingSummary.id);
      if (full) return full;
    }

    const sessionId = `kylie_hangout_${userId}_${Date.now()}`;
    const newSession: AgenticLocalSession = {
      id: sessionId,
      userId,
      targetType: 'kylieHangout',
      context: 'Kylie Assistant — Ecosystem AI assistant with full tool access, note/task management, and natural guidance.',
      chatHistory: [
        {
          id: `msg_welcome_${Date.now()}`,
          role: 'assistant',
          content: "Hey there! I'm **Kylie**, your AI assistant for Kylrix. I can help you write notes, organize tasks, run system workflows, search your workspace, or answer questions. What are we working on today?",
          syncStatus: 'synced',
        },
      ],
    };

    await this.upsertSession(newSession);
    return newSession;
  },

  isMessagePending(message?: AgenticLocalMessage | null): boolean {
    if (!message) return false;
    return message.syncStatus === 'pending' || message.syncStatus === 'error';
  }
};

