import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNote, updateNote, deleteNote, createTag, filterNoteData, isExcludedNote, decryptPublicEncryptedNote } from './note';
import * as threadCrypto from '@/lib/encryption/thread-crypto';
import * as clientOps from '@/lib/actions/client-ops';
import * as secureOps from '@/lib/actions/secure-ops';
import * as masterpassCrypto from '@/lib/masterpass-crypto';
import { getCurrentUser } from './client';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { unifiedDelete, unifiedUpdate } from '@/lib/services/unified-object-service';
import { readLocalTagRows, findLocalTagByName } from '@/lib/data/local/tags';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { invalidateCache } from '@/lib/ecosystem/nexus-fetcher';

// Mock dependencies to prevent external connection errors or appwrite crashes
vi.mock('./client', () => ({
  account: { get: vi.fn() },
  databases: {
    getRow: vi.fn(),
    listRows: vi.fn(),
    createRow: vi.fn(),
    updateRow: vi.fn(),
    deleteRow: vi.fn(),
  },
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/ecosystem/tablesdb-row-cache', () => ({
  invalidateTablesDbRowCache: vi.fn(),
}));

vi.mock('@/lib/ecosystem/nexus-bridge', () => ({
  publishNexusInvalidate: vi.fn(),
}));

vi.mock('@/lib/notes/compose-draft-registry', () => ({
  isEphemeralComposeNoteId: vi.fn().mockReturnValue(false),
  markComposePersisted: vi.fn(),
}));

vi.mock('@/lib/services/unified-object-service', () => ({
  unifiedUpdate: vi.fn().mockRejectedValue(new Error('Not implemented in unit test')),
  unifiedDelete: vi.fn().mockRejectedValue(new Error('Not implemented in unit test')),
}));

vi.mock('@/lib/actions/client-ops', () => ({
  deleteNote: vi.fn(),
  updateNote: vi.fn(),
  createRow: vi.fn(),
}));

vi.mock('@/lib/data/local/tags', () => ({
  readLocalTagRows: vi.fn().mockResolvedValue([]),
  findLocalTagByName: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/services/sync-engine', () => ({
  autonomicSyncEngine: {
    markPending: vi.fn(),
  },
}));

vi.mock('@/lib/ecosystem/nexus-fetcher', () => ({
  invalidateCache: vi.fn(),
  fetchOptimized: vi.fn(),
}));

vi.mock('@/lib/actions/secure-ops', () => ({
  deleteNoteSecure: vi.fn(),
  updateNoteSecure: vi.fn(),
}));

vi.mock('@/lib/encryption/thread-crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof threadCrypto>();
  return {
    ...actual,
    decryptThreadData: vi.fn(actual.decryptThreadData),
    encryptThreadData: vi.fn(actual.encryptThreadData),
  };
});

vi.mock('@/lib/masterpass-crypto', () => ({
  decryptField: vi.fn(),
  encryptField: vi.fn(),
}));

vi.mock('@/lib/ecosystem/security', () => ({
  ecosystemSecurity: {
    encryptWithKey: vi.fn(),
    decryptWithKey: vi.fn(),
    decrypt: vi.fn(),
    status: { isUnlocked: true },
  },
}));

