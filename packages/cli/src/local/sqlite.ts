import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createRequire } from 'node:module';

const LOCAL_DIR = path.join(os.homedir(), '.kylrix');
const DB_FILE = path.join(LOCAL_DIR, 'local.db');

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

let dbInstance: any = null;

function getNativeSqlite(): any {
  try {
    const require = createRequire(import.meta.url);
    const sqlite = require('node:sqlite');
    return sqlite.DatabaseSync || sqlite.default?.DatabaseSync;
  } catch {
    return null;
  }
}

export function getDatabase(): any {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
  }

  const DatabaseSync = getNativeSqlite();
  if (DatabaseSync) {
    dbInstance = new DatabaseSync(DB_FILE);
    initSqliteSchema(dbInstance);
    return dbInstance;
  }

  return null;
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
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      description TEXT,
      is_local INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      schema TEXT,
      is_local INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      is_local INTEGER DEFAULT 1,
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

    CREATE INDEX IF NOT EXISTS idx_ideas_updated ON ideas(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
  `);
}
