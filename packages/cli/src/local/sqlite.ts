import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { resolveEnvironment } from '../config';

/**
 * Canonical Appwrite-compatible unique ID generator.
 * Generates standard 20-character hexadecimal IDs matching Appwrite's ID.unique()
 * (hex timestamp + 7-character hex random padding) for complete parity with the Web UI.
 */
export function generateLocalId(_prefix?: string): string {
  const now = new Date();
  const sec = Math.floor(now.getTime() / 1000);
  const msec = now.getMilliseconds();
  const hexTimestamp = sec.toString(16) + msec.toString(16).padStart(5, '0');
  let randomPadding = '';
  for (let i = 0; i < 7; i++) {
    randomPadding += Math.floor(Math.random() * 16).toString(16);
  }
  return hexTimestamp + randomPadding;
}

const dbInstances = new Map<string, any>();

export function getNativeSqlite(): any {
  try {
    // Intercept and suppress ExperimentalWarning for node:sqlite
    const origEmit = process.emit;
    (process as any).emit = function (name: string, data: any, ...args: any[]) {
      if (
        name === 'warning' &&
        (data?.name === 'ExperimentalWarning' ||
          String(data?.message || '').toLowerCase().includes('sqlite') ||
          String(data || '').toLowerCase().includes('sqlite'))
      ) {
        return false;
      }
      return origEmit.apply(process, [name, data, ...args]);
    };

    const origEmitWarning = (process as any).emitWarning;
    if (typeof origEmitWarning === 'function') {
      (process as any).emitWarning = function (warning: any, ...args: any[]) {
        if (
          (typeof warning === 'string' && warning.toLowerCase().includes('sqlite')) ||
          (typeof warning === 'object' &&
            (warning?.name === 'ExperimentalWarning' ||
              String(warning?.message || '').toLowerCase().includes('sqlite')))
        ) {
          return;
        }
        return origEmitWarning.apply(process, [warning, ...args]);
      };
    }

    const require = createRequire(import.meta.url);
    const sqlite = require('node:sqlite');
    return sqlite.DatabaseSync || sqlite.default?.DatabaseSync;
  } catch {
    return null;
  }
}

export function getDatabase(targetDbPath?: string, cliOptions?: { url?: string; token?: string; workspace?: string }): any {
  const env = resolveEnvironment(cliOptions);
  const dbPath = targetDbPath || env.siloDbPath;

  if (dbInstances.has(dbPath)) {
    return dbInstances.get(dbPath);
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const DatabaseSync = getNativeSqlite();
  if (DatabaseSync) {
    const db = new DatabaseSync(dbPath);
    initSqliteSchema(db);
    dbInstances.set(dbPath, db);
    return db;
  }

  return null;
}

export function resetDatabaseConnections(): void {
  for (const db of dbInstances.values()) {
    try {
      db?.close?.();
    } catch {}
  }
  dbInstances.clear();
}

function initSqliteSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      category TEXT DEFAULT 'general',
      tags TEXT,
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      target_value REAL DEFAULT 100,
      current_value REAL DEFAULT 0,
      unit TEXT DEFAULT '%',
      status TEXT DEFAULT 'not_started',
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT,
      password TEXT,
      url TEXT,
      notes TEXT,
      is_env INTEGER DEFAULT 0,
      custom_fields TEXT,
      item_type TEXT DEFAULT 'login',
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS totp (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      secret TEXT NOT NULL,
      issuer TEXT,
      account TEXT,
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      description TEXT,
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      schema TEXT,
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366F1',
      is_local INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS trash (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      deleted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS external_contexts (
      id TEXT PRIMARY KEY,
      client TEXT NOT NULL,
      directory TEXT,
      workspace_id TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      payload TEXT,
      status TEXT DEFAULT 'connected',
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connected_tools (
      id TEXT PRIMARY KEY,
      client TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      directory TEXT,
      workspace_id TEXT,
      connected_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      status TEXT DEFAULT 'connected',
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ideas_updated ON ideas(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
    CREATE INDEX IF NOT EXISTS idx_ext_ctx_client ON external_contexts(client);
    CREATE INDEX IF NOT EXISTS idx_ext_ctx_dir ON external_contexts(directory);
  `);

  // Migrate existing tables if sync_status or cloud_id columns are missing
  try { db.exec("ALTER TABLE ideas ADD COLUMN sync_status TEXT DEFAULT 'unsynced'"); } catch {}
  try { db.exec("ALTER TABLE ideas ADD COLUMN cloud_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE goals ADD COLUMN sync_status TEXT DEFAULT 'unsynced'"); } catch {}
  try { db.exec("ALTER TABLE goals ADD COLUMN cloud_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE vault ADD COLUMN sync_status TEXT DEFAULT 'unsynced'"); } catch {}
  try { db.exec("ALTER TABLE vault ADD COLUMN cloud_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE totp ADD COLUMN sync_status TEXT DEFAULT 'unsynced'"); } catch {}
  try { db.exec("ALTER TABLE totp ADD COLUMN cloud_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN sync_status TEXT DEFAULT 'unsynced'"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN cloud_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE forms ADD COLUMN sync_status TEXT DEFAULT 'unsynced'"); } catch {}
  try { db.exec("ALTER TABLE forms ADD COLUMN cloud_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE flows ADD COLUMN sync_status TEXT DEFAULT 'unsynced'"); } catch {}
  try { db.exec("ALTER TABLE flows ADD COLUMN cloud_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE external_contexts ADD COLUMN sync_status TEXT DEFAULT 'unsynced'"); } catch {}
  try { db.exec("ALTER TABLE external_contexts ADD COLUMN cloud_id TEXT"); } catch {}
}
