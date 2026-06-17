import { createCrossObjectMetadata, type CrossObjectOrigin } from './orchestration';

type NoteSdk = {
  createRow: (
    databaseId: string,
    tableId: string,
    data: Record<string, unknown>,
    rowId?: string,
    permissions?: string[]
  ) => Promise<unknown>;
  getRow: <T = unknown>(databaseId: string, tableId: string, rowId: string) => Promise<T>;
  updateRow: (databaseId: string, tableId: string, rowId: string, data: Record<string, unknown>) => Promise<unknown>;
  listRows: <T = unknown>(databaseId: string, tableId: string, queries?: string[]) => Promise<{ rows: T[] } & Record<string, unknown>>;
};

/**
 * Kylrix.Note: The Intelligence Layer Module.
 * Domain: note.kylrix.space
 */
export class KylrixNote {
  constructor(private sdk: NoteSdk) {}

  /**
   * Creates a new note row with basic timestamps and optional metadata.
   * Apps with richer note rules can layer their own payload sanitizer on top.
   */
  async createNote(databaseId: string, tableId: string, data: {
    title: string;
    content?: string;
    format?: 'text' | 'markdown';
    userId?: string;
    isPublic?: boolean;
    tags?: string[];
    metadata?: Record<string, unknown> | string;
    origin?: CrossObjectOrigin;
  }, permissions?: string[]) {
    const { origin, metadata: metadataInput, ...noteFields } = data;
    const metadata = typeof data.metadata === 'string'
      ? (() => {
          try {
            return JSON.parse(data.metadata);
          } catch {
            return { _raw: data.metadata };
          }
        })()
      : (metadataInput || {});

    return await this.sdk.createRow(databaseId, tableId, {
      ...noteFields,
      metadata: JSON.stringify({
        ...metadata,
        ...(origin ? createCrossObjectMetadata(origin) : {}),
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: null,
    }, undefined, permissions);
  }

  /**
   * Saves a note revision with optional metadata.
   */
  async saveRevision(databaseId: string, tableId: string, data: {
    noteId: string;
    userId: string;
    content: string;
    title?: string;
    diff?: string;
    cause?: 'manual' | 'ai' | 'collab';
  }) {
    return await this.sdk.createRow(databaseId, tableId, {
      ...data,
      createdAt: new Date().toISOString(),
      cause: data.cause || 'manual',
    });
  }

  /**
   * Adds a tag to a note.
   */
  async addTag(databaseId: string, tableId: string, noteId: string, tagName: string) {
    const note = await this.sdk.getRow<any>(databaseId, tableId, noteId);
    const tags = new Set(note.tags || []);
    tags.add(tagName);
    
    return await this.sdk.updateRow(databaseId, tableId, noteId, {
      tags: Array.from(tags),
    });
  }

  /**
   * Lists notes for a specific user.
   */
  async listNotes(databaseId: string, tableId: string, userId: string) {
    return await this.sdk.listRows<any>(databaseId, tableId, [
      `equal("userId", "${userId}")`
    ]);
  }
}
