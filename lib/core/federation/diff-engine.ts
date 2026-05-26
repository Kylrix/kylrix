import { createHash } from 'node:crypto';

export interface SyncRow {
  $id: string;
  $updatedAt: string;
  [key: string]: any;
}

export interface DiffResult {
  missingLocally: string[];
  missingRemotely: string[];
  outdatedLocally: string[];
  outdatedRemotely: string[];
  conflicts: string[];
}

export class TableDiffEngine {
  /**
   * Deterministically stringifies and generates a SHA-256 hash of a Table Row's content.
   * Ensures structure verification without transmitting large files or private variables.
   */
  static calculateRowHash(row: SyncRow): string {
    const cleanRow: Record<string, any> = {};
    const excludedKeys = new Set([
      '$databaseId',
      '$tableId',
      '$permissions',
      '$collectionId',
      '$rowId',
    ]);

    Object.keys(row)
      .sort()
      .forEach((key) => {
        if (!excludedKeys.has(key)) {
          cleanRow[key] = row[key];
        }
      });

    return createHash('sha256')
      .update(JSON.stringify(cleanRow))
      .digest('hex');
  }

  /**
   * Compares two sets of Table Rows (local vs remote) to determine syncing deltas.
   * Leverages strict Table and Row terminology mapping.
   */
  static diffTables(localRows: SyncRow[], remoteRows: SyncRow[]): DiffResult {
    const localMap = new Map<string, SyncRow>();
    localRows.forEach((r) => localMap.set(r.$id, r));

    const remoteMap = new Map<string, SyncRow>();
    remoteRows.forEach((r) => remoteMap.set(r.$id, r));

    const missingLocally: string[] = [];
    const missingRemotely: string[] = [];
    const outdatedLocally: string[] = [];
    const outdatedRemotely: string[] = [];
    const conflicts: string[] = [];

    localMap.forEach((localRow, rowId) => {
      const remoteRow = remoteMap.get(rowId);
      if (!remoteRow) {
        missingRemotely.push(rowId);
        return;
      }

      const localTime = new Date(localRow.$updatedAt).getTime();
      const remoteTime = new Date(remoteRow.$updatedAt).getTime();

      if (localTime < remoteTime) {
        outdatedLocally.push(rowId);
      } else if (localTime > remoteTime) {
        outdatedRemotely.push(rowId);
      } else {
        const localHash = this.calculateRowHash(localRow);
        const remoteHash = this.calculateRowHash(remoteRow);
        if (localHash !== remoteHash) {
          conflicts.push(rowId);
        }
      }
    });

    remoteMap.forEach((_, rowId) => {
      if (!localMap.has(rowId)) {
        missingLocally.push(rowId);
      }
    });

    return {
      missingLocally,
      missingRemotely,
      outdatedLocally,
      outdatedRemotely,
      conflicts,
    };
  }
}
