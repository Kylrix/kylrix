# ARCHITECTURE.md — Kylrix Engineering Map

> **Single-database, offline-first, agentic workspace.**
> Next.js 16 · React 19 · TS · Appwrite · Tailwind 4 · RxDB · WebRTC · Argon2id

---

## 1. Macro-Structure

```
kylrix/
├── app/                  Next.js App Router
│   ├── (app)/            Authenticated shell (app/note, flow, vault, connect, agents, workspaces)
│   ├── [alias]/ + u/     Alias short-link + public profiles
│   ├── api/v1/[...path]/ PAT + OAuth JWT REST API (resource server)
│   ├── oauth/consent     Sign-in-with-Kylrix consent (grant_id)
│   ├── pricing/ docs/    Public pages
│   └── api/internal|telegram  Webhooks (BlockBee, Telegram)
├── components/           Feature & UI
├── context/              Auth, data, tasks, tokens, layout
├── hooks/                useNostrIdentity, useProjectObjects, useWorkspaceFilteredItems
├── lib/
│   ├── actions/          Server Actions — only write path (secure-ops + client-ops adapter)
│   ├── agentic/          Kylie engine (tools, workflows, executor, search, prompts)
│   ├── api/              PAT / OAuth / HTTP API shared (scopes, PatService)
│   ├── appwrite/         SDK wrappers (client proxy, note, vault, auth, config)
│   ├── billing/          BlockBee crypto checkout + subscription ledger
│   ├── ecosystem/        Mesh, identity, security singleton, cache, nexus-fetcher
│   ├── sync/             Local-first merge (local-copy-sync, pending-bridge, optimistic, interpolation)
│   ├── services/         sync-engine (autonomic), LocalEngine (RxDB cache), chat, presence, users
│   ├── security/enclave.ts  sec_enclave_keychain_{userId} pocket (RxDB only)
│   ├── webrtc/           WebRTCManager (P2P + Cloudflare SFU), RxDBManager, CallRecorder
│   ├── crypto/           noble (ed25519, secp256k1, bip32/bip39)
│   ├── masterpass-crypto.ts  AES-256-GCM + Argon2id(64MB,3it,4p) / PBKDF2 legacy
│   └── kylrixflow.ts     Flow CRUD facade
├── functions/            Appwrite Functions (permission-updater, etc.)
├── oauth2/               OAuth2 skill docs
├── api/SKILL.md          Installable agent skill (npx skills add kylrix/kylrix/api)
├── middleware.ts         Edge: auth-hint, rewrites, loop-breaker, reload-storm
└── appwrite.config.json  Declarative schema (tables, buckets, functions — ~340KB)
```

---

## 2. Single-Database Design

All modules share **one DB**: `passwordManagerDb` (`APPWRITE_CONFIG.TABLES.*`). Join tables replaced by composite tags where possible; additive schema only.

| Ns | Key Tables |
|----|-----------|
| NOTE | notes, tags, collaborators, comments, reactions, activityLog, note_revisions |
| VAULT | credentials, totpSecrets, folders, securityLogs, keychain, key_mapping, wallets |
| FLOW | tasks, events, calendars, eventGuests, focusSessions, forms, agents |
| CONNECT | conversations, conversationMembers, messages, moments, follows, calls, contacts, epochs (ephemeral) |
| WORKSPACE | projects (=Workspaces UI), project_objects (join), discussions via conversations/threads |
| SYSTEM | profiles, subscriptions, settings, extensions, compute_balances |
| API/PAT | pats (prefix+hash), pat_rate_state, api_user_rate_state |
| OAUTH (overlay) | oauth_apps, oauth_app_installs, oauth_consent_requests — cache only; Appwrite Apps/grants are SoT |

**Why one DB:** single RLS surface, no cross-DB joins, `appwrite push` atomic.

---

## 3. Authentication & Identity

