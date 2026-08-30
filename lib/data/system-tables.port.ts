import type { QueryExpression } from '@/lib/core/ports/database.port';

/** Object-shaped tables API used across API resources and services. */
export interface SystemTablesPort {
  getRow<T = any>(args: { databaseId: string; tableId: string; rowId: string }): Promise<T>;
  listRows<T = any>(args: {
    databaseId: string;
    tableId: string;
    queries?: QueryExpression[] | string[];
  }): Promise<{ total: number; rows: T[] }>;
  createRow<T = any>(args: {
    databaseId: string;
    tableId: string;
    rowId: string;
    data: Partial<T>;
    permissions?: string[];
  }): Promise<T>;
  updateRow<T = any>(args: {
    databaseId: string;
    tableId: string;
    rowId: string;
    data: Partial<T>;
    permissions?: string[];
  }): Promise<T>;
  deleteRow(args: { databaseId: string; tableId: string; rowId: string }): Promise<void>;
  incrementRowColumn(args: {
    databaseId: string;
    tableId: string;
    rowId: string;
    column: string;
    value?: number;
    max?: number;
  }): Promise<void>;
}
