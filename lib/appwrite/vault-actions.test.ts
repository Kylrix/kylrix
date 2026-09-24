import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeCredentialAttachmentsField,
  addAttachmentToCredential,
  deleteCredentialAttachment,
  logoutAppwrite,
  resetMasterpassAndWipe,
  validatePublicVaultAccess,
  validatePublicTotpAccess,
} from './vault-actions';
import { VaultService, vaultDatabases } from './vault-service';
import { account, storage } from './client';
import { createSystemClient } from '@/lib/appwrite-admin';
import { purgeAllClientStorageOnLogout } from '@/lib/services/wipe-client-storage';

// Mock dependencies
vi.mock('./vault-service', () => ({
  VaultService: {
    getCredential: vi.fn(),
    updateCredential: vi.fn(),
  },
  vaultDatabases: {
    getRow: vi.fn(),
    listRows: vi.fn(),
    deleteRow: vi.fn(),
    updateRow: vi.fn(),
  },
  APPWRITE_COLLECTION_CREDENTIALS_ID: 'credentials_id',
  APPWRITE_COLLECTION_TOTPSECRETS_ID: 'totp_id',
  APPWRITE_COLLECTION_FOLDERS_ID: 'folders_id',
  APPWRITE_COLLECTION_SECURITYLOGS_ID: 'security_logs_id',
  APPWRITE_COLLECTION_USER_ID: 'user_id',
  APPWRITE_COLLECTION_IDENTITIES_ID: 'identities_id',
  PASSWORD_MANAGER_DATABASE_ID: 'pwd_db_id',
  CHAT_DATABASE_ID: 'chat_db_id',
  CHAT_COLLECTION_CONVERSATIONS_ID: 'chat_conversations',
  CHAT_COLLECTION_MESSAGES_ID: 'chat_messages',
  CHAT_COLLECTION_USERS_ID: 'chat_users',
}));

vi.mock('./client', () => ({
  APPWRITE_DATABASE_ID: 'db_id',
  APPWRITE_COLLECTION_KEYCHAIN_ID: 'keychain_id',
  account: {
    deleteSession: vi.fn(),
  },
  storage: {
    deleteFile: vi.fn(),
  },
}));

vi.mock('@/lib/storage/framework', () => ({
  validateFileUploadLimit: vi.fn(),
  compressImageToWebP: vi.fn((file) => Promise.resolve(file)),
  getFileTypeCategory: vi.fn(() => 'document'),
}));

vi.mock('@/lib/actions/client-ops', () => ({
  secureUploadFile: vi.fn(),
}));

vi.mock('@/lib/services/wipe-client-storage', () => ({
  purgeAllClientStorageOnLogout: vi.fn(),
}));

vi.mock('@/lib/appwrite-admin', () => {
  const getRowMock = vi.fn();
  return {
    createSystemClient: vi.fn(() => ({
      databases: {
        getRow: getRowMock,
      },
    })),
    _adminGetRowMock: getRowMock,
  };
});

