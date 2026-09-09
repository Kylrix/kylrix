import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from './import-service';

vi.mock('@/lib/appwrite', () => ({
  createFolder: vi.fn().mockImplementation((folder) => Promise.resolve({ $id: `folder-${folder.name}`, name: folder.name })),
  AppwriteService: {
    listFolders: vi.fn().mockResolvedValue([{ $id: 'f-existing', name: 'Existing Workspace' }]),
  },
}));

vi.mock('@/lib/appwrite/vault-service', () => ({
  VaultService: {
    stageCredentialImport: vi.fn().mockResolvedValue({ $id: 'cred-1' }),
    stageTotpImport: vi.fn().mockResolvedValue({ $id: 'totp-1' }),
  },
}));

vi.mock('@/lib/vault/import-local-batch', () => ({
  startImportBatch: vi.fn().mockResolvedValue('batch-123'),
  kickImportSync: vi.fn(),
}));

vi.mock('@/lib/porter/sanitize-import', () => ({
  sanitizeImportBundle: vi.fn().mockImplementation((bundle) => ({
    credentials: bundle.credentials || [],
    totpSecrets: bundle.totpSecrets || [],
    workspaces: bundle.workspaces || bundle.folders || [],
    folders: bundle.folders || [],
    skippedInvalid: 0,
    skippedDuplicate: 0,
    skippedDuplicateIncoming: 0,
  })),
  loadExistingVaultForDedupe: vi.fn().mockResolvedValue({ credentials: [], totpSecrets: [] }),
}));

describe('ImportService', () => {
  const userId = 'user-test-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importBitwardenData', () => {
    it('fails when JSON format is invalid', async () => {
      const progressFn = vi.fn();
      const service = new ImportService(progressFn);

      const result = await service.importBitwardenData(JSON.stringify({ encrypted: true }), userId);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(progressFn).toHaveBeenCalledWith(expect.objectContaining({ stage: 'error' }));
    });

    it('fails when no credentials are present in Bitwarden export', async () => {
      const service = new ImportService();
      const exportNoCreds = {
        encrypted: false,
        folders: [],
        items: [],
      };

      const result = await service.importBitwardenData(JSON.stringify(exportNoCreds), userId);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No login credentials found');
    });

    it('successfully imports valid Bitwarden export', async () => {
      const progressFn = vi.fn();
      const service = new ImportService(progressFn);
      const validBitwardenExport = {
        encrypted: false,
        folders: [{ id: 'f1', name: 'Work' }],
        items: [
          {
            id: 'item-1',
            type: 1,
            name: 'GitHub',
            folderId: 'f1',
            login: {
              username: 'user1',
              password: 'pass1',
              totp: 'JBSWY3DPEHPK3PXP',
              uris: [{ uri: 'https://github.com' }],
            },
          },
        ],
      };

      const result = await service.importBitwardenData(JSON.stringify(validBitwardenExport), userId);

      expect(result.success).toBe(true);
      expect(result.summary.credentialsCreated).toBe(1);
      expect(result.summary.totpSecretsCreated).toBe(1);
      expect(progressFn).toHaveBeenCalledWith(expect.objectContaining({ stage: 'completed' }));
    });
  });

  describe('importKylrixVaultData', () => {
    it('fails when export format is invalid', async () => {
      const service = new ImportService();
      const result = await service.importKylrixVaultData(JSON.stringify({ invalid: 'data' }), userId);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid Kylrix Vault export format');
    });

    it('successfully imports valid Kylrix Vault export with all optional fields and folder mappings', async () => {
      const progressFn = vi.fn();
      const service = new ImportService(progressFn);
      const validVaultExport = {
        version: 1,
        workspaces: [{ $id: 'w1', name: 'Dev Workspace' }],
        credentials: [
          {
            name: 'AWS Console',
            username: 'admin',
            password: 'secretpassword',
            url: 'https://aws.amazon.com',
            notes: 'AWS root account',
            folderId: 'w1',
            tags: ['cloud', 'aws'],
            customFields: { env: 'production' },
            totpId: 'totp-123',
            cardNumber: '4111',
            cardholderName: 'Admin',
            cardExpiry: '12/28',
            cardCVV: '123',
            cardPIN: '9999',
            cardType: 'visa',
            faviconUrl: 'https://aws.com/favicon.ico',
            _mergeTargetId: 'merge-target-1',
          },
        ],
        totpSecrets: [
          {
            issuer: 'AWS',
            accountName: 'admin',
            secretKey: 'JBSWY3DPEHPK3PXP',
            folderId: 'w1',
            url: 'https://aws.amazon.com',
            tags: ['2fa'],
            isFavorite: true,
            isDeleted: false,
            _mergeTargetId: 'totp-merge-1',
          },
        ],
      };

      const result = await service.importKylrixVaultData(JSON.stringify(validVaultExport), userId);

      expect(result.success).toBe(true);
      expect(result.summary.foldersCreated).toBe(1);
      expect(result.summary.credentialsCreated).toBe(1);
      expect(result.summary.totpSecretsCreated).toBe(1);
      expect(progressFn).toHaveBeenCalledWith(expect.objectContaining({ stage: 'completed' }));
    });
  });
});
