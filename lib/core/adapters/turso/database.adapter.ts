import { DatabasePort, QueryExpression, ListRowsResult } from '../../ports/database.port';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, ne, lt, lte, gt, gte, and, desc, asc, like, isNull, isNotNull, sql } from 'drizzle-orm';
import { broadcastRealtimeEvent } from '@/lib/realtime/partykit';

const TABLE_MAP: Record<string, any> = {
  // Appwrite collection IDs
  '67ff05f3002502ef239e': schema.ideas,
  '67ff06280034908cf08a': schema.tags,
  '67ff05c900247b5673d3': schema.user,
  '67ff064400263631ffe4': schema.apikey,
  '67ff065a003e2bb950f7': schema.ideas, // blogposts

  // Relational domain tables
  'ideas': schema.ideas,
  'notes': schema.ideas,
  'note': schema.ideas,
  'idea': schema.ideas,
  'tasks': schema.goals,
  'goals': schema.goals,
  'task': schema.goals,
  'goal': schema.goals,
  'workspaces': schema.workspaces,
  'workspace': schema.workspaces,
  'projects': schema.workspaces,
  'project': schema.workspaces,
  'workspaceobjects': schema.workspaceObjects,
  'workspace_objects': schema.workspaceObjects,
  'projectobjects': schema.workspaceObjects,
  'project_objects': schema.workspaceObjects,
  'objects': schema.objects,
  'object': schema.objects,
  'vaultitems': schema.vaultItems,
  'vault_items': schema.vaultItems,
  'credentials': schema.vaultItems,
  'credential': schema.vaultItems,
  'keychain': schema.keychain,
  'totpsecrets': schema.totpSecrets,
  'totp_secrets': schema.totpSecrets,
  'totp': schema.totpSecrets,
  'usersettings': schema.userSettings,
  'user_settings': schema.userSettings,
  'settings': schema.userSettings,
  'setting': schema.userSettings,
  'collaborators': schema.collaborators,
  'collaborator': schema.collaborators,
  'comments': schema.comments,
  'comment': schema.comments,
  'reactions': schema.reactions,
  'reaction': schema.reactions,
  'threads': schema.threads,
  'thread': schema.threads,
  'threadmessages': schema.threadMessages,
  'thread_messages': schema.threadMessages,
  'forms': schema.forms,
  'form': schema.forms,
  'formsubmissions': schema.formSubmissions,
  'form_submissions': schema.formSubmissions,
  'events': schema.events,
  'event': schema.events,
  'calendars': schema.calendars,
  'calendar': schema.calendars,
  'eventguests': schema.eventGuests,
  'event_guests': schema.eventGuests,
  'agenticsessions': schema.agenticSessions,
  'agentic_sessions': schema.agenticSessions,
  'agentsessions': schema.agenticSessions,
  'agent_sessions': schema.agenticSessions,
  'toolcalls': schema.toolCalls,
  'tool_calls': schema.toolCalls,
  'agentictelemetry': schema.agenticTelemetry,
  'agentic_telemetry': schema.agenticTelemetry,
  'sessionobjects': schema.sessionObjects,
  'session_objects': schema.sessionObjects,
  'conversations': schema.conversations,
  'conversation': schema.conversations,
  'conversationmembers': schema.conversationMembers,
  'conversation_members': schema.conversationMembers,
  'messages': schema.messages,
  'message': schema.messages,
  'callsignals': schema.callSignals,
  'call_signals': schema.callSignals,
  'workflows': schema.workflows,
  'workflow': schema.workflows,
  'flowinstalls': schema.flowInstalls,
  'flow_installs': schema.flowInstalls,
  'flowreviews': schema.flowReviews,
  'flow_reviews': schema.flowReviews,
  'profiles': schema.profiles,
  'profile': schema.profiles,
  'userbadges': schema.userBadges,
  'user_badges': schema.userBadges,
  'referrals': schema.referrals,
  'referral': schema.referrals,
  'sponsorships': schema.sponsorships,
  'sponsorship': schema.sponsorships,
  'wallets': schema.wallets,
  'wallet': schema.wallets,
  'web3transactions': schema.web3Transactions,
  'web3_transactions': schema.web3Transactions,
  'computeledger': schema.computeLedger,
  'compute_ledger': schema.computeLedger,
  'computebalances': schema.computeBalances,
  'compute_balances': schema.computeBalances,
  'kylrixtokenledger': schema.kylrixTokenLedger,
  'kylrix_token_ledger': schema.kylrixTokenLedger,
  'coupons': schema.coupons,
  'coupon': schema.coupons,
  'billingtransactions': schema.billingTransactions,
  'billing_transactions': schema.billingTransactions,
  'billingwebhooklogs': schema.billingWebhookLogs,
  'billing_webhook_logs': schema.billingWebhookLogs,
  'accountledger': schema.accountLedger,
  'account_ledger': schema.accountLedger,
  'telegramconnections': schema.telegramConnections,
  'telegram_connections': schema.telegramConnections,
  'tags': schema.tags,
  'tag': schema.tags,
  'resourcetags': schema.resourceTags,
  'resource_tags': schema.resourceTags,
  'notetags': schema.resourceTags,
  'note_tags': schema.resourceTags,
  'contexts': schema.contexts,
  'context': schema.contexts,
  'externalcontexts': schema.externalContexts,
  'external_contexts': schema.externalContexts,
  'knowledgegraph': schema.knowledgeGraph,
  'knowledge_graph': schema.knowledgeGraph,
  'patterns': schema.patterns,
  'pattern': schema.patterns,
  'agentbyokkeys': schema.agentByokKeys,
  'agent_byok_keys': schema.agentByokKeys,
  'agentpaymentintents': schema.agentPaymentIntents,
  'agent_payment_intents': schema.agentPaymentIntents,
  'userconveniencesessions': schema.userConvenienceSessions,
  'user_convenience_sessions': schema.userConvenienceSessions,
  'securitylogs': schema.securityLogs,
  'security_logs': schema.securityLogs,
  'keymapping': schema.keyMapping,
  'key_mapping': schema.keyMapping,
  'userresourcepins': schema.userResourcePins,
  'user_resource_pins': schema.userResourcePins,
  'extensions': schema.extensions,
  'extension': schema.extensions,
  'activitylog': schema.activityLog,
  'activity_log': schema.activityLog,
  'follows': schema.follows,
  'follow': schema.follows,
  'epochs': schema.epochs,
  'epoch': schema.epochs,
  'joinrequests': schema.joinRequests,
  'join_requests': schema.joinRequests,
  'unorganicemails': schema.unorganicEmails,
  'unorganic_emails': schema.unorganicEmails,
  'sourcecontrol': schema.sourceControl,
  'source_control': schema.sourceControl,
  'agents': schema.agents,
  'agent': schema.agents,
  'notifications': schema.notifications,
  'notification': schema.notifications,
  'patratestate': schema.patRateState,
  'pat_rate_state': schema.patRateState,
  'apiuserratestate': schema.apiUserRateState,
  'api_user_rate_state': schema.apiUserRateState,
  'user': schema.user,
  'users': schema.user,
  'session': schema.session,
  'sessions': schema.session,
  'account': schema.account,
  'accounts': schema.account,
  'verification': schema.verification,
  'verifications': schema.verification,
  'twofactor': schema.twoFactor,
  'two_factor': schema.twoFactor,
  'passkey': schema.passkey,
  'passkeys': schema.passkey,
  'apikey': schema.apikey,
  'apikeys': schema.apikey,
  'pats': schema.apikey,
  'pat': schema.apikey,
  'jwks': schema.jwks,
  'oauthclient': schema.oauthClient,
  'oauth_client': schema.oauthClient,
  'oauthapps': schema.oauthClient,
  'oauth_apps': schema.oauthClient,
  'oauthresource': schema.oauthResource,
  'oauth_resource': schema.oauthResource,
  'oauthclientresource': schema.oauthClientResource,
  'oauth_client_resource': schema.oauthClientResource,
  'oauthrefreshtoken': schema.oauthRefreshToken,
  'oauth_refresh_token': schema.oauthRefreshToken,
  'oauthaccesstoken': schema.oauthAccessToken,
  'oauth_access_token': schema.oauthAccessToken,
  'oauthconsent': schema.oauthConsent,
  'oauth_consent': schema.oauthConsent,
  'oauthconsentrequests': schema.oauthConsent,
  'oauth_consent_requests': schema.oauthConsent,
  'oauthclientassertion': schema.oauthClientAssertion,
  'oauth_client_assertion': schema.oauthClientAssertion,
  'subscriptions': schema.subscriptions,
  'subscription': schema.subscriptions,
};

