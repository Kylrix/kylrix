-- Tables: keychain, totp_secrets, vault_items
-- Purpose: Zero-knowledge client-encrypted security enclave data.
-- Key strategy: ULID (26-character time-sortable).

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