describe('lib/appwrite/note thread notes operations', () => {
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    originalWindow = global.window;
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    }
  });

  describe('updateNote with thread notes', () => {
    it('successfully updates unencrypted thread note in localStorage', async () => {
      const initialThreadNote = {
        id: 'thread-123',
        title: 'Initial Title',
        content: 'Initial Content',
        createdAt: '2025-01-01T00:00:00.000Z',
        metadata: '{"key":"value"}',
      };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([initialThreadNote]));

      const result = await updateNote('thread-123', {
        title: 'Updated Title',
        content: 'Updated Content',
      });

      expect(result).toMatchObject({
        $id: 'thread-123',
        title: 'Updated Title',
        content: 'Updated Content',
      });

      const updatedStorage = JSON.parse(localStorage.getItem('kylrix_thread_notes_v2') || '[]');
      expect(updatedStorage[0].title).toBe('Updated Title');
      expect(updatedStorage[0].content).toBe('Updated Content');
    });

    it('successfully decrypts, updates, and re-encrypts thread note when decryptionKey is present', async () => {
      const initialThreadNote = {
        id: 'thread-456',
        title: 'EncryptedTitle123',
        content: 'EncryptedContent123',
        createdAt: '2025-01-01T00:00:00.000Z',
        decryptionKey: 'secret-key-123',
      };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([initialThreadNote]));

      vi.mocked(threadCrypto.decryptThreadData)
        .mockResolvedValueOnce('Decrypted Title')
        .mockResolvedValueOnce('Decrypted Content');

      vi.mocked(threadCrypto.encryptThreadData)
        .mockResolvedValueOnce({ encrypted: 'NewEncryptedTitle', key: 'secret-key-123' })
        .mockResolvedValueOnce({ encrypted: 'NewEncryptedContent', key: 'secret-key-123' });

      const result = await updateNote('thread-456', {
        title: 'New Plain Title',
        content: 'New Plain Content',
      });

      expect(threadCrypto.decryptThreadData).toHaveBeenCalledTimes(2);
      expect(threadCrypto.encryptThreadData).toHaveBeenCalledTimes(2);

      expect(result).toMatchObject({
        $id: 'thread-456',
        title: 'New Plain Title',
        content: 'New Plain Content',
      });

      const updatedStorage = JSON.parse(localStorage.getItem('kylrix_thread_notes_v2') || '[]');
      expect(updatedStorage[0].title).toBe('NewEncryptedTitle');
      expect(updatedStorage[0].content).toBe('NewEncryptedContent');
    });

    it('handles decryption failure in updateNote gracefully (tests error path at line 506)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const initialThreadNote = {
        id: 'thread-fail-decrypt',
        title: 'CorruptedTitle',
        content: 'CorruptedContent',
        createdAt: '2025-01-01T00:00:00.000Z',
        decryptionKey: 'invalid-key',
      };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([initialThreadNote]));

      vi.mocked(threadCrypto.decryptThreadData).mockRejectedValue(new Error('Decryption failed'));

      // Do not provide new title or content to test fallback to match.title and match.content
      const result = await updateNote('thread-fail-decrypt', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to decrypt thread note for update:',
        expect.any(Error)
      );

      // decryptedTitle and decryptedContent fall back to match.title and match.content
      expect(result.title).toBe('CorruptedTitle');
      expect(result.content).toBe('CorruptedContent');
    });

    it('handles encryption failure in updateNote gracefully (tests error path at line 520)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const initialThreadNote = {
        id: 'thread-fail-encrypt',
        title: 'EncryptedTitle',
        content: 'EncryptedContent',
        createdAt: '2025-01-01T00:00:00.000Z',
        decryptionKey: 'some-key',
      };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([initialThreadNote]));

      vi.mocked(threadCrypto.decryptThreadData)
        .mockResolvedValueOnce('Title')
        .mockResolvedValueOnce('Content');

      vi.mocked(threadCrypto.encryptThreadData).mockRejectedValue(new Error('Encryption failed'));

      await updateNote('thread-fail-encrypt', {
        title: 'Brand New Title',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to encrypt thread note for update:',
        expect.any(Error)
      );

      // Fallback encTitle and encContent remain nextTitle / nextContent
      const updatedStorage = JSON.parse(localStorage.getItem('kylrix_thread_notes_v2') || '[]');
      expect(updatedStorage[0].title).toBe('Brand New Title');
    });
  });

  describe('getNote with thread notes', () => {
    it('returns unencrypted thread note directly when no decryptionKey is present', async () => {
      const threadNote = {
        id: 'thread-plain-1',
        title: 'Plain Thread Note Title',
        content: 'Plain Thread Note Content',
        createdAt: '2025-01-01T00:00:00.000Z',
        metadata: '{"custom":"data"}',
      };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([threadNote]));

      const result = await getNote('thread-plain-1');

      expect(threadCrypto.decryptThreadData).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        $id: 'thread-plain-1',
        title: 'Plain Thread Note Title',
        content: 'Plain Thread Note Content',
        metadata: '{"custom":"data"}',
      });
    });

    it('returns decrypted thread note if decryption is successful', async () => {
      const threadNote = {
        id: 'thread-789',
        title: 'EncryptedTitle',
        content: 'EncryptedContent',
        createdAt: '2025-01-01T00:00:00.000Z',
        decryptionKey: 'valid-key',
      };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([threadNote]));

      vi.mocked(threadCrypto.decryptThreadData)
        .mockResolvedValueOnce('Plain Title')
        .mockResolvedValueOnce('Plain Content');

      const result = await getNote('thread-789');

      expect(result).toMatchObject({
        $id: 'thread-789',
        title: 'Plain Title',
        content: 'Plain Content',
      });
    });

    it('handles decryption failure in getNote gracefully (line 447 error path)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const threadNote = {
        id: 'thread-err',
        title: 'BadEncryptedTitle',
        content: 'BadEncryptedContent',
        createdAt: '2025-01-01T00:00:00.000Z',
        decryptionKey: 'bad-key',
      };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([threadNote]));

      vi.mocked(threadCrypto.decryptThreadData).mockRejectedValue(new Error('Decryption error'));

      const result = await getNote('thread-err');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to decrypt thread note in getNote:',
        expect.any(Error)
      );
      expect(result.title).toBe('BadEncryptedTitle');
      expect(result.content).toBe('BadEncryptedContent');
    });
  });

  describe('deleteNote with thread notes and error paths', () => {
    it('removes thread note from localStorage on deleteNote', async () => {
      const note1 = { id: 'thread-del-1' };
      const note2 = { id: 'thread-del-2' };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([note1, note2]));

      const result = await deleteNote('thread-del-1');

      expect(result).toEqual({ success: true });
      const remaining = JSON.parse(localStorage.getItem('kylrix_thread_notes_v2') || '[]');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('thread-del-2');
    });

    it('successfully deletes note via client-ops when online', async () => {
      vi.mocked(clientOps.deleteNote).mockResolvedValueOnce({ success: true });

      const result = await deleteNote('regular-note-1');

      expect(clientOps.deleteNote).toHaveBeenCalledWith('regular-note-1');
      expect(result).toEqual({ success: true });
    });

    it('saves deletion as thread note when device is offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });

      const existingThreadNote = { id: 'existing-thread-id', title: 'Old' };
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([existingThreadNote]));

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await deleteNote('offline-note-1');

      expect(result).toEqual({ success: true });
      expect(consoleLogSpy).toHaveBeenCalledWith('[deleteNote] Offline. Saving deletion as a thread note...');

      const stored = JSON.parse(localStorage.getItem('kylrix_thread_notes_v2') || '[]');
      expect(stored[0]).toMatchObject({
        id: 'offline-note-1',
        title: '',
        content: '',
      });
      const metadata = JSON.parse(stored[0].metadata);
      expect(metadata).toEqual({
        isThread: true,
        _deleted: true,
        send_object: { kind: 'note' },
      });
    });

    it('handles error gracefully when localStorage contains invalid JSON during offline deletion', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });

      localStorage.setItem('kylrix_thread_notes_v2', 'invalid-json-{');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await deleteNote('offline-note-corrupt-json');

      expect(result).toEqual({ success: true });
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(SyntaxError));
    });

    it('catches network error from client-ops and falls back to offline thread note deletion (code: network_error)', async () => {
      const networkErr = { code: 'network_error', message: 'Failed to fetch' };
      vi.mocked(clientOps.deleteNote).mockRejectedValueOnce(networkErr);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([]));

      const result = await deleteNote('network-err-note-1');

      expect(result).toEqual({ success: true });
      expect(consoleLogSpy).toHaveBeenCalledWith('[deleteNote] Network error. Saving deletion as a thread note...');

      const stored = JSON.parse(localStorage.getItem('kylrix_thread_notes_v2') || '[]');
      expect(stored[0].id).toBe('network-err-note-1');
      const metadata = JSON.parse(stored[0].metadata);
      expect(metadata._deleted).toBe(true);
    });

    it('catches network error from client-ops when error message includes "fetch"', async () => {
      const networkErr = new Error('fetch failed due to DNS error');
      vi.mocked(clientOps.deleteNote).mockRejectedValueOnce(networkErr);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify([]));

      const result = await deleteNote('fetch-err-note-1');

      expect(result).toEqual({ success: true });
      expect(consoleLogSpy).toHaveBeenCalledWith('[deleteNote] Network error. Saving deletion as a thread note...');
    });

    it('handles error gracefully when localStorage contains invalid JSON during network error fallback', async () => {
      const networkErr = { status: undefined, message: 'NetworkError when attempting to fetch resource.' };
      vi.mocked(clientOps.deleteNote).mockRejectedValueOnce(networkErr);

      localStorage.setItem('kylrix_thread_notes_v2', 'corrupt-json-string');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await deleteNote('net-err-corrupt-json');

      expect(result).toEqual({ success: true });
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(SyntaxError));
    });

    it('re-throws non-network error from client-ops', async () => {
      const permErr = { status: 403, code: 403, message: 'Unauthorized permission' };
      vi.mocked(clientOps.deleteNote).mockRejectedValueOnce(permErr);

      await expect(deleteNote('forbidden-note-1')).rejects.toEqual(permErr);
    });

    it('executes deleteNoteSecure when window is undefined (server side)', async () => {
      // @ts-expect-error simulating server side
      delete global.window;

      vi.mocked(secureOps.deleteNoteSecure).mockResolvedValueOnce({ success: true });

      const result = await deleteNote('server-note-1', 'mock-jwt-token');

      expect(secureOps.deleteNoteSecure).toHaveBeenCalledWith('server-note-1', 'mock-jwt-token');
      expect(result).toEqual({ success: true });
    });
  });

  describe('unified-object-service error path and fallthrough testing', () => {
    it('returns { success: true } directly when unifiedDelete succeeds and skips clientOps/secureOps fallback', async () => {
      vi.mocked(unifiedDelete).mockResolvedValueOnce(undefined);

      const result = await deleteNote('note-unified-success');

      expect(unifiedDelete).toHaveBeenCalledWith('note', 'note-unified-success', {
        recursive: true,
        cascade: [{ kind: 'comment', foreignField: 'noteId' }],
      });
      expect(clientOps.deleteNote).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('falls through to clientOps.deleteNote when unifiedDelete throws an error (line 634 error path)', async () => {
      vi.mocked(unifiedDelete).mockRejectedValueOnce(new Error('Unified delete service failed'));
      vi.mocked(clientOps.deleteNote).mockResolvedValueOnce({ success: true });

      const result = await deleteNote('note-unified-fail');

      expect(unifiedDelete).toHaveBeenCalledWith('note', 'note-unified-fail', expect.any(Object));
      expect(clientOps.deleteNote).toHaveBeenCalledWith('note-unified-fail');
      expect(result).toEqual({ success: true });
    });

    it('returns row directly when unifiedUpdate succeeds and skips fallback updateNote calls', async () => {
      const mockUpdatedRow = { $id: 'note-up-1', title: 'Unified Title' };
      vi.mocked(unifiedUpdate).mockResolvedValueOnce(mockUpdatedRow as any);

      const result = await updateNote('note-up-1', { title: 'Unified Title' });

      expect(unifiedUpdate).toHaveBeenCalledWith('note', 'note-up-1', { title: 'Unified Title' });
      expect(clientOps.updateNote).not.toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedRow);
    });

    it('falls through to clientOps.updateNote when unifiedUpdate throws an error (line 543 error path)', async () => {
      vi.mocked(unifiedUpdate).mockRejectedValueOnce(new Error('Unified update service failed'));
      const fallbackRow = { $id: 'note-up-2', title: 'Fallback Title' };
      vi.mocked(clientOps.updateNote).mockResolvedValueOnce(fallbackRow as any);

      const result = await updateNote('note-up-2', { title: 'Fallback Title' });

      expect(unifiedUpdate).toHaveBeenCalledWith('note', 'note-up-2', { title: 'Fallback Title' });
      expect(clientOps.updateNote).toHaveBeenCalledWith('note-up-2', { title: 'Fallback Title' });
      expect(result).toEqual(fallbackRow);
    });

    it('falls through to clientOps when unifiedUpdate resolves with an object without $id', async () => {
      vi.mocked(unifiedUpdate).mockResolvedValueOnce({} as any);
      const fallbackRow = { $id: 'note-no-id-1', title: 'Fallback' };
      vi.mocked(clientOps.updateNote).mockResolvedValueOnce(fallbackRow as any);

      const result = await updateNote('note-no-id-1', { title: 'Fallback' });

      expect(unifiedUpdate).toHaveBeenCalledWith('note', 'note-no-id-1', { title: 'Fallback' });
      expect(clientOps.updateNote).toHaveBeenCalledWith('note-no-id-1', { title: 'Fallback' });
      expect(result).toEqual(fallbackRow);
    });

    it('encrypts fields client-side when activeNoteKeys contains key for noteId', async () => {
      const mock32ByteKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(32)));
      vi.mocked(masterpassCrypto.decryptField).mockResolvedValueOnce(mock32ByteKeyBase64);
      vi.mocked(ecosystemSecurity.decryptWithKey).mockResolvedValueOnce('Decrypted Title');
      vi.mocked(ecosystemSecurity.decryptWithKey).mockResolvedValueOnce('Decrypted Content');

      const noteToDecrypt = {
        $id: 'encrypted-note-1',
        title: '🔒 Encrypted Note',
        content: 'rawEncryptedContent',
        dek: 'wrappedDekString',
        metadata: JSON.stringify({ encryptedTitle: 'rawEncryptedTitle' }),
      } as any;

      await decryptPublicEncryptedNote(noteToDecrypt);

      vi.mocked(unifiedUpdate).mockRejectedValueOnce(new Error('Skip unified update'));
      vi.mocked(ecosystemSecurity.encryptWithKey)
        .mockResolvedValueOnce('newEncryptedTitle')
        .mockResolvedValueOnce('newEncryptedContent');

      vi.mocked(clientOps.updateNote).mockImplementationOnce(async (_id, data) => data as any);

      const result = await updateNote('encrypted-note-1', {
        title: 'My Secret Title',
        content: 'My Secret Content',
      });

      expect(ecosystemSecurity.encryptWithKey).toHaveBeenCalledWith('My Secret Title', expect.anything());
      expect(ecosystemSecurity.encryptWithKey).toHaveBeenCalledWith('My Secret Content', expect.anything());
      expect(result.title).toBe('🔒 Encrypted Note');
      expect(result.content).toBe('newEncryptedContent');
      const meta = JSON.parse(result.metadata as string);
      expect(meta.isEncrypted).toBe(true);
      expect(meta.encryptedTitle).toBe('newEncryptedTitle');
    });

    it('handles invalid metadata JSON gracefully during client-side encryption (line 563 catch path)', async () => {
      const mock32ByteKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(32)));
      vi.mocked(masterpassCrypto.decryptField).mockResolvedValueOnce(mock32ByteKeyBase64);
      vi.mocked(ecosystemSecurity.decryptWithKey).mockResolvedValue('Plaintext');

      await decryptPublicEncryptedNote({
        $id: 'corrupt-meta-note',
        dek: 'wrappedDek',
        metadata: '{}',
      } as any);

      vi.mocked(unifiedUpdate).mockRejectedValueOnce(new Error('Skip unified'));
      vi.mocked(ecosystemSecurity.encryptWithKey).mockResolvedValue('encryptedVal');
      vi.mocked(clientOps.updateNote).mockImplementationOnce(async (_id, data) => data as any);

      const result = await updateNote('corrupt-meta-note', {
        title: 'Title',
        metadata: 'invalid-json-{',
      });

      expect(result.title).toBe('🔒 Encrypted Note');
      const meta = JSON.parse(result.metadata as string);
      expect(meta.isEncrypted).toBe(true);
      expect(meta.encryptedTitle).toBe('encryptedVal');
    });

    it('catches and logs client-side encryption errors gracefully (line 576 catch path)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mock32ByteKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(32)));
      vi.mocked(masterpassCrypto.decryptField).mockResolvedValueOnce(mock32ByteKeyBase64);
      vi.mocked(ecosystemSecurity.decryptWithKey).mockResolvedValue('Plaintext');

      await decryptPublicEncryptedNote({
        $id: 'encrypt-fail-note',
        dek: 'wrappedDek',
        metadata: '{}',
      } as any);

      vi.mocked(unifiedUpdate).mockRejectedValueOnce(new Error('Skip unified'));
      vi.mocked(ecosystemSecurity.encryptWithKey).mockRejectedValueOnce(new Error('Encryption failure'));
      vi.mocked(clientOps.updateNote).mockImplementationOnce(async (_id, data) => data as any);

      const result = await updateNote('encrypt-fail-note', {
        title: 'Original Title',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to encrypt note update client-side:',
        expect.any(Error)
      );
      expect(result.title).toBe('Original Title');
    });

    it('executes updateNoteSecure on server side when window is undefined', async () => {
      // @ts-expect-error simulating server side
      delete global.window;

      vi.mocked(unifiedUpdate).mockRejectedValueOnce(new Error('Skip unified'));
      const serverUpdatedRow = { $id: 'server-note-2', title: 'Server Updated' };
      vi.mocked(secureOps.updateNoteSecure).mockResolvedValueOnce(serverUpdatedRow as any);

      const result = await updateNote('server-note-2', { title: 'Server Updated' }, 'jwt-token-xyz');

      expect(secureOps.updateNoteSecure).toHaveBeenCalledWith('server-note-2', { title: 'Server Updated' }, 'jwt-token-xyz');
      expect(result).toEqual(serverUpdatedRow);
    });
  });

  describe('filterNoteData and metadata parsing edge cases', () => {
    it('safely merges non-schema fields into metadata JSON and handles existing metadata', () => {
      const input = {
        title: 'Note Title',
        customAttribute1: 'customVal1',
        metadata: JSON.stringify({ existingProp: true }),
      };

      const result = filterNoteData(input);

      expect(result.title).toBe('Note Title');
      expect(result.customAttribute1).toBeUndefined();
      expect(JSON.parse(result.metadata)).toEqual({
        existingProp: true,
        customAttribute1: 'customVal1',
      });
    });

    it('handles malformed metadata JSON in filterNoteData gracefully', () => {
      const input = {
        title: 'Note Title',
        customField: 'val',
        metadata: 'invalid-json-{',
      };

      const result = filterNoteData(input);

      expect(result.title).toBe('Note Title');
      expect(JSON.parse(result.metadata)).toEqual({
        _raw: 'invalid-json-{',
        customField: 'val',
      });
    });

    it('handles malformed metadata JSON in isExcludedNote gracefully', () => {
      const corruptNote = {
        userId: 'user-123',
        metadata: 'invalid-json-{',
      };

      expect(isExcludedNote(corruptNote)).toBe(false);
    });
  });

  describe('createTag operations and error paths', () => {
    it('throws an error if tag name is missing or whitespace', async () => {
      await expect(createTag({ name: '' })).rejects.toThrow('Tag name is required');
      await expect(createTag({ name: '   ' })).rejects.toThrow('Tag name is required');
    });

    it('returns local tag match if tag already exists locally on client', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ $id: 'user-100' } as any);
      vi.mocked(readLocalTagRows).mockResolvedValueOnce([{ $id: 'local-tag-1', name: 'Frontend' }] as any);
      vi.mocked(findLocalTagByName).mockReturnValueOnce({
        $id: 'local-tag-1',
        name: 'Frontend',
        metadata: '{"color":"#123456"}',
      } as any);

      const result = await createTag({ name: 'Frontend' });

      expect(readLocalTagRows).toHaveBeenCalledWith('user-100');
      expect(findLocalTagByName).toHaveBeenCalledWith(expect.anything(), 'Frontend');
      expect(result).toMatchObject({
        $id: 'local-tag-1',
        name: 'Frontend',
        color: '#123456',
      });
      expect(clientOps.createRow).not.toHaveBeenCalled();
    });

    it('successfully creates optimistic tag client-side and completes background sync', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ $id: 'user-100' } as any);
      vi.mocked(readLocalTagRows).mockResolvedValueOnce([]);
      vi.mocked(findLocalTagByName).mockReturnValueOnce(null);

      vi.mocked(clientOps.createRow).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ $id: 'synced-doc-id' } as any), 10))
      );

      const result = await createTag({ name: 'Backend', color: '#00FF00', description: 'Server code' });

      expect(result).toMatchObject({
        name: 'Backend',
        nameLower: 'backend',
        userId: 'user-100',
        color: '#00FF00',
        description: 'Server code',
      });

      // Wait for background IIFE to complete
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(clientOps.createRow).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          name: 'Backend',
          nameLower: 'backend',
        })
      );
      expect(autonomicSyncEngine.markPending).toHaveBeenCalledWith('synced-doc-id');
      expect(invalidateCache).toHaveBeenCalledWith('list:tags');
    });

    it('handles error in background sync (createRow rejection) gracefully and logs warning (line 847 error path)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(getCurrentUser).mockResolvedValueOnce({ $id: 'user-100' } as any);
      vi.mocked(readLocalTagRows).mockResolvedValueOnce([]);
      vi.mocked(findLocalTagByName).mockReturnValueOnce(null);

      const syncError = new Error('Network error during tag creation');
      vi.mocked(clientOps.createRow).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(syncError), 10))
      );

      const result = await createTag({ name: 'FailingTag' });

      expect(result).toMatchObject({
        name: 'FailingTag',
        nameLower: 'failingtag',
      });

      // Wait for background IIFE to run and hit catch block
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(consoleWarnSpy).toHaveBeenCalledWith('[createTag] background sync failed:', syncError);
    });

    it('handles error when autonomicSyncEngine.markPending throws inside background sync (line 844 catch path)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ $id: 'user-100' } as any);
      vi.mocked(readLocalTagRows).mockResolvedValueOnce([]);
      vi.mocked(findLocalTagByName).mockReturnValueOnce(null);

      vi.mocked(clientOps.createRow).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ $id: 'doc-id-1' } as any), 10))
      );
      vi.mocked(autonomicSyncEngine.markPending).mockImplementation(() => {
        throw new Error('Sync engine failed');
      });

      const result = await createTag({ name: 'TagWithSyncEngineFailure' });

      expect(result).toMatchObject({
        name: 'TagWithSyncEngineFailure',
      });

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(invalidateCache).toHaveBeenCalledWith('list:tags');
    });
  });
});
