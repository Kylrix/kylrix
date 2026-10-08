import { DatabasePort, QueryExpression, ListRowsResult } from '../../ports/database.port';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, desc, asc, like } from 'drizzle-orm';
import { AppwriteDatabaseAdapter } from '../appwrite/database.adapter';

export class TursoDatabaseAdapter implements DatabasePort {
  private fallbackAdapter = new AppwriteDatabaseAdapter();

  /**
   * Resolves the Drizzle table model by table name or Appwrite table ID.
   */
  private resolveTable(tableId: string): any {
    const key = (tableId || '').toLowerCase().replace(/[-_]/g, '');
    if (key.includes('note') || key.includes('idea')) return schema.notes;
    if (key.includes('goal') || key.includes('task')) return schema.goals;
    if (key.includes('projectobject') || key.includes('workspaceobject')) return schema.projectObjects;
    if (key.includes('project') || key.includes('workspace')) return schema.projects;
    if (key.includes('vault') || key.includes('vaultitem')) return schema.vaultItems;
    if (key.includes('keychain')) return schema.keychain;
    if (key.includes('totp') || key.includes('totpsecret')) return schema.totpSecrets;
    if (key.includes('usersetting') || key.includes('setting')) return schema.userSettings;
    if (key.includes('threadmessage')) return schema.threadMessages;
    if (key.includes('thread')) return schema.threads;
    if (key.includes('conversationmember')) return schema.conversationMembers;
    if (key.includes('conversation')) return schema.conversations;
    if (key.includes('message')) return schema.messages;
    if (key.includes('comment')) return schema.comments;
    if (key.includes('form')) return schema.forms;
    if (key.includes('event')) return schema.events;
    if (key.includes('agenticsession') || key.includes('agentsession')) return schema.agenticSessions;
    if (key.includes('subscription')) return schema.subscriptions;
    if (key.includes('wallet')) return schema.wallets;
    if (key.includes('coupon')) return schema.coupons;
    if (key.includes('context')) return schema.contexts;
    return null;
  }

  /**
   * Shapes a raw Drizzle/SQLite row into an Appwrite-compatible row record.
   */
  private shapeRow<T>(raw: any): T {
    if (!raw || typeof raw !== 'object') return raw;
    const createdAt = raw.createdAt instanceof Date
      ? raw.createdAt.toISOString()
      : (typeof raw.createdAt === 'number' ? new Date(raw.createdAt).toISOString() : String(raw.createdAt || new Date().toISOString()));
    const updatedAt = raw.updatedAt instanceof Date
      ? raw.updatedAt.toISOString()
      : (typeof raw.updatedAt === 'number' ? new Date(raw.updatedAt).toISOString() : String(raw.updatedAt || createdAt));

    return {
      ...raw,
      $id: raw.id || raw.$id,
      $createdAt: createdAt,
      $updatedAt: updatedAt,
      $databaseId: 'turso',
      $tableId: 'relational',
    } as unknown as T;
  }

  async getRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const table = this.resolveTable(tableId);
    if (!table) {
      return this.fallbackAdapter.getRow(databaseId, tableId, rowId, options);
    }

    try {
      const rows = await db.select().from(table).where(eq(table.id, rowId)).limit(1);
      if (rows.length > 0) {
        return this.shapeRow<T>(rows[0]);
      }
    } catch (err: any) {
      console.warn(`[TursoDatabaseAdapter] getRow ${tableId}/${rowId} error:`, err?.message);
    }

