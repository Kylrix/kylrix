import type { Models } from 'appwrite';

declare module 'appwrite' {
  export interface Databases {
    listRows<T extends Models.Row>(databaseId: string, tableId: string, queries?: string[]): Promise<Models.RowList<T>>;
    getRow<T extends Models.Row>(databaseId: string, tableId: string, rowId: string, queries?: string[]): Promise<T>;
    createRow<T extends Models.Row>(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]): Promise<T>;
    updateRow<T extends Models.Row>(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]): Promise<T>;
    deleteRow(databaseId: string, tableId: string, rowId: string): Promise<{}>;
  }

  export namespace Models {
    export interface DocumentList<Document extends Models.Document> {
      rows: Document[];
    }
    export interface Row {
      $id: string;
      $createdAt: string;
      $updatedAt: string;
      $permissions: string[];
      [key: string]: any;
    }
    export interface RowList<Row extends Models.Row> {
      total: number;
      rows: Row[];
    }
  }
}

declare module 'node-appwrite' {
  export interface Databases {
    listRows<T extends Models.Row>(databaseId: string, tableId: string, queries?: any[]): Promise<Models.RowList<T>>;
    getRow<T extends Models.Row>(databaseId: string, tableId: string, rowId: string, queries?: any[]): Promise<T>;
    createRow<T extends Models.Row>(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]): Promise<T>;
    updateRow<T extends Models.Row>(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]): Promise<T>;
    deleteRow(databaseId: string, tableId: string, rowId: string): Promise<{}>;
  }

  export namespace Models {
    export interface DocumentList<Document extends Models.Document> {
      rows: Document[];
    }
    export interface Row {
      $id: string;
      $createdAt: string;
      $updatedAt: string;
      $permissions: string[];
      [key: string]: any;
    }
    export interface RowList<Row extends Models.Row> {
      total: number;
      rows: Row[];
    }
  }
}