```
AuthProvider (context/auth/)
 └── Appwrite Account (email/pass, OAuth, WebAuthn, MFA/TOTP)
     ├── lib/appwrite/auth.ts       ensureGlobalProfile → profiles row
     ├── lib/appwrite/vault.ts      MFA/TOTP/passkey CRUD
     ├── lib/ecosystem/identity.ts  Global identity sync
     ├── lib/mfa.ts, lib/passkey.ts, lib/mfa-session.ts (RAM-only), lib/auth-rate-limit.ts
     └── PatService / OAuth JWT     /api/v1 resource-server auth (no session)
```

**Flows:**
- **Session:** authenticate → Appwrite cookie → `kylrix_pulse_v2` hint → middleware fast-redirect → `ensureGlobalProfile()` → `EcosystemSecurity.init()`.
- **PAT:** `Authorization: Bearer kylrix_pat_<prefix>_<secret>` → lookup `pats` by `ID.unique()` prefix → SHA-256 hash compare → status/expiry → `pat_rate_state`/`api_user_rate_state` buckets → scope gate → handler. Secret never stored; shown once on create.
- **OAuth:** Appwrite = authorization server. Client → Appwrite `/authorize` → redirect to `https://www.kylrix.space/oauth/consent?grant_id=…` → `oauth2.getGrant()` → approve/reject → code → Appwrite `/token` → JWT (JWKS verify) carries `scope` → `/api/v1` enforces. Discovery: `https://fra.cloud.appwrite.io/v1/oauth2/<PROJECT_ID>/.well-known/openid-configuration`.

**Rate limits:** client mem counter → per-user prefs tracker → edge 30req/5s → Turnstile. PAT adds rolling 1m/24h buckets (Free 10/100, Pro 50/500, Teams 100/1000, 256KB cap).

---

## 4. Security Architecture

### 4.1 Vault Crypto (`masterpass-crypto.ts`)
Singleton: Argon2id 64MB/3it/4p → 256-bit AES-GCM; PBKDF2 600k legacy; WebAuthn PRF CryptoKey; 10-min transient lock.

Pocket: dedicated `sec_enclave_keychain_{userId}` via `SecurityEnclave` (`lib/security/enclave.ts`) hydrated through `LocalEngine`/RxDB only — no direct fetch in unlock path; stale `hasMasterpass:false` hoop triggers background `hydrateFromRemote`.

### 4.2 Ecosystem Security (`lib/ecosystem/security.ts`)
Tab-scoped: identity keypair, per-chat conversation keys (transient, sealed chats only), decrypted cache (wiped on lock), `BroadcastChannel('kylrix_mesh_internal')` `LOCK_SYSTEM`, PIN PBKDF2.

### 4.3 Server-Side (`lib/actions/secure-ops/`)
All writes via `'use server'` actions: `getActor(jwt?)`, `verifyResourcePermission*`, `createRowSecure/updateRowSecure/deleteRowSecure` (inject `Permission.read(Role.user(creatorId))`), `hasWriteAccess` admin escalation only on ownership. `taintUniqueValue` on secrets in `lib/appwrite-admin.ts`. Transactions (`withSystemTransaction`) for compound flows.

### 4.4 Permission Model
RLS read-only by default (no `Role.any()`). Creator row ACL at create. `collaborators` polymorphic (`resourceType/resourceId/userId/permission`). `permission-updater` function escalates after accept. Sudo = transient confirmation; respects privacy.

---

## 5. Data Layer & Offline-First Sync

### 5.1 Client SDK Proxy (`lib/appwrite/client.ts`)
Wrapped `tablesDB/databases/storage/realtime/account` proxies: JWT inject, offline coalesce, `TablesDB`↔`Databases` shape normalize.

### 5.2 Local-First Invariants (`architecture.local-first`)
Paint local first; live copy = content SoT; pending = separate; auth late-binding; guests have same cascade; detail open ≠ refetch.