    // Fallback to Appwrite if not found in Turso
    return this.fallbackAdapter.getRow(databaseId, tableId, rowId, options);
  }

  async listRows<T>(
    databaseId: string,
    tableId: string,
    queries?: QueryExpression[] | string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<ListRowsResult<T>> {
    const table = this.resolveTable(tableId);
    if (!table) {
      return this.fallbackAdapter.listRows(databaseId, tableId, queries, options);
    }

    try {
      let limitVal = 50;
      let offsetVal = 0;
      let orderCol: any = table.createdAt || table.id;
      let isDesc = true;
      const conditions: any[] = [];

      if (Array.isArray(queries)) {
        for (const q of queries) {
          if (typeof q === 'string') {
            // Appwrite query string format: equal("userId", "123")
            const match = q.match(/^([a-zA-Z]+)\("([^"]+)"(?:,\s*(.+))?\)$/);
            if (match) {
              const type = match[1];
              const attr = match[2];
              let val = match[3];
              try { if (val) val = JSON.parse(val); } catch {}

              if (type === 'equal' && table[attr]) {
                conditions.push(eq(table[attr], val));
              } else if (type === 'limit') {
                limitVal = Number(attr) || limitVal;
              } else if (type === 'offset') {
                offsetVal = Number(attr) || offsetVal;
              } else if (type === 'orderDesc' && table[attr]) {
                orderCol = table[attr];
                isDesc = true;
              } else if (type === 'orderAsc' && table[attr]) {
                orderCol = table[attr];
                isDesc = false;
              }
            }
          } else if (q && typeof q === 'object') {
            const exp = q as QueryExpression;
            if (exp.type === 'equal' && exp.attribute && table[exp.attribute]) {
              conditions.push(eq(table[exp.attribute], exp.value));
            } else if (exp.type === 'limit') {
              limitVal = Number(exp.value) || limitVal;
            } else if (exp.type === 'offset') {
              offsetVal = Number(exp.value) || offsetVal;
            } else if (exp.type === 'orderDesc' && exp.attribute && table[exp.attribute]) {
              orderCol = table[exp.attribute];
              isDesc = true;
            } else if (exp.type === 'orderAsc' && exp.attribute && table[exp.attribute]) {
              orderCol = table[exp.attribute];
              isDesc = false;
            } else if (exp.type === 'search' && exp.attribute && table[exp.attribute]) {
              conditions.push(like(table[exp.attribute], `%${exp.value}%`));
            }
          }
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const queryBuilder = db
        .select()
        .from(table)
        .where(whereClause)
        .orderBy(isDesc ? desc(orderCol) : asc(orderCol))
        .limit(limitVal)
        .offset(offsetVal);

      const rows = await queryBuilder;
      if (rows.length > 0) {
        return {
          total: rows.length,
          rows: rows.map((r: any) => this.shapeRow<T>(r)),
        };
      }
    } catch (err: any) {
      console.warn(`[TursoDatabaseAdapter] listRows ${tableId} warning:`, err?.message);
    }

    // Fallback to Appwrite if no records in Turso
    return this.fallbackAdapter.listRows(databaseId, tableId, queries, options);
  }

  async createRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string | null,
    data: Partial<T>,
    permissions?: string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const table = this.resolveTable(tableId);
    const id = rowId || (data as any)?.id || (data as any)?.$id || crypto.randomUUID();
    const now = new Date().toISOString();

    if (table) {
      try {
        const insertData: any = {
          ...data,
          id,
          createdAt: (data as any)?.createdAt || (data as any)?.$createdAt || now,
          updatedAt: (data as any)?.updatedAt || (data as any)?.$updatedAt || now,
        };

        // Remove Appwrite system fields
        delete insertData.$id;
        delete insertData.$createdAt;
        delete insertData.$updatedAt;
        delete insertData.$permissions;
        delete insertData.$databaseId;
        delete insertData.$tableId;

        await db.insert(table).values(insertData);
        const createdRow = this.shapeRow<T>({ ...insertData, id });

        // Opportunistic background sync to Appwrite if available
        this.fallbackAdapter
          .createRow(databaseId, tableId, id, data, permissions, options)
          .catch(() => {});

        return createdRow;
      } catch (err: any) {
        console.warn(`[TursoDatabaseAdapter] createRow ${tableId}/${id} error:`, err?.message);
      }
    }

    return this.fallbackAdapter.createRow(databaseId, tableId, id, data, permissions, options);
  }

  async updateRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Partial<T>,
    permissions?: string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const table = this.resolveTable(tableId);
    const now = new Date().toISOString();

    if (table) {
      try {
        const updateData: any = {
          ...data,
          updatedAt: (data as any)?.updatedAt || (data as any)?.$updatedAt || now,
        };

        delete updateData.id;
        delete updateData.$id;
        delete updateData.$createdAt;
        delete updateData.$updatedAt;
        delete updateData.$permissions;
        delete updateData.$databaseId;
        delete updateData.$tableId;

        await db.update(table).set(updateData).where(eq(table.id, rowId));
        const updated = await this.getRow<T>(databaseId, tableId, rowId, options);

        // Opportunistic background sync to Appwrite
        this.fallbackAdapter
          .updateRow(databaseId, tableId, rowId, data, permissions, options)
          .catch(() => {});

        return updated;
      } catch (err: any) {
        console.warn(`[TursoDatabaseAdapter] updateRow ${tableId}/${rowId} error:`, err?.message);
      }
    }

    return this.fallbackAdapter.updateRow(databaseId, tableId, rowId, data, permissions, options);
  }

  async deleteRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<void> {
    const table = this.resolveTable(tableId);
    if (table) {
      try {
        await db.delete(table).where(eq(table.id, rowId));
      } catch (err: any) {
        console.warn(`[TursoDatabaseAdapter] deleteRow ${tableId}/${rowId} error:`, err?.message);
      }
    }

    // Opportunistic sync delete
    this.fallbackAdapter.deleteRow(databaseId, tableId, rowId, options).catch(() => {});
  }
}
