/**
 * TablesDB row helpers are proxied onto Databases in client/admin.
 */
import 'node-appwrite';
import 'appwrite';

declare module 'node-appwrite' {
  interface Databases {
    listRows: any;
    getRow: any;
    createRow: any;
    updateRow: any;
    deleteRow: any;
  }
}

declare module 'appwrite' {
  interface Databases {
    listRows: any;
    getRow: any;
    createRow: any;
    updateRow: any;
    deleteRow: any;
  }
}

export {};
