-- ========================================================
-- KYLRIX SINGLE-DATABASE SQL SCHEMA
-- Target: Turso (libSQL) / SQLite
-- Database Name: passwordManagerDb (unified single-database)
-- Primary Key Strategy: 26-character ULID (millisecond sortable)
-- ========================================================

PRAGMA foreign_keys = ON;

-- 1. BETTER AUTH TABLES
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "email_verified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY,
  "expires_at" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_session_user_id" ON "session"("user_id");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" INTEGER,
  "refresh_token_expires_at" INTEGER,
  "scope" TEXT,
  "password" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_account_user_id" ON "account"("user_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" INTEGER NOT NULL,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE TABLE IF NOT EXISTS "apikey" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "start" TEXT,
  "prefix" TEXT,
  "key" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "refill_interval" INTEGER,
  "refill_amount" INTEGER,
  "last_refill_at" INTEGER,
  "enabled" INTEGER DEFAULT 1,
  "rate_limit_enabled" INTEGER DEFAULT 0,
  "rate_limit_time_window" INTEGER,
  "rate_limit_max" INTEGER,
  "request_count" INTEGER DEFAULT 0,
  "remaining" INTEGER,
  "last_request" INTEGER,
  "expires_at" INTEGER,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "permissions" TEXT,
  "metadata" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_apikey_user_id" ON "apikey"("user_id");
CREATE INDEX IF NOT EXISTS "idx_apikey_key" ON "apikey"("key");

-- 2. WORKSPACES & JOIN RELATIONS
CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT PRIMARY KEY, -- ULID
  "creator_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "invite_code" TEXT UNIQUE,
  "is_public" INTEGER DEFAULT 0,
  "is_agentic" INTEGER DEFAULT 0,
  "is_locked" INTEGER DEFAULT 0,
  "privacy_mode" INTEGER DEFAULT 0,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_projects_creator" ON "projects"("creator_id");
CREATE INDEX IF NOT EXISTS "idx_projects_invite_code" ON "projects"("invite_code");

CREATE TABLE IF NOT EXISTS "project_objects" (
  "id" TEXT PRIMARY KEY, -- ULID
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "entity_kind" TEXT NOT NULL, -- 'note' | 'goal' | 'task' | 'form' | 'event'
  "entity_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_project_objects_lookup" ON "project_objects"("project_id", "entity_kind", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_project_objects_user" ON "project_objects"("user_id");

-- 3. NOTES & KNOWLEDGE
CREATE TABLE IF NOT EXISTS "notes" (
  "id" TEXT PRIMARY KEY, -- ULID
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "is_locked" INTEGER DEFAULT 0,
  "is_published" INTEGER DEFAULT 0,
  "is_pinned" INTEGER DEFAULT 0,
  "is_trashed" INTEGER DEFAULT 0,
  "is_workspace" INTEGER DEFAULT 0,
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE SET NULL,
  "category" TEXT,
  "tags" TEXT, -- JSON array
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_notes_user_feed" ON "notes"("user_id", "is_trashed", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_notes_project" ON "notes"("project_id");

-- 4. TASKS & GOALS
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT PRIMARY KEY, -- ULID
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "priority" TEXT DEFAULT 'medium',
  "due_date" TEXT,
  "is_workspace" INTEGER DEFAULT 0,
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE SET NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_tasks_user_status" ON "tasks"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_project" ON "tasks"("project_id");

-- 5. ZERO-KNOWLEDGE KEYCHAIN & VAULT
CREATE TABLE IF NOT EXISTS "keychain" (
  "id" TEXT PRIMARY KEY, -- ULID or scoped identifier
  "user_id" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "type" TEXT NOT NULL, -- 'password' | 'passkey' | 'secret'
  "encrypted_payload" TEXT NOT NULL,
  "nonce" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_keychain_user" ON "keychain"("user_id", "type");

CREATE TABLE IF NOT EXISTS "totp_secrets" (
  "id" TEXT PRIMARY KEY, -- ULID
  "user_id" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "encrypted_secret" TEXT NOT NULL,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_totp_user" ON "totp_secrets"("user_id");

CREATE TABLE IF NOT EXISTS "vault_items" (
  "id" TEXT PRIMARY KEY, -- ULID
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "encrypted_data" TEXT NOT NULL,
  "iv" TEXT,
  "metadata" TEXT,
  "is_trashed" INTEGER DEFAULT 0,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_vault_items_user" ON "vault_items"("user_id", "is_trashed");
