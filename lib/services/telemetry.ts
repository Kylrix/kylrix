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
          Query.orderDesc('$updatedAt'),
          Query.limit(20)
        ]
      });
      const withHistory = (res.rows || []).find((row: any) => {
        try {
          const hist = JSON.parse(row.chatHistory || '[]');
          return Array.isArray(hist) && hist.length > 0;
        } catch {
          return false;
        }
      });
      const row = withHistory || res.rows?.[0];
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
  },

  /**
   * Records a workspace object created/touched by an agentic tool in the active session.
   * Powers session object widgets and gives the model durable object pointers.
   */
  async recordSessionObject(params: {
    userId: string;
    sessionId: string;
    objectId: string;
    objectType: string;
    title?: string | null;
    toolKey?: string | null;
  }): Promise<void> {
    try {
      if (!params.userId || !params.sessionId || !params.objectId || !params.objectType) return;
      const tables = createSystemTablesDB();
      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: 'session_objects',
        rowId: ID.unique(),
        data: {
          userId: params.userId,
          sessionId: params.sessionId,
          objectId: params.objectId,
          objectType: params.objectType,
          title: params.title ? String(params.title).slice(0, 256) : null,
          toolKey: params.toolKey || null,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[TelemetryService] Failed to record session object:', err);
    }
  },

  /**
   * Lists objects created in a session (newest first). Dedupes by objectId keeping latest title.
   */
  async listSessionObjects(
    userId: string,
    sessionId: string,
    limit = 40,
  ): Promise<Array<{ objectId: string; objectType: string; title: string | null; toolKey: string | null; createdAt: string | null }>> {
    try {
      if (!userId || !sessionId) return [];
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: 'session_objects',
        queries: [
          Query.equal('userId', userId),
          Query.equal('sessionId', sessionId),
          Query.orderDesc('$createdAt'),
          Query.limit(limit),
        ],
      });
      const seen = new Set<string>();
      const out: Array<{ objectId: string; objectType: string; title: string | null; toolKey: string | null; createdAt: string | null }> = [];
      for (const row of res.rows || []) {
        const objectId = String(row.objectId || '');
        if (!objectId || seen.has(objectId)) continue;
        seen.add(objectId);
        out.push({
          objectId,
          objectType: String(row.objectType || 'idea'),
          title: row.title != null ? String(row.title) : null,
          toolKey: row.toolKey != null ? String(row.toolKey) : null,
          createdAt: row.createdAt != null ? String(row.createdAt) : (row.$createdAt || null),
        });
      }
      return out;
    } catch (err) {
      console.error('[TelemetryService] Failed to list session objects:', err);
      return [];
    }
  },

  /**
   * Persist one agent tool invocation against a session + conversation reply id.
   */
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
    try {
      if (!params.userId || !params.sessionId || !params.conversationId || !params.toolKey) return null;
      const tables = createSystemTablesDB();
      const rowId = ID.unique();
      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: 'tool_calls',
        rowId,
        data: {
          userId: params.userId,
          sessionId: params.sessionId,
          conversationId: params.conversationId,
          toolKey: params.toolKey,
          specifier: params.specifier || null,
          args: params.args ? JSON.stringify(params.args).slice(0, 7800) : null,
          status: params.status || 'success',
          resultSummary: params.resultSummary ? String(params.resultSummary).slice(0, 512) : null,
          createdAt: new Date().toISOString(),
        },
      });
      return rowId;
    } catch (err) {
      console.error('[TelemetryService] Failed to record tool call:', err);
      return null;
    }
  },

  async listToolCalls(
    userId: string,
    sessionId: string,
    limit = 100,
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
      if (!userId || !sessionId) return [];
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: 'tool_calls',
        queries: [
          Query.equal('userId', userId),
          Query.equal('sessionId', sessionId),
          Query.orderAsc('$createdAt'),
          Query.limit(limit),
        ],
      });
      return (res.rows || []).map((row: any) => ({
        $id: row.$id,
        conversationId: String(row.conversationId || ''),
        toolKey: String(row.toolKey || ''),
        specifier: row.specifier != null ? String(row.specifier) : null,
        args: row.args != null ? String(row.args) : null,
        status: row.status != null ? String(row.status) : null,
        resultSummary: row.resultSummary != null ? String(row.resultSummary) : null,
        createdAt: row.createdAt != null ? String(row.createdAt) : (row.$createdAt || null),
      }));
    } catch (err) {
      console.error('[TelemetryService] Failed to list tool calls:', err);
      return [];
    }
  },
};