describe('vault-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resetMasterpassAndWipe', () => {
    it('wipes user table docs, self-chats, and clears public key successfully', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(vaultDatabases.listRows).mockImplementation(async (dbId, collectionId) => {
        if (collectionId === 'conversationMembers') {
          return { rows: [{ conversationId: 'conv-1' }] } as any;
        }
        if (collectionId === 'chat_conversations') {
          return {
            rows: [{ $id: 'conv-1', type: 'direct', participants: ['user-123'] }],
          } as any;
        }
        if (collectionId === 'chat_users') {
          return { rows: [{ $id: 'user-123', publicKey: 'old-key' }] } as any;
        }
        return { rows: [{ $id: `doc-${collectionId}` }] } as any;
      });

      vi.mocked(vaultDatabases.deleteRow).mockResolvedValue({} as any);
      vi.mocked(vaultDatabases.updateRow).mockResolvedValue({} as any);

      await expect(resetMasterpassAndWipe('user-123')).resolves.not.toThrow();

      expect(vaultDatabases.deleteRow).toHaveBeenCalled();
      expect(vaultDatabases.updateRow).toHaveBeenCalledWith(
        'chat_db_id',
        'chat_users',
        'user-123',
        { publicKey: '' }
      );
    });

    it('handles listRows throwing in deleteTableDocs gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(vaultDatabases.listRows).mockRejectedValue(new Error('Database fetch failed'));

      await expect(resetMasterpassAndWipe('user-123')).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('handles deleteRow throwing in deleteTableDocs gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(vaultDatabases.listRows).mockResolvedValue({
        rows: [{ $id: 'doc-1' }],
      } as any);
      vi.mocked(vaultDatabases.deleteRow).mockRejectedValue(new Error('Deletion restricted'));

      await expect(resetMasterpassAndWipe('user-123')).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('handles wipeChatData failure during public key update gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(vaultDatabases.listRows).mockImplementation(async (dbId, collectionId) => {
        if (collectionId === 'conversationMembers') return { rows: [] } as any;
        if (collectionId === 'chat_users') return { rows: [{ $id: 'user-123' }] } as any;
        return { rows: [] } as any;
      });
      vi.mocked(vaultDatabases.updateRow).mockRejectedValue(new Error('Update failed'));

      await expect(resetMasterpassAndWipe('user-123')).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to clear chat public key:',
        expect.any(Error)
      );
    });
  });

  describe('normalizeCredentialAttachmentsField', () => {
    it('returns empty array if credential has no attachments field or if it is empty/falsy', () => {
      expect(normalizeCredentialAttachmentsField({})).toEqual([]);
      expect(normalizeCredentialAttachmentsField({ attachments: null })).toEqual([]);
      expect(normalizeCredentialAttachmentsField({ attachments: '' })).toEqual([]);
      expect(normalizeCredentialAttachmentsField({ attachments: undefined })).toEqual([]);
    });

    it('parses valid JSON array strings correctly', () => {
      const mockMeta = [{ id: '1', name: 'doc.pdf', size: 100, mime: 'application/pdf', createdAt: '2025-01-01' }];
      const credential = { attachments: JSON.stringify(mockMeta) };
      expect(normalizeCredentialAttachmentsField(credential)).toEqual(mockMeta);
    });

    it('returns empty array when JSON is valid but not an array (e.g. object or boolean or number)', () => {
      expect(normalizeCredentialAttachmentsField({ attachments: '{"id": "1"}' })).toEqual([]);
      expect(normalizeCredentialAttachmentsField({ attachments: '123' })).toEqual([]);
      expect(normalizeCredentialAttachmentsField({ attachments: 'true' })).toEqual([]);
    });

    it('returns empty array when raw attachments is non-string truthy value (object, boolean, number, array)', () => {
      expect(normalizeCredentialAttachmentsField({ attachments: 12345 })).toEqual([]);
      expect(normalizeCredentialAttachmentsField({ attachments: true })).toEqual([]);
      expect(normalizeCredentialAttachmentsField({ attachments: { id: 'file-1' } })).toEqual([]);
      expect(normalizeCredentialAttachmentsField({ attachments: [{ id: 'file-2' }] })).toEqual([]);
    });

    it('handles JSON parsing errors gracefully when raw string is malformed JSON (catch error path line 265)', () => {
      const invalidCredential = { attachments: '{ invalid json string ' };
      expect(normalizeCredentialAttachmentsField(invalidCredential)).toEqual([]);
    });
  });

  describe('addAttachmentToCredential', () => {
    it('throws error if credential is not found', async () => {
      vi.mocked(VaultService.getCredential).mockResolvedValue(null as any);
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      await expect(addAttachmentToCredential('cred-1', testFile)).rejects.toThrow('Credential not found');
    });

    it('compresses image if file type is image and appends attachment metadata', async () => {
      const existingMeta = [{ id: 'old-1', name: 'old.png', size: 50, mime: 'image/png', createdAt: '2025-01-01' }];
      vi.mocked(VaultService.getCredential).mockResolvedValue({
        attachments: JSON.stringify(existingMeta),
      } as any);

      const framework = await import('@/lib/storage/framework');
      vi.mocked(framework.getFileTypeCategory).mockReturnValue('image');
      vi.mocked(framework.compressImageToWebP).mockResolvedValue(new File(['compressed'], 'image.webp', { type: 'image/webp' }));

      const clientOps = await import('@/lib/actions/client-ops');
      vi.mocked(clientOps.secureUploadFile).mockResolvedValue({ $id: 'file-new' });

      vi.mocked(VaultService.updateCredential).mockResolvedValue({ id: 'cred-1' } as any);

      const testFile = new File(['image-bytes'], 'image.png', { type: 'image/png' });
      await addAttachmentToCredential('cred-1', testFile);

      expect(framework.compressImageToWebP).toHaveBeenCalledWith(testFile);
      expect(VaultService.updateCredential).toHaveBeenCalledWith(
        'cred-1',
        expect.objectContaining({
          attachments: expect.stringContaining('file-new'),
        })
      );
    });

    it('falls back to original file if image compression fails', async () => {
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: 'invalid-json' } as any);

      const framework = await import('@/lib/storage/framework');
      vi.mocked(framework.getFileTypeCategory).mockReturnValue('image');
      vi.mocked(framework.compressImageToWebP).mockRejectedValue(new Error('Compression failed'));

      const clientOps = await import('@/lib/actions/client-ops');
      vi.mocked(clientOps.secureUploadFile).mockResolvedValue({ $id: 'file-fallback' });

      vi.mocked(VaultService.updateCredential).mockResolvedValue({ id: 'cred-1' } as any);

      const testFile = new File(['image-bytes'], 'image.png', { type: 'image/png' });
      await addAttachmentToCredential('cred-1', testFile);

      expect(clientOps.secureUploadFile).toHaveBeenCalled();
      expect(VaultService.updateCredential).toHaveBeenCalled();
    });

    it('throws custom error when secureUploadFile fails', async () => {
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: '[]' } as any);

      const clientOps = await import('@/lib/actions/client-ops');
      vi.mocked(clientOps.secureUploadFile).mockRejectedValue(new Error('Upload quota exceeded'));

      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      await expect(addAttachmentToCredential('cred-1', testFile)).rejects.toThrow('Upload quota exceeded');
    });
  });

  describe('deleteCredentialAttachment', () => {
    it('throws error if credential is not found', async () => {
      vi.mocked(VaultService.getCredential).mockResolvedValue(null as any);
      await expect(deleteCredentialAttachment('cred-1', 'file-1')).rejects.toThrow('Credential not found');
    });

    it('deletes file from storage and updates credential attachment list', async () => {
      const existing = [
        { id: 'file-1', name: 'f1.pdf', size: 10, mime: 'application/pdf', createdAt: '2025-01-01' },
        { id: 'file-2', name: 'f2.pdf', size: 20, mime: 'application/pdf', createdAt: '2025-01-01' },
      ];
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: JSON.stringify(existing) } as any);
      vi.mocked(storage.deleteFile).mockResolvedValue({} as any);
      vi.mocked(VaultService.updateCredential).mockResolvedValue({ id: 'cred-1' } as any);

      await deleteCredentialAttachment('cred-1', 'file-1');

      expect(storage.deleteFile).toHaveBeenCalledWith('vault_attachments', 'file-1');
      expect(VaultService.updateCredential).toHaveBeenCalledWith(
        'cred-1',
        expect.objectContaining({
          attachments: JSON.stringify([existing[1]]),
        })
      );
    });

    it('catches storage deletion errors gracefully and proceeds with credential update', async () => {
      const existing = [{ id: 'file-1', name: 'f1.pdf', size: 10, mime: 'application/pdf', createdAt: '2025-01-01' }];
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: JSON.stringify(existing) } as any);
      vi.mocked(storage.deleteFile).mockRejectedValue(new Error('File not found in storage'));
      vi.mocked(VaultService.updateCredential).mockResolvedValue({ id: 'cred-1' } as any);

      await deleteCredentialAttachment('cred-1', 'file-1');

      expect(VaultService.updateCredential).toHaveBeenCalledWith(
        'cred-1',
        expect.objectContaining({
          attachments: JSON.stringify([]),
        })
      );
    });
  });

  describe('logoutAppwrite', () => {
    it('handles deleteSession error gracefully without crashing', async () => {
      vi.mocked(account.deleteSession).mockRejectedValue(new Error('No session active'));
      await expect(logoutAppwrite()).resolves.not.toThrow();
    });

    it('invokes purgeAllClientStorageOnLogout when window is defined', async () => {
      vi.mocked(account.deleteSession).mockResolvedValue({} as any);
      const originalWindow = globalThis.window;
      // @ts-ignore
      globalThis.window = {} as any;

      try {
        await logoutAppwrite();
        expect(purgeAllClientStorageOnLogout).toHaveBeenCalled();
      } finally {
        // @ts-ignore
        globalThis.window = originalWindow;
      }
    });
  });

  describe('validatePublicVaultAccess', () => {
    it('returns null on client-side if database call fails', async () => {
      vi.mocked(vaultDatabases.getRow).mockRejectedValue(new Error('Database network error'));
      const result = await validatePublicVaultAccess('cred-1');
      expect(result).toBeNull();
    });

    it('returns credential on client-side if isPublic is true', async () => {
      vi.mocked(vaultDatabases.getRow).mockResolvedValue({ id: 'cred-1', isPublic: true } as any);
      const result = await validatePublicVaultAccess('cred-1');
      expect(result).toEqual({ id: 'cred-1', isPublic: true });
    });

    it('returns null if isPublic is false', async () => {
      vi.mocked(vaultDatabases.getRow).mockResolvedValue({ id: 'cred-1', isPublic: false } as any);
      const result = await validatePublicVaultAccess('cred-1');
      expect(result).toBeNull();
    });

    it('uses system admin client on server-side (window undefined) and returns doc if isPublic is true', async () => {
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      try {
        const adminClient = createSystemClient();
        vi.mocked(adminClient.databases.getRow).mockResolvedValue({ id: 'cred-srv-1', isPublic: true } as any);

        const result = await validatePublicVaultAccess('cred-srv-1');
        expect(result).toEqual({ id: 'cred-srv-1', isPublic: true });
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('uses system admin client on server-side and returns null if isPublic is false', async () => {
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      try {
        const adminClient = createSystemClient();
        vi.mocked(adminClient.databases.getRow).mockResolvedValue({ id: 'cred-srv-2', isPublic: false } as any);

        const result = await validatePublicVaultAccess('cred-srv-2');
        expect(result).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe('validatePublicTotpAccess', () => {
    it('returns null on client-side if database call fails', async () => {
      vi.mocked(vaultDatabases.getRow).mockRejectedValue(new Error('Database network error'));
      const result = await validatePublicTotpAccess('totp-1');
      expect(result).toBeNull();
    });

    it('returns totp row on client-side if isPublic is true', async () => {
      vi.mocked(vaultDatabases.getRow).mockResolvedValue({ id: 'totp-1', isPublic: true } as any);
      const result = await validatePublicTotpAccess('totp-1');
      expect(result).toEqual({ id: 'totp-1', isPublic: true });
    });

    it('returns null if isPublic is false', async () => {
      vi.mocked(vaultDatabases.getRow).mockResolvedValue({ id: 'totp-1', isPublic: false } as any);
      const result = await validatePublicTotpAccess('totp-1');
      expect(result).toBeNull();
    });

    it('uses system admin client on server-side (window undefined) and returns totp if isPublic is true', async () => {
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      try {
        const adminClient = createSystemClient();
        vi.mocked(adminClient.databases.getRow).mockResolvedValue({ id: 'totp-srv-1', isPublic: true } as any);

        const result = await validatePublicTotpAccess('totp-srv-1');
        expect(result).toEqual({ id: 'totp-srv-1', isPublic: true });
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('uses system admin client on server-side and returns null if isPublic is false', async () => {
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      try {
        const adminClient = createSystemClient();
        vi.mocked(adminClient.databases.getRow).mockResolvedValue({ id: 'totp-srv-2', isPublic: false } as any);

        const result = await validatePublicTotpAccess('totp-srv-2');
        expect(result).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });
});
