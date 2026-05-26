import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from './di/registry';
import { DatabasePort, QueryExpression, ListRowsResult } from './ports/database.port';
import { NodeKeyService } from './federation/node-key';
import { TableDiffEngine, SyncRow } from './federation/diff-engine';
import { FederationSyncService } from './federation/sync-service';

describe('Kylrix Clean Architecture & Federation Test Suite', () => {

  // ==========================================
  // SECTION 1: Dependency Injection Registry
  // ==========================================
  describe('Service Registry (DI Locator)', () => {
    let mockDbPort: DatabasePort;

    beforeEach(() => {
      mockDbPort = {
        getRow: vi.fn(),
        listRows: vi.fn(),
        createRow: vi.fn(),
        updateRow: vi.fn(),
        deleteRow: vi.fn(),
      };
    });

    afterEach(() => {
      // Re-initialize default adapter state
      Registry.overrideDatabase(null as any);
    });

    it('should resolve the default AppwriteDatabaseAdapter if no override is set', () => {
      const db = Registry.getDatabase();
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe('AppwriteDatabaseAdapter');
    });

    it('should successfully override and resolve custom adapters', () => {
      Registry.overrideDatabase(mockDbPort);
      const resolved = Registry.getDatabase();
      expect(resolved).toBe(mockDbPort);
    });
  });

  // ==========================================
  // SECTION 2: Cryptographic Node Key Service
  // ==========================================
  describe('Node Cryptography & Handshakes', () => {
    it('should generate secure and valid Ed25519 key-pairs', () => {
      const keys = NodeKeyService.generateNodeKeypair();
      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      expect(keys.publicKey).toContain('PUBLIC KEY');
      expect(keys.privateKey).toContain('PRIVATE KEY');
    });

    it('should successfully sign payload and verify authentic signature', () => {
      const keys = NodeKeyService.generateNodeKeypair();
      const payload = 'challenge-nonce-12345';
      const signature = NodeKeyService.signPayload(payload, keys.privateKey);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');

      const isVerified = NodeKeyService.verifySignature(payload, signature, keys.publicKey);
      expect(isVerified).toBe(true);
    });

    it('should reject verified signature if payload has been mutated', () => {
      const keys = NodeKeyService.generateNodeKeypair();
      const payload = 'challenge-nonce-12345';
      const mutatedPayload = 'challenge-nonce-12345-hacked';
      const signature = NodeKeyService.signPayload(payload, keys.privateKey);

      const isVerified = NodeKeyService.verifySignature(mutatedPayload, signature, keys.publicKey);
      expect(isVerified).toBe(false);
    });

    it('should reject verified signature if public key is mismatch', () => {
      const keysA = NodeKeyService.generateNodeKeypair();
      const keysB = NodeKeyService.generateNodeKeypair();
      const payload = 'challenge-nonce-12345';
      const signature = NodeKeyService.signPayload(payload, keysA.privateKey);

      const isVerified = NodeKeyService.verifySignature(payload, signature, keysB.publicKey);
      expect(isVerified).toBe(false);
    });
  });

  // ==========================================
  // SECTION 3: Merkle Table & Row Diffing Engine
  // ==========================================
  describe('Merkle Table Diffing Engine', () => {
    it('should calculate identical SHA-256 digests for key-sorted row fields', () => {
      const rowA: SyncRow = {
        $id: 'row-1',
        $updatedAt: '2026-05-26T20:00:00.000Z',
        title: 'Modularity principles',
        status: 'published',
      };
      
      // Mismatched insertion order of parameters
      const rowB: SyncRow = {
        status: 'published',
        title: 'Modularity principles',
        $updatedAt: '2026-05-26T20:00:00.000Z',
        $id: 'row-1',
      };

      const hashA = TableDiffEngine.calculateRowHash(rowA);
      const hashB = TableDiffEngine.calculateRowHash(rowB);

      expect(hashA).toBe(hashB);
      expect(hashA).toBeDefined();
    });

    it('should return completely empty delta arrays when local and remote tables are in sync', () => {
      const localRows: SyncRow[] = [
        { $id: '1', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'A' },
        { $id: '2', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'B' },
      ];
      const remoteRows: SyncRow[] = [
        { $id: '1', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'A' },
        { $id: '2', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'B' },
      ];

      const diff = TableDiffEngine.diffTables(localRows, remoteRows);

      expect(diff.missingLocally).toHaveLength(0);
      expect(diff.missingRemotely).toHaveLength(0);
      expect(diff.outdatedLocally).toHaveLength(0);
      expect(diff.outdatedRemotely).toHaveLength(0);
      expect(diff.conflicts).toHaveLength(0);
    });

    it('should identify missing or outdated local and remote rows', () => {
      const localRows: SyncRow[] = [
        { $id: 'row-1', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'Older Title' }, // Outdated locally
        { $id: 'row-2', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'Only Local' },  // Missing remotely
      ];
      
      const remoteRows: SyncRow[] = [
        { $id: 'row-1', $updatedAt: '2026-05-26T21:00:00.000Z', title: 'Newer Title' }, // Outdated locally
        { $id: 'row-3', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'Only Remote' }, // Missing locally
      ];

      const diff = TableDiffEngine.diffTables(localRows, remoteRows);

      expect(diff.outdatedLocally).toEqual(['row-1']);
      expect(diff.missingRemotely).toEqual(['row-2']);
      expect(diff.missingLocally).toEqual(['row-3']);
      expect(diff.outdatedRemotely).toHaveLength(0);
      expect(diff.conflicts).toHaveLength(0);
    });

    it('should capture conflicts when row versions share identical timestamps but have different contents', () => {
      const localRows: SyncRow[] = [
        { $id: 'row-1', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'A' },
      ];
      const remoteRows: SyncRow[] = [
        { $id: 'row-1', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'B' },
      ];

      const diff = TableDiffEngine.diffTables(localRows, remoteRows);

      expect(diff.conflicts).toEqual(['row-1']);
      expect(diff.outdatedLocally).toHaveLength(0);
      expect(diff.outdatedRemotely).toHaveLength(0);
    });
  });

  // ==========================================
  // SECTION 4: Federated Sync Orchestrator
  // ==========================================
  describe('Federated Sync Orchestration', () => {
    let mockDbPort: DatabasePort;

    beforeEach(() => {
      mockDbPort = {
        getRow: vi.fn(),
        listRows: vi.fn(),
        createRow: vi.fn(),
        updateRow: vi.fn(),
        deleteRow: vi.fn(),
      };
      Registry.overrideDatabase(mockDbPort);
    });

    afterEach(() => {
      Registry.overrideDatabase(null as any);
    });

    it('should orchestrate creating missing rows and updating outdated rows locally', async () => {
      const localRows: SyncRow[] = [
        { $id: 'row-1', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'Older Local' },
      ];

      // Setup mock return
      vi.mocked(mockDbPort.listRows).mockResolvedValue({
        total: 1,
        rows: localRows,
      });

      const remoteRows: SyncRow[] = [
        { $id: 'row-1', $updatedAt: '2026-05-26T21:00:00.000Z', title: 'Newer Remote' }, // Outdated locally -> Update
        { $id: 'row-2', $updatedAt: '2026-05-26T20:00:00.000Z', title: 'Missing Local' }, // Missing locally -> Create
      ];

      const result = await FederationSyncService.syncTableWithRemote('db-1', 'table-1', remoteRows);

      // Verify listRows was queried
      expect(mockDbPort.listRows).toHaveBeenCalledTimes(1);

      // Verify row creation
      expect(mockDbPort.createRow).toHaveBeenCalledTimes(1);
      expect(mockDbPort.createRow).toHaveBeenCalledWith(
        'db-1',
        'table-1',
        'row-2',
        { title: 'Missing Local' },
        undefined,
        undefined
      );

      // Verify row update
      expect(mockDbPort.updateRow).toHaveBeenCalledTimes(1);
      expect(mockDbPort.updateRow).toHaveBeenCalledWith(
        'db-1',
        'table-1',
        'row-1',
        { title: 'Newer Remote' },
        undefined,
        undefined
      );

      expect(result.syncedCount).toBe(2);
      expect(result.conflictsCount).toBe(0);
    });
  });
});
