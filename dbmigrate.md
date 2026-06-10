# Kylrix Database Consolidation Migration Plan

**Status:** Planned — not started  
**Last updated:** 2026-06-02 (vault E2E cleanse decision)  
**Canonical config source:** `appwrite.config.json` + `lib/appwrite/config.ts`

---

## Executive summary

Kylrix currently runs **four Appwrite databases** on a single project. Appwrite’s **Free tier allows only one database per project**. Exceeding that limit causes provisioning failures, schema push rejections, and eventual **platform lockout** (inability to create tables, indexes, or apply CLI migrations).

We will **retain one database** (`passwordManagerDb`) and **deprecate three** (`67ff05a9000296822396` / whisperrnote, `chat`, `whisperrflow`). All table schemas from the deprecated databases will be **recreated inside the survivor**, row data will be **migrated and verified**, application code will be **repointed**, and only then will humans **manually delete** the old databases.

**Additionally**, inside the surviving `passwordManagerDb`, we will **cleanse row content** (not delete the table schemas) in two E2E-coupled tables for a fresh start: **`key_mapping`** and **`identities`**. See [Vault table content cleanse](#vault-table-content-cleanse-fresh-start).

**No agent or automated job is authorized to delete databases or bulk-delete production rows during this plan** except the two explicitly approved vault table cleanses above, executed by a human operator after verification. Schema additions use the Appwrite CLI (`system.appwrite-cli-ops` skill) when explicitly authorized.

---

## Why this migration exists

### 1. Appwrite Free tier hard limit

The immediate driver is **economic and operational**: Free tier projects cannot sustain four databases. Every new feature that needs a table in a “wrong” database risks:

- CLI `push` failures
- Console schema edits blocked
- Inability to add indexes during incidents
- Silent drift between `appwrite.config.json` and live Appwrite

Staying on four databases is not a long-term option unless the project upgrades to a paid Appwrite plan **and** the team decides multi-database isolation is worth the cost.

### 2. Why we rejected “keep whisperrnote because it is DATABASE_ID”

Early analysis favored `67ff05a9000296822396` (whisperrnote) because:

- `APPWRITE_CONFIG.DATABASE_ID` and `NOTE_DATABASE_ID` point there
- It already holds cross-cutting tables: `subscriptions`, `billing_transactions`, `coupons`, `tags`, `resource_tags`

That logic **overweighted billing schema** and **underweighted vault survival**:

- **We have no paid users yet.** Subscription, coupon, and billing webhook tables are important for future monetization but are **not** load-bearing for current user lockout risk. Losing or delaying billing row migration is painful; losing Keychain rows is **catastrophic**.
- Keeping whisperrnote as the survivor would require **moving the entire vault out of `passwordManagerDb`**. Vault migration is the highest-risk operation in the whole program (see below).

### 3. Why we retain `passwordManagerDb` (PasswordManagerDB)

**Retain:** `passwordManagerDb`  
**Deprecate:** `whisperrnote`, `chat`, `whisperrflow`

Rationale:

| Factor | Implication |
|--------|-------------|
| **Core vault rows never move** | Keychain, Credentials, TOTP, and `user` masterpass flags stay in place. Zero re-encryption transit for master keys during container move. |
| **User lockout asymmetry** | Corrupted or deleted Keychain rows → users cannot unlock vault or use passkeys. Corrupted chat or note rows → bad UX, not cryptographic annihilation. **`key_mapping` and `identities` row content will be cleansed** (see below)—this resets E2E lockboxes and Connect keys, not masterpass unlock. |
| **Cross-DB coupling already centers here** | `key_mapping` lives in `passwordManagerDb` but references chat, note, project, and epoch resources. The encryption graph is vault-native. |
| **Smallest live footprint (9 tables)** | Fewer tables already in the survivor; we **add** ~55 tables from other DBs rather than relocate 9 critical ones. |
| **Security boundary was logical, not tier-required** | Separate vault DB made sense architecturally; Appwrite billing does not reward that split on Free tier. |

### 4. What “wiping the vault” actually means

Users often say “database migration” thinking of schema only. For Kylrix, **`passwordManagerDb` is the root of trust**:

- **`Keychain`** — master password envelopes, passkey blobs, `isPending` migration state, Argon/PBKDF2 params
- **`Credentials`** — encrypted vault entries (passwords, secrets)
- **`Identities`** — `e2e_connect` X25519 keypairs (Connect secure chat). **Row content will be cleansed** for fresh start; table schema retained.
- **`TOTP Secrets`** — 2FA seeds bound to vault
- **`user`** — masterpass flags, 2FA secrets, backup codes, session metadata
- **`key_mapping`** — wrapped content keys for notes, chats, projects, epochs (ECDH lockbox). **Row content will be cleansed** for fresh start; table schema retained.

If **Keychain**, **Credentials**, **TOTP**, or **`user`** rows are lost, truncated, or double-migrated incorrectly:

- Users **permanently lose access** to the vault
- Passkey unlock paths break
- Pending vault migrations (`isPending: true`) strand users in half-migrated state

**This is irreversible without user-held backups.**

Cleansing **`key_mapping`** and **`identities`** is a deliberate reset: old ECDH lockboxes and Connect identity keys become unreadable. Users lose historical E2E-encrypted chat/note payloads tied to those lockboxes—not masterpass or credential vault access. On next vault unlock, `syncIdentity` in `lib/ecosystem/security.ts` **regenerates** `e2e_connect` rows when none exist; new secure chats mint fresh `key_mapping` entries.

### 5. Cross-database architecture today (why merge is non-trivial)

The mono-app is already a **logical single product** with **physical four-database split**:

```
┌─────────────────────────────────────────────────────────────────┐
│  passwordManagerDb (VAULT)                                       │
│  Keychain, Credentials, Identities, key_mapping, user, …       │
│  key_mapping.resourceType → chat | epoch | note | project | …   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ resourceId references
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ whisperrnote  │   │ chat          │   │ whisperrflow  │
│ notes, tags,  │   │ messages,     │   │ tasks, events,│
│ billing, …    │   │ moments, …    │   │ forms, …      │
└───────────────┘   └───────────────┘   └───────────────┘
```

Code paths that **span databases** (must be updated after migration):

- `lib/ecosystem/security.ts` — `PW_DB` / Identities in vault; note decrypt via `key_mapping`
- `lib/services/chat.ts` — conversations in `chat`, lockboxes in `passwordManagerDb`
- `lib/appwrite/note.ts` — notes in whisperrnote, `key_mapping` cleanup on delete
- `lib/actions/secure-ops.ts`, `lib/actions/cascade-delete.ts` — purge `key_mapping` by resource
- Realtime channels — `databases.{id}.collections.{table}.documents` (ChatList, etc.)
- `generated/appwrite/types.ts` / `databases.ts` — codegen per database id

Consolidation **does not** merge these concerns logically—it merges **storage container IDs** so Appwrite stops counting four databases against quota.

### 6. Zombie / orphan row risk (pre-migration cleanup)

Before and during migration, audit **orphan rows**—especially in vault tables that **reference deleted resources elsewhere**:

| Table | Zombie profile | Safe to clean? |
|-------|----------------|----------------|
| **`key_mapping`** | `resourceType` `chat`, `epoch`, `conversation` pointing at deleted Connect conversations; `note`, `project` orphans after missed cascade | **Yes, after verification** — cross-check `resourceId` exists in target table |
| **`Keychain`** | `isPending: true` leftover migration rows; duplicate `password` / `passkey` entries | **Careful** — only remove pending duplicates when stable row confirmed |
| **`Folders`** | `isDeleted: true` soft-deleted | **Yes** — clutter only |
| **`Security Logs`** | Old audit events | **Yes** — prune by age if needed |
| **`wallets`** | Abandoned Web3 wallet rows | **Verify** per owner |
| **`Credentials`, `user`, stable Keychain** | — | **Never bulk-clear** |
| **`key_mapping`, `identities`** | Orphan lockboxes and stale `e2e_connect` keys after deprecated DB data is retired | **Yes — full row cleanse approved** (schema stays) |

**Decision:** Rather than surgically pruning orphan `key_mapping` rows, we will **wipe all row content** in `key_mapping` and `identities` for a clean E2E slate. These tables are tightly coupled to data in the three deprecated databases; once that data is gone or migrated without lockboxes, remaining rows are zombies anyway.

### 7. Billing / subscription tables (lower urgency)

`whisperrnote` holds:

- `subscriptions`
- `billing_transactions`
- `billing_webhook_logs`
- `coupons`

With **no paid users yet**, these tables are **schema placeholders**. They should still migrate for code compatibility, but they must **not** drive the choice of survivor database or justify vault-risking moves.

---

## Current inventory (from `appwrite.config.json`)

**Total: 4 databases, 64 tables**

### Retain — `passwordManagerDb` (PasswordManagerDB) — 9 tables

| Table ID | Name | Role |
|----------|------|------|
| `securityLogs` | Security Logs | Audit trail |
| `credentials` | Credentials | Encrypted vault items |
| `identities` | Identities | E2E Connect keys — **row content cleansed at cutover** |
| `user` | user | Masterpass / 2FA / account crypto flags |
| `folders` | Folders | Vault folder tree |
| `totpSecrets` | TOTP Secrets | Authenticator seeds |
| `keychain` | Keychain | Master key + passkey envelopes |
| `key_mapping` | key_mapping | ECDH wrapped keys per resource — **row content cleansed at cutover** |
| `wallets` | wallets | Encrypted wallet secrets |

### Deprecate — `67ff05a9000296822396` (whisperrnote) — 13 tables

| Table ID | Name |
|----------|------|
| `67ff05f3002502ef239e` | notes |
| `comments` | Comments |
| `extensions` | Extensions |
| `reactions` | Reactions |
| `activityLog` | ActivityLog |
| `settings` | Settings |
| `subscriptions` | subscriptions |
| `billing_transactions` | billing_transactions |
| `billing_webhook_logs` | billing_webhook_logs |
| `67ff06280034908cf08a` | tags |
| `resource_tags` | resource_tags |
| `coupons` | coupons |
| `user_resource_pins` | User Resource Pins |

### Deprecate — `chat` — 25 tables

| Table ID | Name |
|----------|------|
| `messages` | Messages |
| `conversations` | Conversations |
| `contacts` | Contacts |
| `follows` | Follows |
| `app_activity` | AppActivity |
| `interactions` | Interactions |
| `moments` | Moments |
| `calls` | Calls |
| `epochs` | epochs |
| `conversationMembers` | Conversation Members |
| `profiles` | profiles |
| `messageReactions` | Message Reactions |
| `joinRequests` | Join Requests |
| `unorganic_emails` | Unorganic Emails |
| `kylrix_token_ledger` | kylrix_token_ledger |
| `engagement_views` | engagement_views |
| `engagement_view_rollups` | engagement_view_rollups |
| `account_ledger` | account_ledger |
| `system_pulse` | system_pulse |
| `projects` | projects |
| `project_objects` | project_objects |
| `telegram_connections` | Telegram Connections |
| `source_control` | source_control |
| `call_signals` | Call Signals |
| `accountEvents` | Account Events |

### Deprecate — `whisperrflow` — 17 tables

| Table ID | Name |
|----------|------|
| `focusSessions` | focusSessions |
| `eventGuests` | eventGuests |
| `events` | events |
| `calendars` | calendars |
| `tasks` | tasks |
| `forms` | forms |
| `formSubmissions` | formSubmissions |
| `agents` | agents |
| `Collaborators` | Collaborators |
| `user_keys` | user_keys |
| `compute_balances` | compute_balances |
| `compute_ledger` | compute_ledger |
| `action_threads` | action_threads |
| `app_activity_logs` | app_activity_logs |
| `anonymized_telemetry` | anonymized_telemetry |
| `notifications` | notifications |
| `workflows` | workflows |

**Note:** Some tables exist in config under one DB but are referenced from code via aliases (e.g. `projects` appears in both Connect and Flow contexts). Migration must preserve **table IDs** where possible to minimize row ID churn, or maintain an ID mapping layer if Appwrite forces new IDs.

---

## Vault table content cleanse (fresh start)

**Scope:** Row content only. **Do not** drop the `key_mapping` or `identities` table definitions from `passwordManagerDb`.

| Table ID | Name | Action | Why |
|----------|------|--------|-----|
| `key_mapping` | key_mapping | **Delete all rows** | Lockboxes point at resources in whisperrnote, chat, and whisperrflow (`resourceType`: chat, epoch, note, project, conversation). Once those databases are deprecated and E2E payloads reset, every remaining row is an orphan. |
| `identities` | Identities | **Delete all rows** | Production code only uses `identityType: e2e_connect` — per-user X25519 pairs for ECDH secure chat and T4 note sharing via `key_mapping`. Not passkeys (Keychain), not Settings OAuth (Appwrite Auth). Rows exist solely to wrap/unwrap lockboxes and sync `profiles.publicKey` in chat. With lockboxes gone, old keys decrypt nothing. |

**What happens after cleanse:**

1. User unlocks vault → `syncIdentity` finds no `e2e_connect` row → generates a new X25519 pair and writes a fresh Identities row.
2. User starts secure chat → new conversation keys → new `key_mapping` rows.
3. **Irreversible:** Any E2E-encrypted messages, notes, or projects that depended on old lockboxes **cannot be decrypted**, even if row copies exist elsewhere.

**What is NOT cleansed:**

- `keychain`, `credentials`, `user`, `totpSecrets`, `folders`, `securityLogs`, `wallets` — core vault; untouched.

**Timing:** Execute after Phase 0 export and before or during Phase 3 cutover, when deprecated DB retirement makes old E2E payloads moot. Human operator only.

---

## Target state

```
Single Appwrite database: passwordManagerDb
├── (existing 9 vault tables — core vault rows untouched)
├── key_mapping + identities — schemas kept, row content cleansed
├── + all whisperrnote tables (new copies or same table IDs)
├── + all chat tables
└── + all whisperrflow tables
```

Application config converges to:

```ts
// lib/appwrite/config.ts (future)
DATABASE_ID: 'passwordManagerDb',
DATABASES: {
  NOTE: 'passwordManagerDb',
  VAULT: 'passwordManagerDb',
  CHAT: 'passwordManagerDb',
  FLOW: 'passwordManagerDb',
  PASSWORD_MANAGER: 'passwordManagerDb',
},
```

Realtime subscriptions, server actions, and SDK helpers use **one** `databaseId` with distinct **table IDs**.

---

## Migration principles (non-negotiable)

1. **Core vault never moves.** Keychain, Credentials, TOTP, `user`, folders, wallets, security logs stay until verified. **`key_mapping` and `identities` row content is intentionally cleansed** — not migrated.
2. **Schema before rows.** Add empty tables via Appwrite CLI; do not hand-edit `appwrite.config.json` as the primary migration tool unless reconciling afterward.
3. **No database deletion by agents.** Humans delete `whisperrnote`, `chat`, and `whisperrflow` only after parity checks pass.
4. **Row-level verification gates.** Counts, spot-decrypt tests, and key_mapping integrity checks before cutover.
5. **Dual-read / single-write cutover window** (recommended). Brief period where code can read old DB if flagged; writes only to new location—only if downtime must be minimized.
6. **Preserve table IDs** when Appwrite allows creating tables with explicit `$id` in target database. Changing table IDs breaks hardcoded references in `APPWRITE_CONFIG.TABLES`.
7. **Regenerate codegen** after schema settle: `generated/appwrite/types.ts`, `generated/appwrite/databases.ts`.
8. **Exportability.** `lib/data-porter.ts` and user export flows remain the disaster-recovery backstop—run exports before cutover window.

---

## Phased execution plan

### Phase 0 — Preparation (no production changes)

- [ ] Confirm Appwrite plan limits with console (database count, table count, row limits).
- [ ] Full **data export** via data-porter / documented backup for all four databases.
- [ ] Inventory live row counts per table (CLI or console).
- [ ] Run **zombie audit** on `Keychain.isPending`, `Folders.isDeleted` (informational; `key_mapping` / `identities` will be fully cleansed regardless).
- [ ] Confirm Phase 0 export includes `key_mapping` and `identities` rows before cleanse (disaster recovery for old E2E content, if ever needed).
- [ ] Freeze schema changes on deprecated DBs except migration-critical work.
- [ ] Document maintenance window and rollback owner.

### Phase 1 — Schema replication into `passwordManagerDb` (CLI, when authorized)

Order: **lowest risk → highest coupling**

1. **whisperrflow** tables (17) — no vault crypto dependency for schema presence
2. **chat** tables (25) — large but self-contained; lockboxes already in vault
3. **whisperrnote** tables (13) — notes + billing; verify `key_mapping` resource types for `note`

For each table:

```bash
appwrite --version   # must be 17.4.0+
# Use tables-db create-table / create-*-column per system.appwrite-cli-ops skill
# NEVER: appwrite client --reset
```

- [ ] Create table shell with identical columns, indexes, row security flags
- [ ] Match `$id` to existing table ID where platform permits
- [ ] Update `appwrite.config.json` databaseId entries to `passwordManagerDb` (after live verification)
- [ ] Push / reconcile config

### Phase 2 — Row migration

Options (choose per table class):

| Method | Best for |
|--------|----------|
| **Batch copy script** (Admin SDK, server-side) | High-volume chat messages, moments |
| **data-porter function** | User-visible export/import validation |
| **Appwrite CLI / manual CSV** | Small tables, one-offs |
| **Dual-write then backfill** | Zero-downtime cutover |

Per-table checklist:

- [ ] Source row count == destination row count
- [ ] Permissions preserved (`$permissions` / row security)
- [ ] Encrypted fields byte-identical where required
- [ ] Foreign keys by convention (`resourceId`, `userId`, `conversationId`) still resolve

**Vault tables (`passwordManagerDb` existing):** no row copy. **`key_mapping` and `identities`:** cleanse all rows (human operator); do not migrate content into merged tables.

### Phase 3 — Application cutover

- [ ] **Cleanse `key_mapping` and `identities` rows** in `passwordManagerDb` (human operator; schemas remain; after Phase 0 export)

Update references (non-exhaustive file list):

- [ ] `lib/appwrite/config.ts` — all `DATABASES.*` → `passwordManagerDb`
- [ ] `lib/ecosystem/security.ts` — `PW_DB`, vault table paths
- [ ] `lib/services/chat.ts`, `lib/services/social.ts`, `lib/services/users.ts`
- [ ] `lib/appwrite/note.ts`, `lib/actions/secure-ops.ts`, `lib/actions/cascade-delete.ts`
- [ ] Realtime subscription strings in UI components
- [ ] `generated/appwrite/*` — regenerate
- [ ] Appwrite Functions env vars if they embed database IDs
- [ ] Search repo: `67ff05a9000296822396`, `'chat'`, `'whisperrflow'`, `DATABASES.NOTE`, etc.

Verification:

- [ ] Login + masterpass unlock + passkey unlock
- [ ] Create/read secure chat message (fresh lockbox round-trip after identities cleanse)
- [ ] Confirm `syncIdentity` regenerates `e2e_connect` row on vault unlock
- [ ] Create/read encrypted note (new E2E keys post-cleanse)
- [ ] Flow task + Connect moment smoke tests
- [ ] Vault credential CRUD

### Phase 4 — Deprecation (human-only)

After **≥7 days** stable production on unified DB (recommended):

- [ ] Final export of deprecated databases
- [ ] Human deletes `whisperrnote` database in Appwrite console
- [ ] Human deletes `chat` database
- [ ] Human deletes `whisperrflow` database
- [ ] Remove dead database IDs from config and docs

---

## Rollback strategy

| Stage | Rollback |
|-------|----------|
| Phase 1 (schema only) | Drop newly created empty tables from `passwordManagerDb` |
| Phase 2 (partial row copy) | Truncate destination tables; source DBs still live |
| Phase 3 (code cutover) | Revert deploy; code still points to old database IDs |
| Phase 4 (deleted old DBs) | **Restore from Phase 0 export only** — treat as disaster recovery |

There is **no** rollback after Phase 4 without backups.

---

## Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Keychain row loss | **Critical** | Never migrate vault rows; verify counts daily |
| `key_mapping` / `identities` cleanse breaks old E2E content | **Expected** | Phase 0 export; communicate fresh-start intent; verify regeneration |
| Stale `profiles.publicKey` after identities cleanse | Medium | Re-sync public keys on first post-cutover secure chat / profile edit |
| `isPending` Keychain zombies | High | Resolve pending migrations before cutover |
| Table ID mismatch after recreate | High | Preserve `$id`; grep codebase for hardcoded IDs |
| Realtime subscriptions silent failure | Medium | Integration test per channel prefix |
| Billing table drift | Low | No paid users; migrate for code parity only |
| Appwrite table limit on single DB | Medium | Confirm tier table quota before Phase 1 |
| Long migration runtime | Medium | Batch by table; monitor rate limits |

---

## Open decisions (to resolve before Phase 1)

1. **Downtime vs dual-write** — Is a maintenance window acceptable?
2. **Table ID collision** — Any table ID collisions when merging into one DB? (Same `$id` cannot exist twice in one database—if IDs clash across deprecated DBs, new IDs + mapping table required.)
3. **Projects duplication** — `projects` / `project_objects` live under `chat` in config but Flow code references projects heavily—confirm canonical ownership.
4. **Profiles duplication** — Profiles in `chat` vs historical references in note config—single profiles table after merge.
5. **Rename survivor display name** — Keep `PasswordManagerDB` or rename to `kylrix` in console for clarity?

### Table ID collision check

**Verified 2026-06-02:** **No collisions.** All 64 table `$id` values are unique across the four databases. Tables can be recreated in `passwordManagerDb` with identical IDs without cross-DB ID clashes.

Re-run before Phase 1 if `appwrite.config.json` changes:

```bash
python3 -c "
import json
from collections import defaultdict
cfg=json.load(open('appwrite.config.json'))
m=defaultdict(list)
for t in cfg['tables']:
    m[t['\$id']].append(t['databaseId'])
collisions={k:v for k,v in m.items() if len(v)>1}
print('COLLISIONS:', collisions or 'none')
"
```

If collisions appear later, document remapping strategy in this file before proceeding.

---

## Authorization boundaries

| Action | Who |
|--------|-----|
| Appwrite CLI schema create | Authorized operator + `system.appwrite-cli-ops` skill |
| Row migration scripts | Engineering, reviewed |
| Config / code cutover | Engineering PR + external sovereign git workflow |
| Database deletion | **Human operator only**, post-verification |
| Vault row deletion / zombie cleanup | **Human operator**, row-by-row or scripted with dry-run |
| `key_mapping` + `identities` full row cleanse | **Human operator only**, post-export, schema retained |

---

## Related files

- `appwrite.config.json` — schema truth
- `lib/appwrite/config.ts` — runtime database IDs
- `generated/appwrite/types.ts` — typed table accessors
- `.agents/skills/system.appwrite-cli-ops/SKILL.md` — CLI procedures
- `.agents/skills/security.masterpass-crypto/SKILL.md` — vault crypto context
- `.agents/skills/why.exportability-data-sovereignty/SKILL.md` — export backstop
- `lib/data-porter.ts` — portable export/import
- `AGENTS.md` — no in-repo git commits; Table/Row terminology

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | Initial plan: retain `passwordManagerDb`, deprecate three others; vault-first rationale; zombie audit; phased CLI migration |
| 2026-06-02 | Approved row cleanse (not table drop) for `key_mapping` and `identities` in survivor DB; E2E fresh start |
