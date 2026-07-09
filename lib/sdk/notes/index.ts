import { createCrossObjectMetadata, type CrossObjectOrigin } from '../orchestration';
import { clampNoteTitle } from '@/constants/noteTitle';

export interface NoteCreationContext<NoteRow = any> {
  databaseId: string;
  tableId: string;
  getCurrentUser: () => Promise<{ $id: string } | null>;
  createRow: <T = unknown>(databaseId: string, tableId: string, data: T, rowId?: string, permissions?: string[]) => Promise<NoteRow>;
  updateRow?: (databaseId: string, tableId: string, rowId: string, data: Record<string, unknown>, permissions?: string[]) => Promise<NoteRow>;
  getNote: (noteId: string) => Promise<NoteRow>;
  getNotePermissions: (userId: string, isPublic: boolean) => string[];
  cleanRowData: <T>(data: Partial<T>) => Record<string, unknown>;
  filterNoteData: (data: Record<string, unknown>) => Record<string, unknown>;
  syncTags?: (params: { noteId: string; rawTags: string[]; userId: string; now: string }) => Promise<void>;
  generateId?: () => string;
}

export interface NoteCreationInput {
  title: string;
  content?: string;
  format?: 'text' | 'markdown';
  tags?: string[];
  isPublic?: boolean;
  origin?: CrossObjectOrigin | null;
  metadata?: Record<string, unknown> | string;
  attachments?: unknown[];
}

export interface NoteUpdateInput {
  title?: string;
  content?: string;
  format?: 'text' | 'markdown';
  tags?: string[];
  isPublic?: boolean;
  metadata?: Record<string, unknown> | string;
  kind?: string;
}

export function createNoteCreationService<NoteRow = any>(deps: NoteCreationContext<NoteRow>) {
  return {
    async createNote(data: NoteCreationInput) {
      const user = await deps.getCurrentUser();
      if (!user?.$id) {
        throw new Error('User not authenticated');
      }

      const now = new Date().toISOString();
      const docId = deps.generateId ? deps.generateId() : Math.random().toString(36).slice(2);
      const cleanData = deps.cleanRowData(data);
      const noteData = { ...cleanData } as Record<string, unknown>;
      if (noteData.title !== undefined) {
        noteData.title = clampNoteTitle(noteData.title, 'Untitled Thought');
      }
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
        creatorId: user.$id,
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

    async updateNote(noteId: string, data: NoteUpdateInput, options?: { ownerId?: string }) {
      if (!deps.updateRow) {
        throw new Error('updateRow is not configured for note updates');
      }

      const user = await deps.getCurrentUser();
      if (!user?.$id) {
        throw new Error('User not authenticated');
      }

      const now = new Date().toISOString();
      const cleanData = deps.cleanRowData(data);
      const noteData = { ...cleanData } as Record<string, unknown>;

      if (noteData.title !== undefined) {
        noteData.title = clampNoteTitle(noteData.title, 'Untitled Thought');
      }

      delete noteData.attachments;
      delete noteData.comments;
      delete noteData.collaborators;
      delete noteData.extensions;
      delete noteData.userId;
      delete noteData.creatorId;
      delete noteData.id;
      delete noteData.createdAt;

      const metadataInput = data.metadata;
      if (metadataInput !== undefined) {
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

        const kindMetadata = data.kind ? { kind: data.kind } : {};
        noteData.metadata = JSON.stringify({
          ...extraMetadata,
          ...kindMetadata,
        });
      } else if (data.kind) {
        noteData.metadata = JSON.stringify({ kind: data.kind });
      }

      const payload = deps.filterNoteData({
        ...noteData,
        updatedAt: now,
      });

      let permissions: string[] | undefined;
      if (typeof data.isPublic === 'boolean') {
        const ownerId = options?.ownerId || user.$id;
        permissions = deps.getNotePermissions(ownerId, data.isPublic);
      }

      await deps.updateRow(deps.databaseId, deps.tableId, noteId, payload, permissions);

      if (deps.syncTags && Array.isArray(data.tags)) {
        const rawTags = Array.from(new Set(data.tags.map((tag) => String(tag || '').trim()).filter(Boolean)));
        await deps.syncTags({ noteId, rawTags, userId: user.$id, now });
      }

      return await deps.getNote(noteId);
    },
  };
}
