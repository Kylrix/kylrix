/**
 * Kylrix Self-Host Database Bootstrapper
 * Initializes libSQL / Turso schema and verifies readiness.
 */
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'http://localhost:8080';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

console.log(`[Self-Host Bootstrap] Connecting to Turso/libSQL at ${url}...`);

const client = createClient({ url, authToken });

const statements = [
  // 1. Better Auth Core
  `CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    token_type TEXT NOT NULL DEFAULT 'web',
    client_name TEXT DEFAULT 'Web Browser',
    workspace_id TEXT,
    scopes TEXT,
    last_active_at INTEGER
  );`,
  `CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);`,
  `CREATE INDEX IF NOT EXISTS idx_session_token_type ON session(token_type);`,

  `CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at INTEGER,
    refresh_token_expires_at INTEGER,
    scope TEXT,
    password TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_account_provider ON account(provider_id, account_id);`,

  `CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  );`,
  `CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);`,

  `CREATE TABLE IF NOT EXISTS apikey (
    id TEXT PRIMARY KEY,
    name TEXT,
    start TEXT,
    prefix TEXT,
    key TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    refill_interval INTEGER,
    refill_amount INTEGER,
    last_refill_at INTEGER,
    enabled INTEGER DEFAULT 1,
    rate_limit_enabled INTEGER DEFAULT 0,
    rate_limit_time_window INTEGER,
    rate_limit_max INTEGER,
    request_count INTEGER DEFAULT 0,
    remaining INTEGER,
    last_request INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    permissions TEXT,
    metadata TEXT,
    category TEXT NOT NULL DEFAULT 'user_pat',
    workspace_id TEXT,
    is_workspace INTEGER DEFAULT 0,
    display_in_sessions INTEGER DEFAULT 0,
    client_name TEXT,
    last_used_at INTEGER
  );`,
  `CREATE INDEX IF NOT EXISTS idx_apikey_user_id ON apikey(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_apikey_key ON apikey(key);`,
  `CREATE INDEX IF NOT EXISTS idx_apikey_category ON apikey(category);`,
  `CREATE INDEX IF NOT EXISTS idx_apikey_display_sessions ON apikey(display_in_sessions);`,

  // 2. Workspaces & Members
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    slug TEXT,
    invite_code TEXT,
    is_public INTEGER DEFAULT 0,
    is_agentic INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    privacy_mode INTEGER DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_creator ON workspaces(creator_id);`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_agentic ON workspaces(is_agentic);`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_invite_code ON workspaces(invite_code);`,

  `CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_pair ON workspace_members(workspace_id, user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);`,

  `CREATE TABLE IF NOT EXISTS workspace_objects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_kind TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_wo_workspace_id ON workspace_objects(workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_wo_entity ON workspace_objects(entity_kind, entity_id);`,
  `CREATE INDEX IF NOT EXISTS idx_wo_user_id ON workspace_objects(user_id);`,

  // 3. Ideas & Goals
  `CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    summary TEXT,
    is_locked INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_trashed INTEGER DEFAULT 0,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    category TEXT,
    tags TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON ideas(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_workspace_id ON ideas(workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_trashed ON ideas(is_trashed);`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_pinned ON ideas(is_pinned);`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at);`,

  `CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    due_date TEXT,
    completed_at TEXT,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    tags TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_goals_workspace_id ON goals(workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);`,
  `CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);`,
  `CREATE INDEX IF NOT EXISTS idx_goals_due_date ON goals(due_date);`,
  `CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);`,

  // 4. Forms & Responses
  `CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    schema_json TEXT NOT NULL,
    is_public INTEGER DEFAULT 1,
    is_closed INTEGER DEFAULT 0,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_forms_user_id ON forms(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_forms_workspace_id ON forms(workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_forms_public ON forms(is_public);`,

  `CREATE TABLE IF NOT EXISTS form_responses (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    respondent_id TEXT REFERENCES user(id) ON DELETE SET NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);`,
  `CREATE INDEX IF NOT EXISTS idx_form_responses_respondent ON form_responses(respondent_id);`,
  `CREATE INDEX IF NOT EXISTS idx_form_responses_created_at ON form_responses(created_at);`,

  // 5. Events
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT,
    is_all_day INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_events_creator_id ON events(creator_id);`,
  `CREATE INDEX IF NOT EXISTS idx_events_workspace_id ON events(workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);`,

  // 6. Security & Vault
  `CREATE TABLE IF NOT EXISTS keychain (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    account TEXT NOT NULL,
    type TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    nonce TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_keychain_user_id ON keychain(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_keychain_account ON keychain(account);`,

  `CREATE TABLE IF NOT EXISTS totp_secrets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    account TEXT NOT NULL,
    encrypted_secret TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_totp_user_id ON totp_secrets(user_id);`,

  `CREATE TABLE IF NOT EXISTS vault_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    iv TEXT,
    metadata TEXT,
    is_trashed INTEGER DEFAULT 0,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_vault_items_user_id ON vault_items(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_vault_items_workspace_id ON vault_items(workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_vault_items_trashed ON vault_items(is_trashed);`,

  // 7. Threads & Messages
  `CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    title TEXT DEFAULT '',
    is_locked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_threads_creator_id ON threads(creator_id);`,
  `CREATE INDEX IF NOT EXISTS idx_threads_target ON threads(target_kind, target_id);`,

  `CREATE TABLE IF NOT EXISTS thread_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_tm_thread_id ON thread_messages(thread_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tm_sender_id ON thread_messages(sender_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tm_created_at ON thread_messages(created_at);`
];

async function bootstrap() {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✅ [Self-Host Bootstrap] All Turso/libSQL tables and indexes successfully provisioned!');
}

bootstrap().catch((err) => {
  console.error('❌ [Self-Host Bootstrap] Failed:', err);
  process.exit(1);
});
