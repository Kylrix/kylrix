import { ulid } from '@/lib/utils/ulid';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export type TelemetryNiche = 
  | 'workspace'
  | 'productivity'
  | 'connect'
  | 'security'
  | 'intelligence'
  | 'billing'
  | 'system';

export type NotificationType = 'direct' | 'suggested';

export const TelemetryService = {
  async startThread(_params: {
    niche: TelemetryNiche;
    app: string;
    parentThreadId?: string | null;
  }): Promise<string> {
    return ulid();
  },

  async completeThread(_threadId: string): Promise<void> {},

  async failThread(_threadId: string): Promise<void> {},

  async recordActivity(params: {
    userId: string;
    niche: TelemetryNiche;
    app: string;
    action: string;
    threadId?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    try {
      await db.insert(schema.activityLog).values({
        id: ulid(),
        userId: params.userId,
        action: params.action,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        createdAt: new Date().toISOString(),
      });
    } catch {}
  },

  async recordTelemetry(_params: {
    niche: TelemetryNiche;
    app: string;
    action: string;
    intent?: string | null;
    threadId?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<void> {},

  async sendNotification(params: {
    originatorId: string;
    targets: string[];
    targetPointer?: Record<string, any> | null;
    type?: NotificationType;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    try {
      await db.insert(schema.notifications).values({
        id: ulid(),
        originatorId: params.originatorId,
        targets: JSON.stringify(params.targets),
        targetPointer: params.targetPointer ? JSON.stringify(params.targetPointer) : null,
        type: params.type || 'direct',
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        createdAt: new Date().toISOString(),
      });
    } catch {}
  },

  async readNotification(notificationId: string, _userId: string): Promise<void> {
    try {
      await db.delete(schema.notifications).where(eq(schema.notifications.id, notificationId));
    } catch {}
  },

  async loadSession(userId: string, sessionId?: string): Promise<{ context: string; chatHistory: string; seen: boolean; rowId?: string }> {
    try {
      if (sessionId) {
        const rows = await db
          .select()
          .from(schema.agenticSessions)
          .where(eq(schema.agenticSessions.id, sessionId))
          .limit(1);

        if (rows.length > 0) {
          const r = rows[0];
          return {
            context: r.context || '',
            chatHistory: r.chatHistory || '[]',
            seen: Boolean(r.seen),
            rowId: r.id,
          };
        }
      }

      const rows = await db
        .select()
        .from(schema.agenticSessions)
        .where(eq(schema.agenticSessions.userId, userId))
        .orderBy(desc(schema.agenticSessions.createdAt))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        return {
          context: r.context || '',
          chatHistory: r.chatHistory || '[]',
          seen: Boolean(r.seen),
          rowId: r.id,
        };
      }
    } catch {}

    return { context: '', chatHistory: '[]', seen: true };
  },

  async saveSession(userId: string, context: string, chatHistory: string, seen = true, sessionId?: string): Promise<string | undefined> {
    const targetSessionId = sessionId || ulid();
    const now = new Date().toISOString();

    try {
      const existing = await db
        .select()
        .from(schema.agenticSessions)
        .where(eq(schema.agenticSessions.id, targetSessionId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.agenticSessions)
          .set({
            context,
            chatHistory,
            seen,
            updatedAt: now,
          })
          .where(eq(schema.agenticSessions.id, targetSessionId));
      } else {
        await db.insert(schema.agenticSessions).values({
          id: targetSessionId,
          userId,
          context,
          chatHistory,
          seen,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch {}

    return targetSessionId;
  },

  async loadMemory(_userId: string): Promise<{ context: string; rowId?: string }> {
    return { context: '' };
  },

  async saveMemory(_userId: string, _context: string): Promise<void> {},

  async recordAgenticTelemetry(_params: any): Promise<void> {},

  async recordSessionObject(params: {
    userId: string;
    sessionId: string;
    objectId: string;
    objectType: string;
    title?: string | null;
    toolKey?: string | null;
  }): Promise<void> {
    try {
      await db.insert(schema.sessionObjects).values({
        id: ulid(),
        userId: params.userId,
        sessionId: params.sessionId,
        objectId: params.objectId,
        objectType: params.objectType,
        title: params.title || null,
        toolKey: params.toolKey || null,
        createdAt: new Date().toISOString(),
      });
    } catch {}
  },

  async listSessionObjects(
    userId: string,
    sessionId: string,
    limit = 40
  ): Promise<Array<{ objectId: string; objectType: string; title: string | null; toolKey: string | null; createdAt: string | null }>> {
    try {
      const rows = await db
        .select()
        .from(schema.sessionObjects)
        .where(and(eq(schema.sessionObjects.userId, userId), eq(schema.sessionObjects.sessionId, sessionId)))
        .orderBy(desc(schema.sessionObjects.createdAt))
        .limit(limit);

      return rows.map((r) => ({
        objectId: r.objectId,
        objectType: r.objectType,
        title: r.title,
        toolKey: r.toolKey,
        createdAt: r.createdAt,
      }));
    } catch {
      return [];
    }
  },

  async recordToolCall(params: {
    userId: string;
    sessionId: string;
    conversationId: string;
    toolKey: string;
    specifier?: string | null;
    args?: Record<string, unknown> | null;
    status?: string | null;
    resultSummary?: string | null;
  }): Promise<string | null> {
    const id = ulid();
    try {
      await db.insert(schema.toolCalls).values({
        id,
        userId: params.userId,
        sessionId: params.sessionId,
        conversationId: params.conversationId,
        toolKey: params.toolKey,
        specifier: params.specifier || null,
        args: params.args ? JSON.stringify(params.args) : null,
        status: params.status || 'success',
        resultSummary: params.resultSummary || null,
        createdAt: new Date().toISOString(),
      });
      return id;
    } catch {
      return null;
    }
  },

  async listToolCalls(
    userId: string,
    sessionId: string,
    limit = 100
  ): Promise<Array<{
    $id: string;
    conversationId: string;
    toolKey: string;
    specifier: string | null;
    args: string | null;
    status: string | null;
    resultSummary: string | null;
    createdAt: string | null;
  }>> {
    try {
      const rows = await db
        .select()
        .from(schema.toolCalls)
        .where(and(eq(schema.toolCalls.userId, userId), eq(schema.toolCalls.sessionId, sessionId)))
        .limit(limit);

      return rows.map((r) => ({
        $id: r.id,
        conversationId: r.conversationId,
        toolKey: r.toolKey,
        specifier: r.specifier,
        args: r.args,
        status: r.status,
        resultSummary: r.resultSummary,
        createdAt: r.createdAt,
      }));
    } catch {
      return [];
    }
  },
};