### 5.3 Autonomic Sync Engine (`lib/services/sync-engine.ts` + `lib/sync/`)
- **Live copy** (React context + RxDB `note_${id}`/`LocalEngine` cache) is UI SoT. **Pending queue** (`Map` + RxDB `kylrix:sync:pending-queue`) is amber/green SoT. **Appwrite** confirms.
- **Engine:** `pushLiveNote`/`pushLiveGoal` → `markPending(id,rev)` → coalesced `runCycle` ~450ms → `getLive*ForSync` → `pick*AutosavePayload` (never pending flags) → `create/update` → `ack(id, flushedRev)` or re-queue if rev moved. No fixed-interval polling.
- **optimisticEngine:** speculative background fetch while serving 0ms local.
- **interpolationEngine:** if `isPending(id)` local wins; else newer `$updatedAt` wins.
- **local-copy-sync.ts:** `mergeServerPageWithLocalCopy()` keeps local-only ids, tombstones deletes, sorts `sortPinnedThenCreatedAt`.
- **Soft pull:** `shouldSoftPull` + focus/visibility only (10s active / 60s idle); realtime covers multi-device.
- **Guest:** same RxDB+queue; stays local until claimed.

### 5.4 Substrates & Caches
`LocalEngine` (RxDB/Dexie) cache is primary. `RxDBManager.ts` retained for call state buffering. `queryCache` Map 15m (`kylrixflow.ts`), `nexus-fetcher` coalescer, `tablesdb-row-cache` read-through, `commentIdentityCache` session.

---

## 6. Module Map

| Route | Feature | Primary Code |
|-------|---------|--------------|
| `/app` (`/idea/[id]`) | Notes | `lib/appwrite/note.ts`, `NotesContext`, `lib/sync/` |
| `/flow` `/goals` | Tasks/Goals/Events | `kylrixflow.ts`, `TaskContext` |
| `/vault` `/vault/totp` | Secrets/TOTP | `lib/appwrite/vault.ts`, `masterpass-crypto.ts` |
| `/connect` `/connect/chats/*` `/connect/calls` | Hangouts/Moments/Calls | `lib/services/chat.ts`, `lib/webrtc/`, `presence.ts` |
| `/agents` | Kylie | `lib/agentic/`, `lib/actions/agentic.ts` |
| `/workspaces` `/workspaces/[projectId]` | Workspaces (=projects) | `lib/appwrite/projects.ts`, `useProjectObjects`, `useWorkspaceFilteredItems` |
| `/settings` | Profile/MFA/Sessions/Developers/Privacy | `ProfileManager`, `WorkspaceTab→CreatePatDrawer`, `PrivacyTab` |
| `/oauth/consent` | OAuth consent | `oauth2.getGrant/approve/reject` |
| `/docs` `/docs/api` | Docs | `api/SKILL.md` mirror |
| `/api/v1/[...path]` | Public REST | `app/api/v1/route.ts`, `lib/api/*`, `PatService` |

---

## 7. Agentic Engine (Kylie)

```
lib/agentic/  tools-registry / context-workflows / client-executor / session-local-store
              search-engine / hydrate-ecosystem-hits / prompt-framework / ui-catalog / spine-bridge
lib/actions/agentic.ts + ai.ts  (Gemini, subscription gate, streaming)
lib/context-engine.tsx  (30-event telemetry niches → CompiledLocalContext)
```

Prompt → zone quick-action → `buildSystemPrompt(zone)` → Gemini → `tool_call` JSON → client-executor → `createRowSecure`/UI → feedback. Pro-gated; `compute_balances` (100k/reset); `agent-action-guardrail` checks ownership.

---

## 8. Real-Time Communication

**Appwrite Realtime:** channel `databases.{db}.tables.{table}.rows` → `subscribeToTable<T>()`. Used for messages, tasks, vault events.

