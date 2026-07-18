import { ID, Query } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

// 1. Core Future-Proof Niches
export type TelemetryNiche = 
  | 'workspace'      // Notes, Sheets, Document management
  | 'productivity'   // Tasks, Goals, Calendars, Events
  | 'connect'        // Chats, Calls, Huddles, Social Moments
  | 'security'       // Vault, Credentials, Keychains, Passkeys
  | 'intelligence'   // Smart Assistants, AI Model Routing
  | 'billing'        // Subscriptions, Tokens, Ledgers
  | 'system';        // Settings, Devices, Authentication

export type ThreadStatus = 'running' | 'completed' | 'failed';
export type NotificationType = 'direct' | 'suggested';

const DATABASE_ID = 'passwordManagerDb';
const TABLES = {
  THREADS: 'action_threads',
  ACTIVITY: 'app_activity_logs',
  TELEMETRY: 'anonymized_telemetry',
  NOTIFICATIONS: 'notifications'
};

/**
 * Robust Telemetry, Threading, and Notification Orchestrator.
 * Powered by high-efficiency Server-SDK actions.
 */
export const TelemetryService = {
  /**
   * Initialize a new action thread to track multi-step nested workflows.
   */
  async startThread(params: {
    niche: TelemetryNiche;
    app: string;
    parentThreadId?: string | null;
  }): Promise<string> {
    try {
      const tables = createSystemTablesDB();
      const threadId = ID.unique();

      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.THREADS,
        rowId: threadId,
        data: {
          threadId,
          parentThreadId: params.parentThreadId || null,
          niche: params.niche,
          app: params.app,
          status: 'running' as ThreadStatus
        }
      });

      return threadId;
    } catch (err) {
      console.error('[TelemetryService] Failed to start thread:', err);
      throw err;
    }
  },

  /**
   * Set thread status to completed.
   */
  async completeThread(threadId: string): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.THREADS,
        queries: [Query.equal('threadId', threadId), Query.limit(1)]
      });

      const row = res.rows[0];
      if (row) {
        await tables.updateRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.THREADS,
          rowId: row.$id,
          data: { status: 'completed' as ThreadStatus }
        });
      }
    } catch (err) {
      console.error('[TelemetryService] Failed to complete thread:', err);
    }
  },

  /**
   * Set thread status to failed.
   */
  async failThread(threadId: string): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.THREADS,
        queries: [Query.equal('threadId', threadId), Query.limit(1)]
      });

      const row = res.rows[0];
      if (row) {
        await tables.updateRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.THREADS,
          rowId: row.$id,
          data: { status: 'failed' as ThreadStatus }
        });
      }
    } catch (err) {
      console.error('[TelemetryService] Failed to fail thread:', err);
    }
  },

  /**
   * Record an identified, user-specific activity log.
   */
  async recordActivity(params: {
    userId: string;
    niche: TelemetryNiche;
    app: string;
    action: string;
    threadId?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    try {
      const tables = createSystemTablesDB();

      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.ACTIVITY,
        rowId: ID.unique(),
        data: {
          userId: params.userId,
          niche: params.niche,
          app: params.app,
          action: params.action,
          threadId: params.threadId || null,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null
        }
      });
    } catch (err) {
      console.error('[TelemetryService] Failed to record activity log:', err);
    }
  },

  /**
   * Record an anonymized behavioral telemetry log.
   */
  async recordTelemetry(params: {
    niche: TelemetryNiche;
    app: string;
    action: string;
    intent?: string | null;
    threadId?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    try {
      const tables = createSystemTablesDB();

      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.TELEMETRY,
        rowId: ID.unique(),
        data: {
          niche: params.niche,
          app: params.app,
          action: params.action,
          intent: params.intent || null,
          threadId: params.threadId || null,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null
        }
      });
    } catch (err) {
      console.error('[TelemetryService] Failed to record anonymized telemetry:', err);
    }
  },

  /**
   * Create a new multi-recipient live notification pointer.
   */
  async sendNotification(params: {
    originatorId: string;
    targets: string[];
    targetPointer?: Record<string, any> | null;
    type?: NotificationType;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      const type = params.type || 'direct';

      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.NOTIFICATIONS,
        rowId: ID.unique(),
        data: {
          originatorId: params.originatorId,
          targets: params.targets,
          targetPointer: params.targetPointer ? JSON.stringify(params.targetPointer) : null,
          type,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null
        }
      });
    } catch (err) {
      console.error('[TelemetryService] Failed to send notification:', err);
    }
  },

  /**
   * Safely process a notification view/dismissal action.
   * If the user is the sole target, the notification is physically deleted.
   * If part of a multi-user group, the user's ID is removed from the targets array.
   */
  async readNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      const row = await tables.getRow<any>({
        databaseId: DATABASE_ID,
        tableId: TABLES.NOTIFICATIONS,
        rowId: notificationId
      });

      if (!row || !Array.isArray(row.targets)) return;

      const remainingTargets = row.targets.filter((id: string) => id !== userId);

      if (remainingTargets.length === 0) {
        // Sole target read -> physically delete row
        await tables.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.NOTIFICATIONS,
          rowId: notificationId
        });
      } else {
        // Multi-recipient -> remove current user from targets list
        await tables.updateRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.NOTIFICATIONS,
          rowId: notificationId,
          data: {
            targets: remainingTargets
          }
        });
      }
    } catch (err) {
      console.error('[TelemetryService] Failed to read/dismiss notification:', err);
    }
  },

  /**
   * Retrieves the interactive context and message history session for the user.
   */
  async loadSession(userId: string, sessionId?: string): Promise<{ context: string; chatHistory: string; seen: boolean; rowId?: string }> {
    try {
      const tables = createSystemTablesDB();
      if (sessionId) {
        try {
          const row = await tables.getRow({
            databaseId: DATABASE_ID,
            tableId: 'agentic_sessions',
            rowId: sessionId
          });
          if (row) {
            return {
              context: row.context || '',
              chatHistory: row.chatHistory || '[]',
              seen: row.seen !== false,
              rowId: row.$id
            };
          }
        } catch {}
      }

      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: 'agentic_sessions',
        queries: [
          Query.equal('userId', userId),
          Query.notEqual('isMemory', true),
          Query.limit(1)
        ]
      });
      const row = res.rows[0];
      if (row) {
        return {
          context: row.context || '',
          chatHistory: row.chatHistory || '[]',
          seen: row.seen !== false,
          rowId: row.$id
        };
      }
      return { context: '', chatHistory: '[]', seen: true };
    } catch (err) {
      console.error('[TelemetryService] Failed to load session:', err);
      return { context: '', chatHistory: '[]', seen: true };
    }
  },

  /**
   * Persists or updates the context and chat history session.
   */
  async saveSession(userId: string, context: string, chatHistory: string, seen = true, sessionId?: string): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      const targetSessionId = sessionId || (await this.loadSession(userId)).rowId;
      
      const payload = {
        userId,
        context,
        chatHistory,
        seen,
        isMemory: false
      };

      if (targetSessionId) {
        try {
          await tables.updateRow({
            databaseId: DATABASE_ID,
            tableId: 'agentic_sessions',
            rowId: targetSessionId,
            data: payload
          });
          return;
        } catch {}
      }

      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: 'agentic_sessions',
        rowId: targetSessionId || ID.unique(),
        data: payload
      });
    } catch (err) {
      console.error('[TelemetryService] Failed to save session:', err);
    }
  },

  /**
   * Retrieves the high-level lifetime memory context (C0) for the user.
   */
  async loadMemory(userId: string): Promise<{ context: string; rowId?: string }> {
    try {
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: 'agentic_sessions',
        queries: [
          Query.equal('userId', userId),
          Query.equal('isMemory', true),
          Query.limit(1)
        ]
      });
      const row = res.rows[0];
      if (row) {
        return {
          context: row.context || '',
          rowId: row.$id
        };
      }
      return { context: '' };
    } catch (err) {
      console.error('[TelemetryService] Failed to load memory:', err);
      return { context: '' };
    }
  },

  /**
   * Updates or inserts the persistent user memory context record.
   */
  async saveMemory(userId: string, context: string): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      const memory = await this.loadMemory(userId);
      const payload = {
        userId,
        context,
        isMemory: true,
        seen: true
      };

      if (memory.rowId) {
        await tables.updateRow({
          databaseId: DATABASE_ID,
          tableId: 'agentic_sessions',
          rowId: memory.rowId,
          data: payload
        });
      } else {
        await tables.createRow({
          databaseId: DATABASE_ID,
          tableId: 'agentic_sessions',
          rowId: ID.unique(),
          data: payload
        });
      }
    } catch (err) {
      console.error('[TelemetryService] Failed to save memory:', err);
    }
  },

  /**
   * Record highly anonymized telemetry with stripped pointers.
   */
  async recordAgenticTelemetry(params: {
    userId?: string;
    action: string;
    zone?: string;
    pointers?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      // Strips any potential user identifying tags from metadata object
      const cleanMeta: Record<string, any> = { ...params.metadata };
      delete cleanMeta.userId;
      delete cleanMeta.email;
      delete cleanMeta.name;
      delete cleanMeta.username;

      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: 'agentic_telemetry',
        rowId: ID.unique(),
        data: {
          userId: params.userId || 'anonymous',
          action: params.action,
          zone: params.zone || 'unknown',
          pointers: params.pointers || null,
          metadata: Object.keys(cleanMeta).length > 0 ? JSON.stringify(cleanMeta) : null,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('[TelemetryService] Failed to record agentic telemetry:', err);
    }
  }
};
