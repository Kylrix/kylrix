import type { Models } from 'appwrite';

declare module 'appwrite' {
  export interface Databases {
    listRows<T = any>(databaseId: string, tableId: string, queries?: string[]): Promise<{ total: number; rows: T[] }>;
    getRow<T = any>(databaseId: string, tableId: string, rowId: string, queries?: string[]): Promise<T>;
    createRow<T = any>(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]): Promise<T>;
    updateRow<T = any>(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]): Promise<T>;
    deleteRow(databaseId: string, tableId: string, rowId: string): Promise<{}>;
    listDocuments<T = any>(databaseId: string, collectionId: string, queries?: string[]): Promise<Models.DocumentList<T> & { rows: T[] }>;
    getDocument<T = any>(databaseId: string, collectionId: string, documentId: string, queries?: string[]): Promise<T>;
    createDocument<T = any>(databaseId: string, collectionId: string, documentId: string, data: any, permissions?: string[]): Promise<T>;
    updateDocument<T = any>(databaseId: string, collectionId: string, documentId: string, data: any, permissions?: string[]): Promise<T>;
    deleteDocument(databaseId: string, collectionId: string, documentId: string): Promise<{}>;
  }

  export namespace Models {
    export interface Row {
      $id: string;
      $createdAt: string;
      $updatedAt: string;
      $permissions: string[];
      [key: string]: any;
    }
    export interface Document {
      $id: string;
      $createdAt: string;
      $updatedAt: string;
      $permissions: string[];
      [key: string]: any;
    }
  }
}

declare module 'node-appwrite' {
  export interface Databases {
    listRows<T = any>(databaseId: string, tableId: string, queries?: any[]): Promise<{ total: number; rows: T[] }>;
    getRow<T = any>(databaseId: string, tableId: string, rowId: string, queries?: any[]): Promise<T>;
    createRow<T = any>(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]): Promise<T>;
    updateRow<T = any>(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]): Promise<T>;
    deleteRow(databaseId: string, tableId: string, rowId: string): Promise<{}>;
    listDocuments<T = any>(databaseId: string, collectionId: string, queries?: any[]): Promise<Models.DocumentList<T> & { rows: T[] }>;
    getDocument<T = any>(databaseId: string, collectionId: string, documentId: string, queries?: any[]): Promise<T>;
    createDocument<T = any>(databaseId: string, collectionId: string, documentId: string, data: any, permissions?: string[]): Promise<T>;
    updateDocument<T = any>(databaseId: string, collectionId: string, documentId: string, data: any, permissions?: string[]): Promise<T>;
    deleteDocument(databaseId: string, collectionId: string, documentId: string): Promise<{}>;
  }

  export namespace Models {
    export interface Row {
      $id: string;
      $createdAt: string;
      $updatedAt: string;
      $permissions: string[];
      [key: string]: any;
    }
    export interface Document {
      $id: string;
      $createdAt: string;
      $updatedAt: string;
      $permissions: string[];
      [key: string]: any;
    }
  }
}