**WebRTC (`WebRTCManager.ts`):** Pure direct P2P `RTCPeerConnection`; **signaling via ephemeral presence channels** `call.<callId>` (`PresenceService.broadcastState` / `subscribeToPresence`) — zero `call_signals` table writes; SDP offer/answer + ICE `candidate` go over Appwrite Realtime presence `presence.call.<id>` (TTL ephemeral, zero DB thrash, zero cron purge). Direct P2P connects peers seamlessly, free for all with zero infrastructure bottlenecks; screen-share transceiver; `MediaRecorder` → `storage.createFile()` via `CallRecorder`.

**Presence & Typing:** Ephemeral Appwrite `presence` channels (`PresenceService.getChatChannel` / `getCallChannel` / `getResourceChannel('presence','users',id)`). Heartbeat via `app_activity`, typing + call signaling via channel broadcast (no `epochs`/`call_signals` DB writes). Privacy tab (`profile.preferences` `{typingEnabled,onlineEnabled}` default true) enforces **mutual** gating: both peers must enable; groups always suppress.

---

## 9. Ecosystem Mesh (`lib/ecosystem/mesh.ts`)

`BroadcastChannel('kylrix_mesh_internal')` (same tab) + `postMessage` (iframes, origin-validated):

| Node | Type | Capability |
|------|------|------------|
| `id` | control | auth/identity/quota |
| `note` | data | knowledge graph, AI search |
| `vault` | secure | encryption/passkeys |
| `flow` | logic | task orchestration |
| `connect` | message | realtime/P2P relay |

`LOCK_SYSTEM` wipes in-RAM keys.

---

## 10. Appwrite Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `permission-updater` | DB event | ACL propagate after collaborator accept |
| `sync-user-profile` | Auth event | Mirror user → profiles |
| `notify-on-share/social` | DB event | Email on share/follow/reaction |
| `flow-event-sync` | Scheduled | Recurring events |
| `sync-subscription-status` | Scheduled/webhook | BlockBee IPN reconcile |
| `account-cleanup` | Auth delete | Cascade delete |
| `connect-call-cleanup` | Scheduled | Expire stale calls (presence TTL, no DB signals) |
| `search-users` | HTTP | Admin search |
| `data-porter` | HTTP | Bitwarden CSV/JSON import-export |
| `flow-agent-orchestrator` / `agent-action-guardrail` / `ecosystem-context-aggregator` | HTTP | Agent run / ownership check / context snapshot |
| `goal-reminder-dispatch` | Scheduled | Telegram/email reminders |

---

## 11. Billing & Subscriptions

`lib/billing/` (`subscription-service`, `blockbee-urls`, `blockbee-webhook-verify`, `provider-factory`) + `lib/actions/billing/` + `functions/sync-subscription-status`. Free/Pro (Teams planned). BlockBee crypto; Pro gates AI, >10MB uploads, extended vault, agent compute.

---

## 12. Storage Buckets

`profile_pictures` · `group_avatars` · `notes_attachments` · `general_storage` · `vault_attachments` · `chat_uploads` · `kylrix_send` (7d TTL) · `event_covers` · `voice` · `backups`. Gated via `lib/actions/secure-upload.ts`.

---

## 13. Public API & PAT Platform

Tables `pats`/`pat_rate_state`/`api_user_rate_state`. Install: `npx skills add kylrix/kylrix/api` → `api/SKILL.md` (mirror `.agents/skills/api/SKILL.md`). Routes `app/api/v1/[...path]/route.ts` via `lib/api/*` + `PatService`. Resources: notes, goals, workspaces(+`/thread`), events, forms, flows/install, feeds, moments(+comments), threads, chats (E2EE meta; plaintext when unlocked), vault meta, tags, objects, agents/harness. Gaps intentional: E2EE send, Nostr sign, vault secrets, WebRTC. Scopes (`lib/api/scopes.ts`) additive; self-service `GET /token`, `GET|PATCH /token/scopes`, `POST /token/scopes/grant` (`Developers` tab).

---

