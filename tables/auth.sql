-- Tables: user, session, account, verification, apikey
-- Purpose: Better Auth identity, active sessions, and personal access tokens (PATs).

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
