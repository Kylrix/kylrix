import { describe, it, expect, vi } from 'vitest';
import { createNoteCreationService } from './index';

describe('createNoteCreationService', () => {
  const mockUser = { $id: 'user-123' };

  const setupDeps = (overrides = {}) => {
    const getCurrentUser = vi.fn().mockResolvedValue(mockUser);
    const createRow = vi.fn().mockImplementation((db, table, data, id) => Promise.resolve({ ...data, $id: id }));
    const updateRow = vi.fn().mockImplementation((db, table, id, data) => Promise.resolve({ ...data, $id: id }));
    const getNote = vi.fn().mockImplementation((id) => Promise.resolve({ $id: id, title: 'Sample Note' }));
    const getNotePermissions = vi.fn().mockReturnValue(['read', 'write']);
    const cleanRowData = vi.fn().mockImplementation((data) => ({ ...data }));
    const filterNoteData = vi.fn().mockImplementation((data) => ({ ...data }));
    const syncTags = vi.fn().mockResolvedValue(undefined);
    const generateId = vi.fn().mockReturnValue('custom-note-id');

    return {
      databaseId: 'db1',
      tableId: 'tbl1',
      getCurrentUser,
      createRow,
      updateRow,
      getNote,
      getNotePermissions,
      cleanRowData,
      filterNoteData,
      syncTags,
      generateId,
      ...overrides,
    };
  };

  describe('createNote', () => {
    it('throws error if user is not authenticated', async () => {
      const deps = setupDeps({ getCurrentUser: vi.fn().mockResolvedValue(null) });
      const service = createNoteCreationService(deps);
      await expect(service.createNote({ title: 'Test' })).rejects.toThrow('User not authenticated');
    });

    it('creates note successfully with string/object metadata and tags', async () => {
      const deps = setupDeps();
      const service = createNoteCreationService(deps);

      const result = await service.createNote({
        title: ' My Long Title ',
        content: 'Content',
        tags: ['tag1', 'tag2', 'tag1', ''],
        metadata: JSON.stringify({ key: 'val' }),
        origin: { type: 'chat', id: 'c1' },
        isPublic: true,
      });

      expect(deps.createRow).toHaveBeenCalled();
      expect(deps.syncTags).toHaveBeenCalledWith({
        noteId: 'custom-note-id',
        rawTags: ['tag1', 'tag2'],
        userId: 'user-123',
        now: expect.any(String),
      });
      expect(result).toBeDefined();
    });

    it('handles fallback ID generation when generateId is not provided', async () => {
      const deps = setupDeps({ generateId: undefined });
      const service = createNoteCreationService(deps);

      const result = await service.createNote({ title: 'Test Fallback ID' });
      expect(result).toBeDefined();
      expect(deps.createRow).toHaveBeenCalled();
    });

    it('handles invalid JSON string metadata gracefully', async () => {
      const deps = setupDeps();
      const service = createNoteCreationService(deps);

      await service.createNote({
        title: 'Bad JSON',
        metadata: 'invalid-json-{',
      });

      expect(deps.createRow).toHaveBeenCalledWith(
        'db1',
        'tbl1',
        expect.objectContaining({
          metadata: expect.stringContaining('_raw'),
        }),
        'custom-note-id',
        expect.any(Array)
      );
    });

    it('handles object metadata and raw noteData metadata string', async () => {
      const deps = setupDeps({
        cleanRowData: vi.fn().mockReturnValue({ metadata: '{"existing":"data"}' }),
      });
      const service = createNoteCreationService(deps);

      await service.createNote({
        title: 'Note Object Metadata',
        metadata: { foo: 'bar' },
      });

      expect(deps.createRow).toHaveBeenCalled();
    });

    it('handles noteData with non-string metadata object', async () => {
      const deps = setupDeps({
        cleanRowData: vi.fn().mockReturnValue({ metadata: { existing: 'obj' } }),
      });
      const service = createNoteCreationService(deps);

      await service.createNote({
        title: 'Note Object Metadata',
      });

      expect(deps.createRow).toHaveBeenCalled();
    });

    it('handles noteData with invalid string metadata', async () => {
      const deps = setupDeps({
        cleanRowData: vi.fn().mockReturnValue({ metadata: 'invalid-base-json{' }),
      });
      const service = createNoteCreationService(deps);

      await service.createNote({ title: 'Invalid base' });
      expect(deps.createRow).toHaveBeenCalled();
    });
  });

  describe('updateNote', () => {
    it('throws error if updateRow is not configured', async () => {
      const deps = setupDeps({ updateRow: undefined });
      const service = createNoteCreationService(deps);
      await expect(service.updateNote('note-1', {})).rejects.toThrow('updateRow is not configured for note updates');
    });

    it('throws error if user is unauthenticated', async () => {
      const deps = setupDeps({ getCurrentUser: vi.fn().mockResolvedValue(null) });
      const service = createNoteCreationService(deps);
      await expect(service.updateNote('note-1', {})).rejects.toThrow('User not authenticated');
    });

    it('updates note with title clamp, metadata parsing, and tags', async () => {
      const deps = setupDeps();
      const service = createNoteCreationService(deps);

      await service.updateNote(
        'note-1',
        {
          title: 'New Title',
          metadata: '{"updated":true}',
          kind: 'memo',
          tags: ['t1', 't2'],
          isPublic: false,
        },
        { ownerId: 'owner-99' }
      );

      expect(deps.getNotePermissions).toHaveBeenCalledWith('owner-99', false);
      expect(deps.updateRow).toHaveBeenCalledWith(
        'db1',
        'tbl1',
        'note-1',
        expect.objectContaining({
          title: 'New Title',
          metadata: JSON.stringify({ updated: true, kind: 'memo' }),
        }),
        expect.any(Array)
      );
      expect(deps.syncTags).toHaveBeenCalledWith({
        noteId: 'note-1',
        rawTags: ['t1', 't2'],
        userId: 'user-123',
        now: expect.any(String),
      });
    });

    it('updates note with object metadata and kind without metadata input', async () => {
      const deps = setupDeps();
      const service = createNoteCreationService(deps);

      await service.updateNote('note-1', {
        metadata: { direct: true },
      });

      expect(deps.updateRow).toHaveBeenCalledWith(
        'db1',
        'tbl1',
        'note-1',
        expect.objectContaining({
          metadata: JSON.stringify({ direct: true }),
        }),
        undefined
      );

      await service.updateNote('note-2', {
        kind: 'task',
      });

      expect(deps.updateRow).toHaveBeenCalledWith(
        'db1',
        'tbl1',
        'note-2',
        expect.objectContaining({
          metadata: JSON.stringify({ kind: 'task' }),
        }),
        undefined
      );
    });

    it('handles invalid json string metadata on update', async () => {
      const deps = setupDeps();
      const service = createNoteCreationService(deps);

      await service.updateNote('note-1', {
        metadata: 'bad-json-{',
      });

      expect(deps.updateRow).toHaveBeenCalledWith(
        'db1',
        'tbl1',
        'note-1',
        expect.objectContaining({
          metadata: JSON.stringify({ _raw: 'bad-json-{' }),
        }),
        undefined
      );
    });
  });
});
