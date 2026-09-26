import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeCredentialAttachmentsField,
  addAttachmentToCredential,
  deleteCredentialAttachment,
  logoutAppwrite,
  resetMasterpassAndWipe,
  validatePublicVaultAccess,
  validatePublicTotpAccess,
  listFolders,
  createFolder,
  setMasterpassFlag,
  createTotpSecret,
  updateTotpSecret,
  listTotpSecrets,
  deleteTotpSecret,
  listRawTotpSecrets,
  createCredential,
  updateCredential,
  deleteCredential,
  listAllCredentials,
  listRawCredentials,
  setCredentialPinned,
  setTotpPinned,
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
    createCredential: vi.fn(),
    deleteCredential: vi.fn(),
    listAllCredentials: vi.fn(),
    listRawCredentials: vi.fn(),
    createFolder: vi.fn(),
    setMasterpassFlag: vi.fn(),
    createTOTPSecret: vi.fn(),
    updateTOTPSecret: vi.fn(),
    listTOTPSecrets: vi.fn(),
    deleteTOTPSecret: vi.fn(),
    listRawTOTPSecrets: vi.fn(),
    setCredentialPinned: vi.fn(),
    setTotpPinned: vi.fn(),
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

  describe('Credential service wrappers', () => {
    it('delegates createCredential to VaultService.createCredential', async () => {
      const data = { title: 'My Login', username: 'user@example.com' } as any;
      const options = { linkedNoteIds: ['note-1'] };
      vi.mocked(VaultService.createCredential).mockResolvedValue({ $id: 'cred-1', ...data } as any);

      const res = await createCredential(data, options);
      expect(VaultService.createCredential).toHaveBeenCalledWith(data, options);
      expect(res).toEqual({ $id: 'cred-1', ...data });
    });

    it('delegates updateCredential to VaultService.updateCredential', async () => {
      const data = { title: 'My Login Updated' } as any;
      const options = { linkedNoteIds: ['note-2'] };
      vi.mocked(VaultService.updateCredential).mockResolvedValue({ $id: 'cred-1', ...data } as any);

      const res = await updateCredential('cred-1', data, options);
      expect(VaultService.updateCredential).toHaveBeenCalledWith('cred-1', data, options);
      expect(res).toEqual({ $id: 'cred-1', ...data });
    });

    it('delegates deleteCredential to VaultService.deleteCredential', async () => {
      vi.mocked(VaultService.deleteCredential).mockResolvedValue(true as any);

      const res = await deleteCredential('cred-1');
      expect(VaultService.deleteCredential).toHaveBeenCalledWith('cred-1');
      expect(res).toBe(true);
    });

    it('delegates listAllCredentials to VaultService.listAllCredentials', async () => {
      const mockCreds = [{ $id: 'cred-1' }];
      vi.mocked(VaultService.listAllCredentials).mockResolvedValue(mockCreds as any);

      const res = await listAllCredentials('user-1', ['query-1']);
      expect(VaultService.listAllCredentials).toHaveBeenCalledWith('user-1', ['query-1']);
      expect(res).toEqual(mockCreds);
    });

    it('delegates listRawCredentials to VaultService.listRawCredentials', async () => {
      const mockRaw = [{ $id: 'cred-raw-1' }];
      vi.mocked(VaultService.listRawCredentials).mockResolvedValue(mockRaw as any);

      const res = await listRawCredentials('user-1', ['query-1']);
      expect(VaultService.listRawCredentials).toHaveBeenCalledWith('user-1', ['query-1']);
      expect(res).toEqual(mockRaw);
    });
  });

  describe('TOTP service wrappers', () => {
    it('delegates createTotpSecret to VaultService.createTOTPSecret', async () => {
      const data = { accountName: 'GitHub', secretKey: 'secret' } as any;
      const options = { linkedNoteIds: ['note-1'] };
      vi.mocked(VaultService.createTOTPSecret).mockResolvedValue({ $id: 'totp-1', ...data } as any);

      const res = await createTotpSecret(data, options);
      expect(VaultService.createTOTPSecret).toHaveBeenCalledWith(data, options);
      expect(res).toEqual({ $id: 'totp-1', ...data });
    });

    it('delegates updateTotpSecret to VaultService.updateTOTPSecret', async () => {
      const data = { accountName: 'GitHub Updated' } as any;
      const options = { linkedNoteIds: ['note-2'] };
      vi.mocked(VaultService.updateTOTPSecret).mockResolvedValue({ $id: 'totp-1', ...data } as any);

      const res = await updateTotpSecret('totp-1', data, options);
      expect(VaultService.updateTOTPSecret).toHaveBeenCalledWith('totp-1', data, options);
      expect(res).toEqual({ $id: 'totp-1', ...data });
    });

    it('delegates listTotpSecrets to VaultService.listTOTPSecrets', async () => {
      const mockSecrets = [{ $id: 'totp-1' }];
      vi.mocked(VaultService.listTOTPSecrets).mockResolvedValue(mockSecrets as any);

      const res = await listTotpSecrets('user-1', ['query-1']);
      expect(VaultService.listTOTPSecrets).toHaveBeenCalledWith('user-1', ['query-1']);
      expect(res).toEqual(mockSecrets);
    });

    it('delegates deleteTotpSecret to VaultService.deleteTOTPSecret', async () => {
      vi.mocked(VaultService.deleteTOTPSecret).mockResolvedValue(true as any);

      const res = await deleteTotpSecret('totp-1');
      expect(VaultService.deleteTOTPSecret).toHaveBeenCalledWith('totp-1');
      expect(res).toBe(true);
    });

    it('delegates listRawTotpSecrets to VaultService.listRawTOTPSecrets', async () => {
      const mockRaw = [{ $id: 'totp-raw-1' }];
      vi.mocked(VaultService.listRawTOTPSecrets).mockResolvedValue(mockRaw as any);

      const res = await listRawTotpSecrets('user-1', ['query-1']);
      expect(VaultService.listRawTOTPSecrets).toHaveBeenCalledWith('user-1', ['query-1']);
      expect(res).toEqual(mockRaw);
    });
  });

  describe('folder and masterpass wrappers', () => {
    it('delegates createFolder to VaultService.createFolder', async () => {
      const folderData = { name: 'Work', userId: 'user-1' } as any;
      vi.mocked(VaultService.createFolder).mockResolvedValue({ $id: 'folder-1', ...folderData } as any);

      const res = await createFolder(folderData);
      expect(VaultService.createFolder).toHaveBeenCalledWith(folderData);
      expect(res).toEqual({ $id: 'folder-1', ...folderData });
    });

    it('delegates setMasterpassFlag to VaultService.setMasterpassFlag', async () => {
      vi.mocked(VaultService.setMasterpassFlag).mockResolvedValue(undefined as any);

      await setMasterpassFlag('user-1', 'test@example.com');
      expect(VaultService.setMasterpassFlag).toHaveBeenCalledWith('user-1', 'test@example.com');
    });
  });

  describe('listFolders', () => {
    it('returns response.rows when response has rows property', async () => {
      const mockFolders = [{ $id: 'folder-1', name: 'Work' }];
      vi.mocked(vaultDatabases.listRows).mockResolvedValue({ rows: mockFolders } as any);

      const result = await listFolders('user-1');
      expect(result).toEqual(mockFolders);
    });

    it('returns response array directly when response.rows is undefined', async () => {
      const mockFolders = [{ $id: 'folder-2', name: 'Personal' }];
      vi.mocked(vaultDatabases.listRows).mockResolvedValue(mockFolders as any);

      const result = await listFolders('user-1');
      expect(result).toEqual(mockFolders);
    });
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
    it('throws error when validateFileUploadLimit fails (file size limit exceeded)', async () => {
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: '[]' } as any);

      const framework = await import('@/lib/storage/framework');
      vi.mocked(framework.validateFileUploadLimit).mockImplementationOnce(() => {
        throw new Error('File size (12.0MB) exceeds the maximum limit of 5.0MB for this upload.');
      });

      const clientOps = await import('@/lib/actions/client-ops');

      const oversizedFile = new File(['oversized'], 'large-file.pdf', { type: 'application/pdf' });

      await expect(addAttachmentToCredential('cred-1', oversizedFile)).rejects.toThrow(
        'File size (12.0MB) exceeds the maximum limit of 5.0MB for this upload.'
      );

      expect(framework.compressImageToWebP).not.toHaveBeenCalled();
      expect(clientOps.secureUploadFile).not.toHaveBeenCalled();
      expect(VaultService.updateCredential).not.toHaveBeenCalled();
    });

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

    it('falls back to original file and logs warning if image compression fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: 'invalid-json' } as any);

      const framework = await import('@/lib/storage/framework');
      vi.mocked(framework.getFileTypeCategory).mockReturnValue('image');
      const compressionError = new Error('Compression failed');
      vi.mocked(framework.compressImageToWebP).mockRejectedValue(compressionError);

      const clientOps = await import('@/lib/actions/client-ops');
      vi.mocked(clientOps.secureUploadFile).mockResolvedValue({ $id: 'file-fallback' });

      vi.mocked(VaultService.updateCredential).mockResolvedValue({ id: 'cred-1' } as any);

      const testFile = new File(['image-bytes'], 'image.png', { type: 'image/png' });
      await addAttachmentToCredential('cred-1', testFile);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[vault-attachments] Client-side image compression failed, falling back to original:',
        compressionError
      );
      expect(clientOps.secureUploadFile).toHaveBeenCalled();
      expect(VaultService.updateCredential).toHaveBeenCalled();
    });

    it('throws custom error when secureUploadFile fails with error message', async () => {
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: '[]' } as any);

      const clientOps = await import('@/lib/actions/client-ops');
      vi.mocked(clientOps.secureUploadFile).mockRejectedValue(new Error('Upload quota exceeded'));

      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      await expect(addAttachmentToCredential('cred-1', testFile)).rejects.toThrow('Upload quota exceeded');
    });

    it('throws default fallback error message "Server upload failed" when secureUploadFile error has no message', async () => {
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: '[]' } as any);

      const clientOps = await import('@/lib/actions/client-ops');
      vi.mocked(clientOps.secureUploadFile).mockRejectedValue({});

      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      await expect(addAttachmentToCredential('cred-1', testFile)).rejects.toThrow('Server upload failed');
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

    it('catches storage deletion errors gracefully, logs console.warn, and proceeds with credential update', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const existing = [{ id: 'file-1', name: 'f1.pdf', size: 10, mime: 'application/pdf', createdAt: '2025-01-01' }];
      const storageError = new Error('File not found in storage');

      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: JSON.stringify(existing) } as any);
      vi.mocked(storage.deleteFile).mockRejectedValue(storageError);
      vi.mocked(VaultService.updateCredential).mockResolvedValue({ id: 'cred-1' } as any);

      await deleteCredentialAttachment('cred-1', 'file-1');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[vault-attachments] Failed to delete file from storage (might already be deleted):',
        storageError
      );
      expect(VaultService.updateCredential).toHaveBeenCalledWith(
        'cred-1',
        expect.objectContaining({
          attachments: JSON.stringify([]),
        })
      );
    });

    it('rejects when VaultService.updateCredential throws error', async () => {
      const existing = [{ id: 'file-1', name: 'f1.pdf', size: 10, mime: 'application/pdf', createdAt: '2025-01-01' }];
      vi.mocked(VaultService.getCredential).mockResolvedValue({ attachments: JSON.stringify(existing) } as any);
      vi.mocked(storage.deleteFile).mockResolvedValue({} as any);
      vi.mocked(VaultService.updateCredential).mockRejectedValue(new Error('Database update failed'));

      await expect(deleteCredentialAttachment('cred-1', 'file-1')).rejects.toThrow('Database update failed');
    });
  });

  describe('setCredentialPinned & setTotpPinned', () => {
    it('delegates setCredentialPinned to VaultService.setCredentialPinned', async () => {
      vi.mocked(VaultService.setCredentialPinned).mockResolvedValue({ id: 'cred-1', pinned: true } as any);
      const res = await setCredentialPinned('cred-1', true);
      expect(VaultService.setCredentialPinned).toHaveBeenCalledWith('cred-1', true);
      expect(res).toEqual({ id: 'cred-1', pinned: true });
    });

    it('delegates setTotpPinned to VaultService.setTotpPinned', async () => {
      vi.mocked(VaultService.setTotpPinned).mockResolvedValue({ id: 'totp-1', pinned: true } as any);
      const res = await setTotpPinned('totp-1', true);
      expect(VaultService.setTotpPinned).toHaveBeenCalledWith('totp-1', true);
      expect(res).toEqual({ id: 'totp-1', pinned: true });
    });
  });

  describe('logoutAppwrite', () => {
    it('handles deleteSession error gracefully without crashing', async () => {
      vi.mocked(account.deleteSession).mockRejectedValue(new Error('No session active'));
      await expect(logoutAppwrite()).resolves.not.toThrow();
    });

    it('invokes purgeAllClientStorageOnLogout even when deleteSession fails in window environment', async () => {
      vi.mocked(account.deleteSession).mockRejectedValue(new Error('Session network failure'));
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

    it('invokes purgeAllClientStorageOnLogout when window is defined and deleteSession succeeds', async () => {
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

    it('does not invoke purgeAllClientStorageOnLogout when window is undefined (server side)', async () => {
      vi.mocked(account.deleteSession).mockResolvedValue({} as any);
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      try {
        await logoutAppwrite();
        expect(purgeAllClientStorageOnLogout).not.toHaveBeenCalled();
      } finally {
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

    it('returns null and logs error on server-side if admin databases.getRow throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      try {
        const adminClient = createSystemClient();
        vi.mocked(adminClient.databases.getRow).mockRejectedValue(new Error('Admin DB error'));

        const result = await validatePublicVaultAccess('cred-srv-err');
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'validatePublicVaultAccess failed for cred-srv-err:',
          expect.any(Error)
        );
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

    it('returns null and logs error on server-side if admin databases.getRow throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      try {
        const adminClient = createSystemClient();
        vi.mocked(adminClient.databases.getRow).mockRejectedValue(new Error('Admin DB error'));

        const result = await validatePublicTotpAccess('totp-srv-err');
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'validatePublicTotpAccess failed for totp-srv-err:',
          expect.any(Error)
        );
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });
});
