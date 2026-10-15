import { account } from '@/lib/appwrite';
export { account };

export const client = {
  setEndpoint: () => client,
  setProject: () => client,
};

export const tablesDB = {
  listRows: async () => ({ total: 0, rows: [] }),
  getRow: async () => null,
  createRow: async (_dbId: string, _tableId: string, _rowId: string, data: any) => data,
  updateRow: async (_dbId: string, _tableId: string, _rowId: string, data: any) => data,
  deleteRow: async () => {},
};

export const databases = {
  listDocuments: async () => ({ total: 0, documents: [], rows: [] }),
  getDocument: async () => null,
  createDocument: async (_dbId: string, _colId: string, _docId: string, data: any) => data,
  updateDocument: async (_dbId: string, _colId: string, _docId: string, data: any) => data,
  deleteDocument: async () => {},
};

export const realtime = {
  subscribe: () => () => {},
};

export const storage = {
  getFilePreview: () => '',
  getFileView: () => '',
};

export const functions = {
  createExecution: async () => ({}),
};

export function getCurrentUserSnapshot(): any {
  return null;
}

export async function getCurrentUser(): Promise<any> {
  return null;
}

export function onCurrentUserChanged(_listener: any): () => void {
  return () => {};
}

export function invalidateCurrentUserCache(): void {}

export function getKylrixPulse(): any {
  return null;
}

export function hasAuthSessionHint(): boolean {
  return false;
}
