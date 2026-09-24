import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNote, updateNote, deleteNote } from './note';
import * as threadCrypto from '@/lib/encryption/thread-crypto';
import * as clientOps from '@/lib/actions/client-ops';
import * as secureOps from '@/lib/actions/secure-ops';

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
}));

vi.mock('@/lib/actions/secure-ops', () => ({
  deleteNoteSecure: vi.fn(),
}));

vi.mock('@/lib/encryption/thread-crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof threadCrypto>();
  return {
    ...actual,
    decryptThreadData: vi.fn(actual.decryptThreadData),
    encryptThreadData: vi.fn(actual.encryptThreadData),
  };
});

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

      const result = await updateNote('thread-fail-encrypt', {
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

    it('handles decryption failure in getNote gracefully', async () => {
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
});
