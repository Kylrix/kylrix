import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeCredentialAttachmentsField,
  addAttachmentToCredential,
  deleteCredentialAttachment,
  logoutAppwrite,
  validatePublicVaultAccess,
  validatePublicTotpAccess,
} from './vault-actions';
import { VaultService, vaultDatabases } from './vault-service';
import { account, storage } from './client';

// Mock dependencies
vi.mock('./vault-service', () => ({
  VaultService: {
    getCredential: vi.fn(),
    updateCredential: vi.fn(),
  },
  vaultDatabases: {
    getRow: vi.fn(),
  },
  APPWRITE_COLLECTION_CREDENTIALS_ID: 'credentials_id',
  APPWRITE_COLLECTION_TOTPSECRETS_ID: 'totp_id',
}));

vi.mock('./client', () => ({
  APPWRITE_DATABASE_ID: 'db_id',
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

describe('vault-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('handles JSON parsing errors gracefully when raw string is malformed JSON (error path)', () => {
      const invalidCredential = { attachments: '{ invalid json string ' };
      // Should catch the error in try-catch and return []
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
  });
});
