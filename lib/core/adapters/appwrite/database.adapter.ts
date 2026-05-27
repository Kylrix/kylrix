import { Query, TablesDB } from 'node-appwrite';
import { DatabasePort, QueryExpression, ListRowsResult } from '../../ports/database.port';
import { createServerClient } from '@/lib/appwrite/server';
import { createSystemTablesDB } from '@/lib/appwrite-admin';

export function mapQueryExpressions(expressions: QueryExpression[]): string[] {
  return expressions.map((exp) => {
    switch (exp.type) {
      case 'equal':
        return Query.equal(exp.attribute!, exp.value);
      case 'notEqual':
        return Query.notEqual(exp.attribute!, exp.value);
      case 'lessThan':
        return Query.lessThan(exp.attribute!, exp.value);
      case 'lessThanEqual':
        return Query.lessThanEqual(exp.attribute!, exp.value);
      case 'greaterThan':
        return Query.greaterThan(exp.attribute!, exp.value);
      case 'greaterThanEqual':
        return Query.greaterThanEqual(exp.attribute!, exp.value);
      case 'search':
        return Query.search(exp.attribute!, exp.value);
      case 'orderAsc':
        return Query.orderAsc(exp.attribute!);
      case 'orderDesc':
        return Query.orderDesc(exp.attribute!);
      case 'limit':
        return Query.limit(exp.value);
      case 'offset':
        return Query.offset(exp.value);
      case 'select':
        return Query.select(exp.value);
      case 'contains':
        return Query.contains(exp.attribute!, exp.value);
      default:
        throw new Error(`Unsupported query type: ${exp.type}`);
    }
  });
}

export class AppwriteDatabaseAdapter implements DatabasePort {
  private async getClientTables(jwt?: string, forceSystem?: boolean): Promise<TablesDB> {
    if (forceSystem) {
      return createSystemTablesDB();
    }
    
    if (jwt || typeof window === 'undefined') {
      try {
        const { client } = await createServerClient(jwt);
        return new TablesDB(client);
      } catch {
        // Fallback to system if context discovery fails
      }
    }
    return createSystemTablesDB();
  }

  async getRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const tables = await this.getClientTables(options?.jwt, options?.forceSystem);
    const res = await tables.getRow({
      databaseId,
      tableId,
      rowId,
    });
    return JSON.parse(JSON.stringify(res)) as T;
  }

  async listRows<T>(
    databaseId: string,
    tableId: string,
    queries?: QueryExpression[] | string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<ListRowsResult<T>> {
    const tables = await this.getClientTables(options?.jwt, options?.forceSystem);
    let mappedQueries: string[] = [];
    if (queries) {
      if (queries.length > 0 && typeof queries[0] === 'string') {
        mappedQueries = queries as string[];
      } else {
        mappedQueries = mapQueryExpressions(queries as QueryExpression[]);
      }
    }
    
    const res = await tables.listRows({
      databaseId,
      tableId,
      queries: mappedQueries as any[],
    });

    return {
      total: res.total,
      rows: JSON.parse(JSON.stringify(res.rows)) as T[],
    };
  }

  async createRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string | null,
    data: Partial<T>,
    permissions?: string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const { ID } = await import('node-appwrite');
    const tables = await this.getClientTables(options?.jwt, options?.forceSystem);
    const res = await tables.createRow({
      databaseId,
      tableId,
      rowId: rowId || ID.unique(),
      data: data as any,
      permissions,
    });
    return JSON.parse(JSON.stringify(res)) as T;
  }

  async updateRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Partial<T>,
    permissions?: string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T> {
    const tables = await this.getClientTables(options?.jwt, options?.forceSystem);
    const res = await tables.updateRow({
      databaseId,
      tableId,
      rowId,
      data: data as any,
      permissions,
    });
    return JSON.parse(JSON.stringify(res)) as T;
  }

  async deleteRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<void> {
    const tables = await this.getClientTables(options?.jwt, options?.forceSystem);
    await tables.deleteRow({
      databaseId,
      tableId,
      rowId,
    });
  }
}
