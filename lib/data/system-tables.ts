import { Registry } from '@/lib/core/di/registry';
import type { SystemTablesPort } from '@/lib/data/system-tables.port';

const SYSTEM = { forceSystem: true as const };

/** Registry-backed system tables facade (Appwrite today; swappable via Registry.overrideDatabase). */
export function createRegistrySystemTables(): SystemTablesPort {
  const db = Registry.getDatabase();

  return {
    getRow: (args) => db.getRow(args.databaseId, args.tableId, args.rowId, SYSTEM),
    listRows: (args) => db.listRows(args.databaseId, args.tableId, args.queries, SYSTEM),
    createRow: (args) =>
      db.createRow(args.databaseId, args.tableId, args.rowId, args.data, args.permissions, SYSTEM),
    updateRow: (args) =>
      db.updateRow(args.databaseId, args.tableId, args.rowId, args.data, args.permissions, SYSTEM),
    deleteRow: (args) => db.deleteRow(args.databaseId, args.tableId, args.rowId, SYSTEM),
    incrementRowColumn: (args) => {
      if (!db.incrementRowColumn) {
        throw new Error('Active database backend does not support incrementRowColumn');
      }
      return db.incrementRowColumn(args, SYSTEM);
    },
  };
}

let cached: SystemTablesPort | null = null;

/** Privileged system tables access — use instead of createSystemTablesDB() in domain code. */
export function systemTables(): SystemTablesPort {
  if (!cached) cached = createRegistrySystemTables();
  return cached;
}

/** Test / multi-backend hook. */
export function overrideSystemTables(port: SystemTablesPort | null) {
  cached = port;
}