export class TursoDatabaseAdapter implements DatabasePort {
  /**
   * Resolves the Drizzle table model by table name or Appwrite table ID.
   */
  private resolveTable(tableId: string): any {
    const raw = (tableId || '').trim();
    if (TABLE_MAP[raw]) return TABLE_MAP[raw];
    const key = raw.toLowerCase().replace(/[-_]/g, '');
    if (TABLE_MAP[key]) return TABLE_MAP[key];

    // Fallback prefix / containment matching
    for (const [k, v] of Object.entries(TABLE_MAP)) {
      if (key.includes(k) || k.includes(key)) {
        return v;
      }
    }
    return null;
  }

  /**
   * Resolves the table column reference case-insensitively, supporting snake_case,
   * camelCase, and Appwrite system attributes ($id, $createdAt, etc.).
   */
  private getColumn(table: any, attr: string): any {
    if (!table || !attr) return undefined;
    if (attr === '$id' && table.id) return table.id;
    if (attr === '$createdAt' && table.createdAt) return table.createdAt;
    if (attr === '$updatedAt' && table.updatedAt) return table.updatedAt;

    if (table[attr]) return table[attr];

    const camel = attr.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
    if (table[camel]) return table[camel];

    const snake = attr.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (table[snake]) return table[snake];

    const lowerAttr = attr.toLowerCase().replace(/[-_]/g, '');
    for (const k of Object.keys(table)) {
      if (k.toLowerCase().replace(/[-_]/g, '') === lowerAttr) {
        return table[k];
      }
    }
    return undefined;
  }

