/**
 * TablesDB row helpers are proxied onto Databases in client/admin.
 */
import 'appwrite';

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