## 14. Sign in with Kylrix (OAuth2.1 / OIDC)

Authorization server = Appwrite project. Clients via Console **Apps** or Client SDK `apps` (confidential PKCE). Discovery/JWKS/token/userinfo/introspect at Appwrite. Consent hosted at `/oauth/consent` using `grant_id` + `oauth2.getGrant/approve/reject` (Appwrite grants are SoT; local `oauth_*` tables are optional marketplace overlays). Custom scopes (`notes:read/write`, `goals:read/write`, `flows:read`, `profile:read` + OIDC built-ins) stamp access JWTs; `/api/v1` verifies via JWKS and enforces scopes. Also supports PAR, device code (`createGrant({userCode})`), dynamic registration.

---

## 15. Workspaces (= Projects Table)

UI **Workspaces** (`/workspaces`, `/workspaces/[projectId]`) over `projects` table (`ProjectsService`). Legacy `/projects` redirects. Synergy hub linking ideas/goals/forms/events/hangouts/discussions via `project_objects` join (`useProjectObjects` → `useWorkspaceFilteredItems` filters by `project_objects.entityId` or default-workspace fallback). Caps: 8 collaborators free.

---

## 16. Cross-Cutting Patterns

**Isomorphic adapter:** `if(window) import('@/lib/actions/client-ops') else import('@/lib/actions/secure-ops')` — same business logic, no admin SDK in bundle.

**Unified conversations:** Every discussion lives in **standard tables** `conversations`/`messages` (and `conversationMembers`). `isEncrypted:true` = sealed with transient per-chat keys; `false` when vault locked. Former `notes.isthread/isThread` + `comments` + `thread-cleanup` model retired — task/project/event/tag/form/call threads now create a regular `conversations` row (`type:'thread'` or `direct`/`group`) and `messages` rows; `project_objects` links workspace discussions. No `notes` polymorphism, no TTL sweep.

**Threads:** Same tables as hangouts; `participants` + member rows enforce RLS; retention is explicit delete, not 7-day expiry. Presence channels carry typing/online, not DB epochs.

**CrossLinks (`lib/sdk/crosslinks.ts`):** `source:kylrixnote:id` composite tags replace joins across vault/tasks/projects.

**Context Engine (`lib/context-engine.tsx`):** `LocalContextProvider` buffers 30 events (workspace/productivity/connect/security/intelligence/billing/system) → `CompiledLocalContext` for Kylie; owns workflow recording.

**State Tracker (`lib/ecosystem/state-tracker.ts`):** last N routes → `localStorage('kylrix_ecosystem_state_tracker')` + cookie for middleware resume.

---

## 17. Middleware & Edge

`middleware.ts` (Edge): root `/` auth-hint resume; legacy rewrites (`/app/{id}`→`/idea/{id}`); loop breaker (`_rd>=5`); reload-storm 30req/5s → 429; OAuth/PAT routes bypass session hint.

---

## 18. DevOps & Self-Hosting

```
Dockerfile (Node 22 standalone) · docker-compose.yml (full) / docker-compose.app-only.yml
ota.yaml (verify, sqlite-dev, selfhost) · appwrite.config.json (declarative schema)
```

`appwrite push` deploys tables/indexes/RLS/buckets/functions. Endpoint `https://api.kylrix.space/v1`, DB `passwordManagerDb`.

---

## 19. Dependencies

| Package | Role |
|---------|------|
| `appwrite` v21 / `node-appwrite` v19 | Client / Admin SDK (TablesDB, Realtime) |
| `@google/generative-ai` | Gemini for Kylie |
| `rxdb` + `dexie` | Local-first cache |
| `hash-wasm` | Argon2id WASM |
| `@simplewebauthn/*` | Passkeys |
| `@noble/ed25519` `secp256k1` `bip32/bip39` `viem` | Identity + HD wallet |
| `framer-motion` `zod` `dompurify` | UI/validation/sanitize |