  /**
   * Shapes a raw Drizzle/SQLite row into an Appwrite-compatible row record.
   */
  private shapeRow<T>(raw: any, tableId?: string): T {
    if (!raw || typeof raw !== 'object') return raw;
    const createdAt = raw.createdAt instanceof Date
      ? raw.createdAt.toISOString()
      : (typeof raw.createdAt === 'number'
          ? new Date(raw.createdAt).toISOString()
          : String(raw.createdAt || new Date().toISOString()));

    const updatedAt = raw.updatedAt instanceof Date
      ? raw.updatedAt.toISOString()
      : (typeof raw.updatedAt === 'number'
          ? new Date(raw.updatedAt).toISOString()
          : String(raw.updatedAt || createdAt));

    return {
      ...raw,
      $id: raw.id || raw.$id,
      $createdAt: createdAt,
      $updatedAt: updatedAt,
      $databaseId: 'turso',
      $tableId: tableId || 'relational',
    } as unknown as T;
  }

  async getRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    _options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const table = this.resolveTable(tableId);
    if (!table) {
      throw new Error(`[TursoDatabaseAdapter] Table not mapped: "${tableId}"`);
    }

    try {
      const rows = await db.select().from(table).where(eq(table.id, rowId)).limit(1);
      if (rows.length > 0) {
        return this.shapeRow<T>(rows[0], tableId);
      }
    } catch (err: any) {
      console.warn(`[TursoDatabaseAdapter] getRow ${tableId}/${rowId} error:`, err?.message || err);
      throw err;
    }

