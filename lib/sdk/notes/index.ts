import { ID, type Models } from 'appwrite';
import { createCrossObjectMetadata, type CrossObjectOrigin } from '../orchestration';

export interface NoteCreationContext<NoteRow = Models.Document> {
  databaseId: string;
  tableId: string;
  getCurrentUser: () => Promise<{ $id: string } | null>;
  createRow: <T = unknown>(databaseId: string, tableId: string, data: T, rowId?: string, permissions?: string[]) => Promise<NoteRow>;
  getNote: (noteId: string) => Promise<NoteRow>;
  getNotePermissions: (userId: string, isPublic: boolean) => string[];
  cleanDocumentData: <T>(data: Partial<T>) => Record<string, unknown>;
  filterNoteData: (data: Record<string, unknown>) => Record<string, unknown>;
  syncTags?: (params: { noteId: string; rawTags: string[]; userId: string; now: string }) => Promise<void>;
}

export interface NoteCreationInput {
  title: string;
  content?: string;
  format?: 'text' | 'doodle';
  tags?: string[];
  isPublic?: boolean;
  origin?: CrossObjectOrigin | null;
  metadata?: Record<string, unknown>;
  attachments?: unknown[];
}

export function createNoteCreationService<NoteRow = Models.Document>(deps: NoteCreationContext<NoteRow>) {
  return {
    async createNote(data: NoteCreationInput) {
      const user = await deps.getCurrentUser();
      if (!user?.$id) {
        throw new Error('User not authenticated');
      }

      const now = new Date().toISOString();
      const docId = ID.unique();
      const cleanData = deps.cleanDocumentData(data);
      const noteData = { ...cleanData } as Record<string, unknown>;
      delete noteData.attachments;

      const metadataInput = data.metadata;
      const extraMetadata = (() => {
        if (typeof metadataInput === 'string') {
          try {
            return JSON.parse(metadataInput);
          } catch {
            return { _raw: metadataInput };
          }
        }
        return metadataInput || {};
      })();
      const originMetadata = data.origin ? createCrossObjectMetadata(data.origin, { extra: extraMetadata }) : extraMetadata;
      const baseMetadata = (() => {
        const raw = noteData.metadata;
        if (raw && typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return { _raw: raw };
          }
        }
        if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
        return {};
      })();

      const payload = deps.filterNoteData({
        ...noteData,
        id: docId,
        userId: user.$id,
        createdAt: now,
        updatedAt: now,
        attachments: null,
        metadata: JSON.stringify({
          ...baseMetadata,
          ...originMetadata,
        }),
      });

      const permissions = deps.getNotePermissions(user.$id, Boolean(data.isPublic));
      await deps.createRow(deps.databaseId, deps.tableId, payload, docId, permissions);

      const rawTags = Array.isArray(data.tags) ? Array.from(new Set(data.tags.map((tag) => String(tag || '').trim()).filter(Boolean))) : [];
      if (deps.syncTags && rawTags.length > 0) {
        await deps.syncTags({ noteId: docId, rawTags, userId: user.$id, now });
      }

      return await deps.getNote(docId);
    },
  };
}
