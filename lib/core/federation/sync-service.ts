import { Registry } from '../di/registry';
import { TableDiffEngine, SyncRow } from './diff-engine';

export class FederationSyncService {
  /**
   * Synchronizes a specific Table's rows between the local database and a remote payload.
   * Leverages DatabasePort and TableDiffEngine under our hexagonal backend registry.
   */
  static async syncTableWithRemote(
    databaseId: string,
    tableId: string,
    remoteRows: SyncRow[],
    options?: { jwt?: string }
  ): Promise<{ syncedCount: number; conflictsCount: number }> {
    const db = Registry.getDatabase();

    // 1. Fetch all local rows
    const localResult = await db.listRows<SyncRow>(databaseId, tableId, [], options);
    const localRows = localResult.rows;

    // 2. Perform delta analysis
    const diff = TableDiffEngine.diffTables(localRows, remoteRows);

    let syncedCount = 0;
    const conflictsCount = diff.conflicts.length;

    // 3. Resolve missing locally: Create new rows in the local database
    for (const rowId of diff.missingLocally) {
      const remoteRow = remoteRows.find((r) => r.$id === rowId);
      if (remoteRow) {
        // Strip appwrite metadata fields before insertion
        const cleanData = { ...remoteRow };
        delete cleanData.$id;
        delete cleanData.$createdAt;
        delete cleanData.$updatedAt;
        delete cleanData.$permissions;
        delete cleanData.$databaseId;
        delete cleanData.$tableId;
        delete cleanData.$collectionId;

        await db.createRow(databaseId, tableId, rowId, cleanData, undefined, options);
        syncedCount++;
      }
    }

    // 4. Resolve outdated locally: Update older local rows
    for (const rowId of diff.outdatedLocally) {
      const remoteRow = remoteRows.find((r) => r.$id === rowId);
      if (remoteRow) {
        const cleanData = { ...remoteRow };
        delete cleanData.$id;
        delete cleanData.$createdAt;
        delete cleanData.$updatedAt;
        delete cleanData.$permissions;
        delete cleanData.$databaseId;
        delete cleanData.$tableId;
        delete cleanData.$collectionId;

        await db.updateRow(databaseId, tableId, rowId, cleanData, undefined, options);
        syncedCount++;
      }
    }

    return {
      syncedCount,
      conflictsCount,
    };
  }
}