    throw new Error(`Document with ID "${rowId}" not found in table "${tableId}".`);
  }

  async listRows<T>(
    databaseId: string,
    tableId: string,
    queries?: QueryExpression[] | string[],
    _options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<ListRowsResult<T>> {
    const table = this.resolveTable(tableId);
    if (!table) {
      console.warn(`[TursoDatabaseAdapter] Table not mapped for listRows: "${tableId}"`);
      return { total: 0, rows: [] };
    }

    try {
      let limitVal = 100;
      let offsetVal = 0;
      let orderCol: any = table.createdAt || table.id;
      let isDesc = true;
      const conditions: any[] = [];

      if (Array.isArray(queries)) {
        for (const q of queries) {
          if (typeof q === 'string') {
            // Appwrite query string format: equal("userId", "123") or limit(50)
            const match = q.match(/^([a-zA-Z]+)\("([^"]+)"(?:,\s*(.+))?\)$/);
            if (match) {
              const type = match[1];
              const attr = match[2];
              let val = match[3];
              try { if (val) val = JSON.parse(val); } catch {}

              const col = this.getColumn(table, attr);

              if (type === 'equal' && col) {
                conditions.push(eq(col, val));
              } else if (type === 'notEqual' && col) {
                conditions.push(ne(col, val));
              } else if (type === 'lessThan' && col) {
                conditions.push(lt(col, val));
              } else if (type === 'lessThanEqual' && col) {
                conditions.push(lte(col, val));
              } else if (type === 'greaterThan' && col) {
                conditions.push(gt(col, val));
              } else if (type === 'greaterThanEqual' && col) {
                conditions.push(gte(col, val));
              } else if (type === 'search' && col) {
                conditions.push(like(col, `%${val}%`));
              } else if (type === 'contains' && col) {
                conditions.push(like(col, `%${val}%`));
              } else if (type === 'startsWith' && col) {
                conditions.push(like(col, `${val}%`));
              } else if (type === 'endsWith' && col) {
                conditions.push(like(col, `%${val}`));
              } else if (type === 'isNull' && col) {
                conditions.push(isNull(col));
              } else if (type === 'isNotNull' && col) {
                conditions.push(isNotNull(col));
              } else if (type === 'limit') {
                limitVal = Number(attr) || limitVal;
              } else if (type === 'offset') {
                offsetVal = Number(attr) || offsetVal;
              } else if (type === 'orderDesc' && col) {
                orderCol = col;
                isDesc = true;
              } else if (type === 'orderAsc' && col) {
                orderCol = col;
                isDesc = false;
              }
            }
          } else if (q && typeof q === 'object') {
            const exp = q as QueryExpression;
            const col = exp.attribute ? this.getColumn(table, exp.attribute) : undefined;

            if (exp.type === 'equal' && col) {
              conditions.push(eq(col, exp.value));
            } else if (exp.type === 'notEqual' && col) {
              conditions.push(ne(col, exp.value));
            } else if (exp.type === 'lessThan' && col) {
              conditions.push(lt(col, exp.value));
            } else if (exp.type === 'lessThanEqual' && col) {
              conditions.push(lte(col, exp.value));
            } else if (exp.type === 'greaterThan' && col) {
              conditions.push(gt(col, exp.value));
            } else if (exp.type === 'greaterThanEqual' && col) {
              conditions.push(gte(col, exp.value));
            } else if (exp.type === 'search' && col) {
              conditions.push(like(col, `%${exp.value}%`));
            } else if (exp.type === 'contains' && col) {
              conditions.push(like(col, `%${exp.value}%`));
            } else if (exp.type === 'limit') {
              limitVal = Number(exp.value) || limitVal;
            } else if (exp.type === 'offset') {
              offsetVal = Number(exp.value) || offsetVal;
            } else if (exp.type === 'orderDesc' && col) {
              orderCol = col;
              isDesc = true;
            } else if (exp.type === 'orderAsc' && col) {
              orderCol = col;
              isDesc = false;
            }
          }
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db
        .select()
        .from(table)
        .where(whereClause)
        .orderBy(isDesc ? desc(orderCol) : asc(orderCol))
        .limit(limitVal)
        .offset(offsetVal);

      return {
        total: rows.length,
        rows: rows.map((r: any) => this.shapeRow<T>(r, tableId)),
      };
    } catch (err: any) {
      console.warn(`[TursoDatabaseAdapter] listRows ${tableId} error:`, err?.message || err);
      return { total: 0, rows: [] };
    }
  }

  async createRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string | null,
    data: Partial<T>,
    _permissions?: string[],
    _options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const table = this.resolveTable(tableId);
    if (!table) {
      throw new Error(`[TursoDatabaseAdapter] Cannot createRow: Table not mapped: "${tableId}"`);
    }

    const id = rowId || (data as any)?.id || (data as any)?.$id || crypto.randomUUID();
    const now = new Date().toISOString();

    const insertData: Record<string, any> = {
      id,
      createdAt: (data as any)?.createdAt || (data as any)?.$createdAt || now,
      updatedAt: (data as any)?.updatedAt || (data as any)?.$updatedAt || now,
    };

    // Filter and sanitize payload attributes to match valid table columns
    const validKeys = new Set(Object.keys(table));
    for (const [k, v] of Object.entries(data || {})) {
      if (k.startsWith('$') || k === 'id') continue;
      if (validKeys.has(k)) {
        insertData[k] = v;
      } else {
        const camel = k.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
        if (validKeys.has(camel)) {
          insertData[camel] = v;
        }
      }
    }

    try {
      await db.insert(table).values(insertData);
      const shaped = this.shapeRow<T>(insertData, tableId);
      broadcastRealtimeEvent({
        databaseId,
        tableId,
        rowId: id,
        action: 'create',
        payload: shaped,
      }).catch(() => {});
      return shaped;
    } catch (err: any) {
      // If conflicting primary key, perform update
      if (err?.message?.includes('UNIQUE constraint') || err?.message?.includes('PRIMARY KEY')) {
        return this.updateRow<T>(databaseId, tableId, id, data, _permissions, _options);
      }
      console.error(`[TursoDatabaseAdapter] createRow ${tableId}/${id} error:`, err?.message || err);
      throw err;
    }
  }

  async updateRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Partial<T>,
    _permissions?: string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const table = this.resolveTable(tableId);
    if (!table) {
      throw new Error(`[TursoDatabaseAdapter] Cannot updateRow: Table not mapped: "${tableId}"`);
    }

    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      updatedAt: (data as any)?.updatedAt || (data as any)?.$updatedAt || now,
    };

    const validKeys = new Set(Object.keys(table));
    for (const [k, v] of Object.entries(data || {})) {
      if (k.startsWith('$') || k === 'id') continue;
      if (validKeys.has(k)) {
        updateData[k] = v;
      } else {
        const camel = k.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
        if (validKeys.has(camel)) {
          updateData[camel] = v;
        }
      }
    }

    try {
      await db.update(table).set(updateData).where(eq(table.id, rowId));
      const updated = await this.getRow<T>(databaseId, tableId, rowId, options);
      broadcastRealtimeEvent({
        databaseId,
        tableId,
        rowId,
        action: 'update',
        payload: updated,
      }).catch(() => {});
      return updated;
    } catch (err: any) {
      console.error(`[TursoDatabaseAdapter] updateRow ${tableId}/${rowId} error:`, err?.message || err);
      throw err;
    }
  }

  async deleteRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    _options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<void> {
    const table = this.resolveTable(tableId);
    if (!table) {
      console.warn(`[TursoDatabaseAdapter] deleteRow: Table not mapped: "${tableId}"`);
      return;
    }

    try {
      await db.delete(table).where(eq(table.id, rowId));
      broadcastRealtimeEvent({
        databaseId,
        tableId,
        rowId,
        action: 'delete',
        payload: { $id: rowId, id: rowId, isDeleted: true },
      }).catch(() => {});
    } catch (err: any) {
      console.error(`[TursoDatabaseAdapter] deleteRow ${tableId}/${rowId} error:`, err?.message || err);
      throw err;
    }
  }

  async incrementRowColumn(
    input: {
      databaseId: string;
      tableId: string;
      rowId: string;
      column: string;
      value?: number;
      max?: number;
    },
    _options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<void> {
    const table = this.resolveTable(input.tableId);
    if (!table) return;
    const col = this.getColumn(table, input.column);
    if (!col) return;
    const incrementBy = input.value ?? 1;

    try {
      await db.update(table).set({
        [input.column]: sql`${col} + ${incrementBy}`
      }).where(eq(table.id, input.rowId));
      this.getRow(input.databaseId, input.tableId, input.rowId).then((updated) => {
        broadcastRealtimeEvent({
          databaseId: input.databaseId,
          tableId: input.tableId,
          rowId: input.rowId,
          action: 'update',
          payload: updated,
        }).catch(() => {});
      }).catch(() => {});
    } catch (err: any) {
      console.error(`[TursoDatabaseAdapter] incrementRowColumn error:`, err?.message || err);
    }
  }
}
