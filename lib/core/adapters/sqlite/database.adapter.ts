import { DatabasePort, QueryExpression, ListRowsResult } from '../../ports/database.port';
import * as fs from 'fs';
import * as path from 'path';

export class SqliteDatabaseAdapter implements DatabasePort {
  private getDbPath(): string {
    return path.join(process.cwd(), 'sqlite.json');
  }

  private readDb(): Record<string, Record<string, Record<string, any>>> {
    const p = this.getDbPath();
    if (!fs.existsSync(p)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return {};
    }
  }

  private writeDb(data: any) {
    fs.writeFileSync(this.getDbPath(), JSON.stringify(data, null, 2), 'utf8');
  }

  async getRow<T>(databaseId: string, tableId: string, rowId: string): Promise<T> {
    const db = this.readDb();
    const row = db[databaseId]?.[tableId]?.[rowId];
    if (!row) throw new Error('Row not found');
    return row as T;
  }

  async listRows<T>(databaseId: string, tableId: string, queries?: QueryExpression[] | string[]): Promise<ListRowsResult<T>> {
    const db = this.readDb();
    const table = db[databaseId]?.[tableId] || {};
    let rows = Object.values(table);

    if (queries && Array.isArray(queries)) {
      for (const q of queries) {
        if (typeof q === 'object' && q.type === 'equal' && q.attribute) {
          rows = rows.filter((r: any) => r[q.attribute!] === q.value);
        } else if (typeof q === 'object' && q.type === 'contains' && q.attribute) {
          rows = rows.filter((r: any) => String(r[q.attribute!]).toLowerCase().includes(String(q.value).toLowerCase()));
        }
      }
    }

    return {
      total: rows.length,
      rows: rows as T[],
    };
  }

  async createRow<T>(databaseId: string, tableId: string, rowId: string | null, data: Partial<T>): Promise<T> {
    const db = this.readDb();
    if (!db[databaseId]) db[databaseId] = {};
    if (!db[databaseId][tableId]) db[databaseId][tableId] = {};

    const id = rowId || Math.random().toString(36).substring(2, 15);
    const row = { ...data, $id: id, id } as any;

    db[databaseId][tableId][id] = row;
    this.writeDb(db);
    return row as T;
  }

  async updateRow<T>(databaseId: string, tableId: string, rowId: string, data: Partial<T>): Promise<T> {
    const db = this.readDb();
    const existing = db[databaseId]?.[tableId]?.[rowId];
    if (!existing) throw new Error('Row not found');

    const updated = { ...existing, ...data };
    db[databaseId][tableId][rowId] = updated;
    this.writeDb(db);
    return updated as T;
  }

  async deleteRow(databaseId: string, tableId: string, rowId: string): Promise<void> {
    const db = this.readDb();
    if (db[databaseId]?.[tableId]?.[rowId]) {
      delete db[databaseId][tableId][rowId];
      this.writeDb(db);
    }
  }
}
