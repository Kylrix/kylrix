# Database Table Mapping: Appwrite to Turso

## Executive Summary

The Kylrix platform currently suffers from severe latency penalties (up to several minutes per batch load) caused by a dual-backend architecture. Application flows attempt to query or synchronize with remote Appwrite tables over HTTP/REST while simultaneously reconciling state against local/replicated Turso (libSQL/SQLite) tables.

Migrating completely to Turso resolves this bottleneck:
- **Sub-millisecond latency**: Turso queries execute on edge-replicated SQLite without multi-hop Appwrite HTTP API and RLS overhead.
- **Type safety & migrations**: Native Drizzle ORM definitions in [`lib/db/schema.ts`](file:///home/user/kylrix/lib/db/schema.ts) provide zero-drift type guarantees.
- **Single Source of Truth**: Eliminates "ghost" and "zombie" data discrepancies caused by partial synchronization between Appwrite and Turso.

---

## Complete Table Mapping (Appwrite ➔ Turso)

> In accordance with project instructions: each Appwrite table is mapped to its closest equivalent in Turso using `->`. Where no direct equivalent exists on either side, the corresponding end of the arrow is left empty.

| # | Appwrite Table (ID / Name) | | Turso Table (Drizzle Schema) | Domain / Category | Notes |
|:---|:---|:---:|:---|:---|:---|
| 1 | `user` (user) | -> | `user` | Auth & Identity | Appwrite user profile & sync status ➔ Better Auth user table |
| 2 | `identities` (Identities) | -> | `account` | Auth & Identity | Appwrite OAuth identities ➔ Better Auth OAuth account links |
| 3 | `profiles` (profiles) | -> | `profiles` | Auth & Identity | Public user profiles, bio, avatar, and social metadata |
| 4 | `settings` (Settings) | -> | `user_settings` | Auth & Identity | User preferences, theme, and application configuration |
| 5 | `user_badges` (User Badges) | -> | `user_badges` | Auth & Identity | Gamification and profile achievement badges |
| 6 | `referrals` (referrals) | -> | `referrals` | Auth & Identity | User referral and affiliate attribution records |
| 7 | `sponsorships` (Sponsorships) | -> | `sponsorships` | Auth & Identity | GitHub/community sponsorship links and tiers |
| 8 | `user_convenience_sessions` | -> | `user_convenience_sessions` | Auth & Sessions | Quick-resume and fast browser convenience sessions |
| 9 | `feed_sessions` (Feed Sessions) | -> | `user_convenience_sessions` | Auth & Sessions | Ephemeral feed activity and navigation session tokens |
| 10 | `credentials` (Credentials) | -> | `vault_items` | Vault & Security | Zero-knowledge passwords, logins, API keys, and secure notes |
| 11 | `keychain` (Keychain) | -> | `keychain` | Vault & Security | MasterPass / Passkey salt, nonce, and encrypted MEK wrapped keys |
| 12 | `key_mapping` (key_mapping) | -> | `key_mapping` | Vault & Security | Resource-to-encryption-key permission mappings |
| 13 | `totpSecrets` (TOTP Secrets) | -> | `totp_secrets` | Vault & Security | 2FA authenticator seeds, algorithm metadata, and counters |
| 14 | `securityLogs` (Security Logs) | -> | `security_logs` | Vault & Security | Audit trail of security events, auth failures, and logins |
| 15 | `user_keys` (user_keys) | -> | `agent_byok_keys` | Vault & Security | User-supplied BYOK AI provider API keys |
| 16 | `agent_byok_keys` | -> | `agent_byok_keys` | Vault & Security | Dedicated encrypted AI model API keys (OpenAI, Gemini, Anthropic) |
| 17 | `67ff05f3002502ef239e` (notes) | -> | `ideas` | Notes & Knowledge | Sovereign ideas and rich markdown notes |
| 18 | `67ff06280034908cf08a` (tags) | -> | `tags` | Notes & Knowledge | User and system taxonomy tags |
| 19 | `resource_tags` (resource_tags) | -> | `resource_tags` | Notes & Knowledge | Pivot table linking tags to ideas, goals, vaults, and workspaces |
| 20 | `user_resource_pins` | -> | `user_resource_pins` | Notes & Knowledge | Pinned ideas, vaults, goals, and dashboard bookmarks |
| 21 | `comments` (Comments) | -> | `comments` | Notes & Knowledge | Contextual comments on ideas and notes |
| 22 | `reactions` (Reactions) | -> | `reactions` | Notes & Knowledge | Emoji reactions on ideas, notes, and resources |
| 23 | `extensions` (Extensions) | -> | `extensions` | Notes & Knowledge | Custom plugins and renderer extensions for notes |
| 24 | `contexts` (Contexts) | -> | `contexts` | Notes & Knowledge | Local project contexts, IDE directory bindings, and prompts |
| 25 | `knowledge_graph` | -> | `knowledge_graph` | Notes & Knowledge | Entity-relation knowledge triplets and cross-note graph |
| 26 | `patterns` (Patterns) | -> | `patterns` | Notes & Knowledge | Recognized AI workflow patterns and reusable prompts |
| 27 | `tasks` (tasks) | -> | `goals` | Goals & Flows | Goal tracker, roadmap milestones, tasks, and habit tracking |
| 28 | `workflows` (workflows) | -> | `workflows` | Goals & Flows | Automations, flow pipelines, triggers, and execution graphs |
| 29 | `flow_installs` (flow_installs) | -> | `flow_installs` | Goals & Flows | Community and marketplace flow installation records |
| 30 | `flow_reviews` (flow_reviews) | -> | `flow_reviews` | Goals & Flows | User reviews, ratings, and feedback on workflow pipelines |
| 31 | `projects` (projects) | -> | `workspaces` | Workspaces | Team/agent workspace containers and isolation boundaries |
| 32 | `project_objects` (project_objects) | -> | `workspace_objects` | Workspaces | Relational join mapping linking entities to active workspaces |
| 33 | `forms` (forms) | -> | `forms` | Forms & Responses | Interactive dynamic forms, questionnaires, and surveys |
| 34 | `formSubmissions` (formSubmissions) | -> | `form_submissions` | Forms & Responses | Ingested form submission payloads and response data |
| 35 | `events` (events) | -> | `events` | Calendar & Time | Calendar events, deadlines, reminders, and scheduled meetings |
| 36 | `calendars` (calendars) | -> | `calendars` | Calendar & Time | Calendar categories, color profiles, and workspace schedules |
| 37 | `eventGuests` (eventGuests) | -> | `event_guests` | Calendar & Time | RSVP attendees, invites, and guests for calendar events |
| 38 | `conversations` (Conversations) | -> | `conversations` | Messaging & Chat | Direct messages, agent chat channels, and discussion rooms |
| 39 | `conversationMembers` | -> | `conversation_members` | Messaging & Chat | Participants, read cursors, and membership in chat channels |
| 40 | `messages` (Messages) | -> | `messages` | Messaging & Chat | Real-time chat messages, markdown payloads, and timestamps |
| 41 | `call_signals` (Call Signals) | -> | `call_signals` | Messaging & Chat | WebRTC peer signaling, ICE candidates, and call coordination |
| 42 | `telegram_connections` | -> | `telegram_connections` | Messaging & Chat | Telegram bot pairing links and webhook session tokens |
| 43 | `threads` (threads) | -> | `threads` | Unified Threads | Thread headers across ideas, goals, workspaces, and resources |
| 44 | `thread_messages` | -> | `thread_messages` | Unified Threads | Structured hierarchical discussion comments in threads |
| 45 | `thread_reactions` | -> | `thread_reactions` | Unified Threads | Emoji reactions on thread discussion messages |
| 46 | `messageReactions` | -> | `thread_reactions` | Unified Threads | Appwrite chat reactions ➔ consolidated thread reactions |
| 47 | `action_threads` (action_threads) | -> | `threads` | Unified Threads | Legacy action threads ➔ consolidated unified threads |
| 48 | `agentic_sessions` | -> | `agentic_sessions` | AI & Agents | Autonomous AI execution sessions and persistent memory |
| 49 | `tool_calls` (Tool Calls) | -> | `tool_calls` | AI & Agents | Audit log of tool execution invocations and arguments |
| 50 | `agentic_telemetry` | -> | `agentic_telemetry` | AI & Agents | Token consumption, step counts, and agent latency metrics |
| 51 | `anonymized_telemetry` | -> | `agentic_telemetry` | AI & Agents | Anonymized product telemetry ➔ unified telemetry table |
| 52 | `session_objects` | -> | `session_objects` | AI & Agents | Transient objects attached to an agent execution session |
| 53 | `agent_payment_intents` | -> | `agent_payment_intents` | AI & Agents | Escrow crypto intents for agent task execution |
| 54 | `pats` (pats) | -> | `apikey` | Developer & API | Personal Access Tokens (PATs) ➔ Better Auth apikey table |
| 55 | `oauth_apps` (oauth_apps) | -> | `oauth_client` | Developer & API | OAuth 2.1 client applications and registered redirect URIs |
| 56 | `oauth_app_installs` | -> | `oauth_client_resource` | Developer & API | User-authorized app installations and resource grants |
| 57 | `oauth_consent_requests` | -> | `oauth_consent` | Developer & API | Pending and granted OAuth 2.1 user consent approvals |
| 58 | `subscriptions` (subscriptions) | -> | `subscriptions` | Billing & Ledger | Active Pro/Team subscription status and expiry dates |
| 59 | `billing_transactions` | -> | `billing_transactions` | Billing & Ledger | BlockBee / Crypto checkout invoices and payment receipts |
| 60 | `billing_webhook_logs` | -> | `billing_webhook_logs` | Billing & Ledger | Webhook payloads received from payment gateways |
| 61 | `coupons` (coupons) | -> | `coupons` | Billing & Ledger | Promotional discount codes and redemption limits |
| 62 | `wallets` (wallets) | -> | `wallets` | Web3 & Ledger | Multi-chain crypto wallet addresses and identity binds |
| 63 | `web3_transactions` | -> | `web3_transactions` | Web3 & Ledger | On-chain EVM / Solana transaction receipts and hashes |
| 64 | `token_registry` (Token Registry) | -> | `token_registry` | Web3 & Ledger | Supported ERC-20 / SPL token contracts and decimals |
| 65 | `kylrix_token_ledger` | -> | `kylrix_token_ledger` | Web3 & Ledger | Native $KYLRIX minting, rewards, and staking balance |
| 66 | `account_ledger` (account_ledger) | -> | `account_ledger` | Web3 & Ledger | Historical accounting ledger of debits, credits, and fees |
| 67 | `compute_ledger` (compute_ledger) | -> | `compute_ledger` | Web3 & Ledger | AI inference compute token consumption ledger |
| 68 | `activityLog` (ActivityLog) | -> | `activity_log` | System & Logs | High-level user activity history and feed items |
| 69 | `app_activity` (AppActivity) | -> | `activity_log` | System & Logs | App-level interaction events ➔ unified activity log |
| 70 | `app_activity_logs` | -> | `activity_log` | System & Logs | Detailed activity log entries ➔ unified activity log |
| 71 | `folders` (Folders) | -> | | Legacy / Unmatched | Hierarchical folder tree (obsoleted by workspaces & tags) |
| 72 | `contacts` (Contacts) | -> | | Legacy / Unmatched | Address book contacts (handled by conversations & profiles) |
| 73 | `follows` (Follows) | -> | `follows` | Social & Graph | User follower/following graph, notification flags |
| 74 | `interactions` (Interactions) | -> | | Legacy / Unmatched | Redundant interaction events (superseded by `reactions`) |
| 75 | `moments` (Moments) | -> | | Social / Unmatched | Ephemeral story/moment feeds |
| 76 | `epochs` (epochs) | -> | `epochs` | Security & Cryptography | Key rotation epoch sequences and creator attribution |
| 77 | `joinRequests` (Join Requests) | -> | `join_requests` | Workspaces & Access | Workspace join requests, resolution status, and approver |
| 78 | `unorganic_emails` | -> | `unorganic_emails` | System & Communications | Transactional email deduplication, priority, and dispatch logs |
| 79 | `engagement_views` | -> | | Analytics / Unmatched | Raw content view counts and analytics events |
| 80 | `engagement_view_rollups` | -> | | Analytics / Unmatched | Aggregated daily/monthly analytics rollups |
| 81 | `system_pulse` (system_pulse) | -> | | DevOps / Unmatched | Health check and monitoring heartbeat metric store |
| 82 | `source_control` | -> | `source_control` | Integrations & Repos | GitHub/GitLab repository sync, provider credentials, and mappings |
| 83 | `accountEvents` (Account Events) | -> | | Billing / Unmatched | Ephemeral token grant and daily login reward events |
| 84 | `focusSessions` (focusSessions) | -> | | Productivity / Unmatched | Pomodoro focus session timers attached to tasks |
| 85 | `agents` (agents) | -> | `agents` | AI & Autonomous | Agent definition records, public keys, and engine configurations |
| 86 | `Collaborators` (Collaborators) | -> | `collaborators` | Permissions & Access | Resource-level collaborator grants, roles, and invitation states |
| 87 | `compute_balances` | -> | `compute_balances` | Billing & Compute | User compute balance cache and tier quota status |
| 88 | `notifications` (notifications) | -> | `notifications` | Messaging & Alerts | In-app user notifications, pointers, and read states |
| 89 | `objects` (objects) | -> | `objects` | Core Relations | Generic polymorphic parent-child entity relations |
| 90 | `nostr_identities` | -> | | Web3 / Unmatched | Decentralized Nostr npub/nsec identity keys |
| 91 | `swept` (swept) | -> | | Workspaces / Unmatched | Workspace auto-sweeping policy and config records |
| 92 | `pat_rate_state` | -> | `pat_rate_state` | API & Shield | PAT rate-limiting window counters and minute/hour buckets |
| 93 | `api_user_rate_state` | -> | `api_user_rate_state` | API & Shield | User rate-limiting window counters and minute/hour buckets |

---

## Reverse Mapping: Turso Tables Without Direct Appwrite Table

The following 10 Turso tables exist in [`lib/db/schema.ts`](file:///home/user/kylrix/lib/db/schema.ts) to support Better Auth, Passkeys, OAuth 2.1 protocol standards, and local coding contexts. In Appwrite, these mechanisms were either handled natively by Appwrite Auth internal engines (not exposed as database tables) or did not exist.

| # | Appwrite Table | | Turso Table (Drizzle Schema) | Purpose / Rationale |
|:---|:---|:---:|:---|:---|
| 1 | | -> | `session` | **Better Auth Session Store**: Active browser user sessions, tokens, IP, and user-agent. (Appwrite managed sessions internally). |
| 2 | | -> | `verification` | **Verification Tokens**: Email verification hashes, magic link tokens, and one-time auth challenges. |
| 3 | | -> | `two_factor` | **Two-Factor Authentication**: TOTP secrets and backup codes for Better Auth account security. |
| 4 | | -> | `passkey` | **FIDO2 / WebAuthn Passkeys**: Public keys, credential IDs, counter, and biometric authenticator transports. |
| 5 | | -> | `jwks` | **JSON Web Key Sets**: Rotating cryptographic keys used to sign Better Auth / OIDC access and identity tokens. |
| 6 | | -> | `oauth_resource` | **OAuth 2.1 Protected Resources**: Resource indicators and audience scopes for Kylrix API access. |
| 7 | | -> | `oauth_refresh_token` | **OAuth 2.1 Refresh Tokens**: Rotating refresh tokens for external developer app grants. |
| 8 | | -> | `oauth_access_token` | **OAuth 2.1 Access Tokens**: RFC 6749 bearer tokens issued to third-party clients. |
| 9 | | -> | `oauth_client_assertion` | **OAuth 2.1 Client Assertions**: Private key JWT assertions for confidential client authentication. |
| 10 | | -> | `external_contexts` | **External Context Bindings**: Local IDE bindings, agent filesystem contexts, and Cursor/Claude Code session metadata. |

---

## Detailed Domain Analysis & Field Alignment

### 1. Ideas & Notes
- **Appwrite**: `67ff05f3002502ef239e` (`notes`) — 40 columns
- **Turso**: `ideas` — 18 columns
- **Alignment**:
  - `row.$id` ➔ `ideas.id`
  - `row.userId` ➔ `ideas.userId`
  - `row.title` ➔ `ideas.title`
  - `row.content` ➔ `ideas.content`
  - `row.summary` ➔ `ideas.summary`
  - `row.isTrash` / `row.isTrashed` ➔ `ideas.isTrashed` (boolean)
  - `row.isWorkspace` ➔ `ideas.isWorkspace`
  - `row.projectId` ➔ `ideas.workspaceId` and `ideas.projectId`
  - `row.tags` ➔ `ideas.tags` (JSON string)
  - `row.isLocked` ➔ `ideas.isLocked`
  - `row.isPublished` ➔ `ideas.isPublished`
  - `row.$createdAt` ➔ `ideas.createdAt`
  - `row.$updatedAt` ➔ `ideas.updatedAt`

### 2. Goals & Roadmap Tasks
- **Appwrite**: `tasks` — 28 columns
- **Turso**: `goals` — 14 columns
- **Alignment**:
  - `row.$id` ➔ `goals.id`
  - `row.userId` ➔ `goals.userId`
  - `row.title` / `row.name` ➔ `goals.title`
  - `row.description` / `row.content` ➔ `goals.description`
  - `row.status` ➔ `goals.status` ('todo', 'in_progress', 'completed', 'cancelled')
  - `row.priority` ➔ `goals.priority`
  - `row.dueDate` ➔ `goals.dueDate`
  - `row.completedAt` ➔ `goals.completedAt`
  - `row.isWorkspace` ➔ `goals.isWorkspace`
  - `row.projectId` ➔ `goals.workspaceId` and `goals.projectId`
  - `row.tags` ➔ `goals.tags`

### 3. Workspaces & Object Join Mapping
- **Appwrite**: `projects` (18 cols) and `project_objects` (10 cols)
- **Turso**: `workspaces` (12 cols) and `workspace_objects` (7 cols)
- **Alignment**:
  - `projects.$id` ➔ `workspaces.id`
  - `projects.ownerId` ➔ `workspaces.creatorId`
  - `projects.title` / `name` ➔ `workspaces.name`
  - `projects.summary` / `description` ➔ `workspaces.description`
  - `projects.inviteCode` ➔ `workspaces.inviteCode`
  - `projects.isPublic` ➔ `workspaces.isPublic`
  - `projects.isAgentic` ➔ `workspaces.isAgentic`
  - `project_objects.$id` ➔ `workspace_objects.id`
  - `project_objects.projectId` ➔ `workspace_objects.workspaceId`
  - `project_objects.entityKind` ➔ `workspace_objects.entityKind`
  - `project_objects.entityId` ➔ `workspace_objects.entityId`

### 4. Zero-Knowledge Vault & Keychain
- **Appwrite**: `credentials` (38 cols), `keychain` (15 cols), `totpSecrets` (27 cols)
- **Turso**: `vault_items` (11 cols), `keychain` (9 cols), `totp_secrets` (6 cols)
- **Alignment**:
  - `credentials.$id` ➔ `vault_items.id`
  - `credentials.name` / `title` ➔ `vault_items.title`
  - `credentials.itemType` / `type` ➔ `vault_items.type`
  - `credentials.encryptedData` / `password` ➔ `vault_items.encryptedData`
  - `credentials.iv` ➔ `vault_items.iv`
  - `credentials.isTrash` ➔ `vault_items.isTrashed`
  - `keychain.$id` ➔ `keychain.id`
  - `keychain.encryptedPayload` / `wrappedKey` ➔ `keychain.encryptedPayload`
  - `keychain.nonce` / `salt` ➔ `keychain.nonce`

### 5. Developer PATs & API Authentication
- **Appwrite**: `pats` (12 cols)
- **Turso**: `apikey` (16 cols)
- **Alignment**:
  - `pats.$id` ➔ `apikey.id`
  - `pats.userId` ➔ `apikey.userId`
  - `pats.name` ➔ `apikey.name`
  - `pats.tokenHash` ➔ `apikey.key`
  - `pats.tokenPrefix` ➔ `apikey.prefix` / `apikey.start`
  - `pats.scopes` ➔ `apikey.permissions` (JSON array)
  - `pats.status === 'active'` ➔ `apikey.enabled` (boolean)
  - `pats.expiresAt` ➔ `apikey.expiresAt`

---

## Migration Strategy & Execution Plan

1. **Phase 1: Seed Missing Core Tables into Turso**
   - For Appwrite tables with direct equivalents, use the existing bulk migration procedures in [`lib/actions/turso-ops.ts`](file:///home/user/kylrix/lib/actions/turso-ops.ts) (`syncTier1FromAppwriteTurso` and `syncTier2FromAppwriteTurso`).
   - For unmatched tables containing user data (e.g., `folders`, `moments`), either create lightweight SQLite schemas in `lib/db/schema.ts` or transform and consolidate them (e.g., convert `folders` into workspace tags).

2. **Phase 2: Eliminate Appwrite Network Negotiation**
   - Flip `DATABASE_PROVIDER=turso` in environment configurations.
   - Refactor [`lib/api/resources.ts`](file:///home/user/kylrix/lib/api/resources.ts) and Server Actions to read directly from `lib/db` (`db.select().from(...)`) rather than delegating to Appwrite `tablesDB.listRows(...)`.

3. **Phase 3: Retire Appwrite Container / Cloud Dependencies**
   - Disable fallback checks in [`lib/appwrite/`](file:///home/user/kylrix/lib/appwrite/).
   - All REST API endpoints and MCP operations execute exclusively against sub-millisecond edge SQLite.
