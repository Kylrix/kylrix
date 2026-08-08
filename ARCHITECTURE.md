# ARCHITECTURE.md — Kylrix Engineering Map

> **Single-database, offline-first, agentic productivity workspace.**
> Stack: Next.js 16 · React 19 · TypeScript · Appwrite · Tailwind CSS 4 · RxDB · WebRTC.

---

## 1. Macro-Structure

```
kylrix/
├── app/                  Next.js App Router (pages, layouts, API routes)
│   ├── (app)/            Authenticated shell routes (note, flow, vault, connect, agents)
│   ├── [alias]/          User-alias short-link landing
│   ├── api/              Thin REST webhooks only (Cloudflare, Telegram)
│   ├── pricing/          Public pricing page
│   └── u/                Public user profile pages
├── components/           Feature & UI React components
├── context/              React Context providers (auth, data, layout, tasks, tokens)
├── hooks/                Custom React hooks
├── lib/                  All business logic (no React)
│   ├── actions/          Next.js Server Actions (the only write path to Appwrite)
│   ├── agentic/          Kylie AI engine: tools registry, context workflows, executor
│   ├── appwrite/         Appwrite SDK wrappers: client, note, vault, auth, config
│   ├── billing/          BlockBee crypto checkout + Appwrite subscription logic
│   ├── ecosystem/        Cross-module mesh, identity, security singleton, cache
│   ├── sync/             Offline-first merge engine (local-copy-sync)
│   ├── webrtc/           WebRTC + Cloudflare SFU call manager, recorder
│   ├── crypto/           Public-key helpers (noble cryptography)
│   ├── masterpass-crypto.ts  Vault AES-256-GCM + Argon2id key stretching
│   └── kylrixflow.ts     Flow module CRUD facade (tasks, events, calendars)
├── functions/            Appwrite Serverless Functions (16 event-driven workers)
├── constants/            App-level constants
├── types/                TypeScript types (appwrite, p2p, kylrixflow)
├── generated/            Auto-generated Appwrite SDK types
├── public/               Static assets
├── middleware.ts         Edge middleware: auth-hint redirect + reload-storm defense
└── appwrite.config.json  Full Appwrite schema (tables, buckets, functions — 344 KB)
```

---

## 2. Single-Database Design

All modules share **one Appwrite database**: `passwordManagerDb`.
Table IDs are aliased in `lib/appwrite/config.ts` under `APPWRITE_CONFIG.TABLES.*`.

| Namespace | Key Tables |
|-----------|-----------|
| `NOTE` | notes, tags, collaborators, comments, reactions, activityLog, note_revisions |
| `VAULT` | credentials, totpSecrets, folders, securityLogs, keychain, key_mapping, wallets |
| `FLOW` | tasks, events, calendars, eventGuests, focusSessions, forms, agents |
| `CONNECT` | conversations, conversationMembers, messages, moments, follows, calls, contacts |
| `SYSTEM` | profiles, subscriptions, settings, extensions, token_registry, compute_balances |

**Why one DB?** Eliminates cross-DB join complexity, simplifies Appwrite RLS, reduces config surface.

---

## 3. Authentication & Identity

```
AuthProvider (context/auth/)
  └── Appwrite Account SDK (email/pass, OAuth, passkey/WebAuthn, MFA/TOTP)
       ├── lib/appwrite/auth.ts        AppwriteService: ensureGlobalProfile on login
       ├── lib/appwrite/vault.ts       MFA session verification, TOTP, passkey CRUD
       ├── lib/ecosystem/identity.ts   Global identity sync to profiles table
       ├── lib/mfa.ts                  Factor normalization & temporal alignment
       ├── lib/auth-rate-limit.ts      Per-user progressive rate limiter (stored in prefs)
       ├── lib/passkey.ts              WebAuthn registration + assertion (SimpleWebAuthn)
       └── lib/mfa-session.ts          RAM-only MFA timestamp (never persisted)
```

**Auth Flow:**
User authenticates → Appwrite session cookie set → `kylrix_pulse_v2` cookie written
with non-sensitive profile data → middleware reads hint to fast-redirect authenticated users
→ `AppwriteService.ensureGlobalProfile()` syncs user to `profiles` table
→ `EcosystemSecurity.init()` called for vault unlock.

**Rate Limiting layers:**
1. Client-side memory counter per window (`lib/rate-limiter.ts`)
2. Server-side per-user Appwrite prefs tracker (`lib/auth-rate-limit.ts`)
3. Edge middleware reload-storm defense (`middleware.ts` — 30 req/5 s cookie counter)
4. Cloudflare Turnstile on auth forms

---

## 4. Security Architecture

### 4.1 Vault Cryptography (`lib/masterpass-crypto.ts`)

```
MasterPassCrypto (singleton)
  ├── Argon2id (primary): 64 MB RAM, 3 iter, 4-way parallel → 256-bit AES-GCM key
  ├── PBKDF2 (legacy migration): 600 000 iter, SHA-256
  ├── AES-256-GCM handling of private vault content for optional privacy
  ├── Passkey support: gentle CryptoKey handling via WebAuthn PRF
  └── 10-min gentle lock timeout (transient key, respects privacy)
```

### 4.2 Ecosystem Security (`lib/ecosystem/security.ts`)

```
EcosystemSecurity (tab-scoped, privacy-respecting)
  ├── Identity keypair for friendly message handling
  ├── Conversation keys (per-chat, transient for private hangouts)
  ├── Transient decrypted cache (cleared when user locks)
  ├── MeshProtocol listener: respects user lock preference across tabs
  └── PIN handling: gentle PBKDF2 support
```

### 4.3 Server-Side Security (`lib/actions/secure-ops/`)

Every write goes through `'use server'` actions, never a client-callable API route:
- `getActor(jwt?)` — resolves user from session cookie or JWT
- `verifyResourcePermission*` — checks Appwrite RLS + collaborators table before any update
- `createRowSecure / updateRowSecure / deleteRowSecure` — injects user-scoped ACLs
- `hasWriteAccess` — escalates to admin SDK only when user explicitly owns resource
- React `experimental_taintUniqueValue` applied to all secret env vars in `lib/appwrite-admin.ts`

### 4.4 Permission Model

```
Database RLS → read-only by default (Role.any() never granted)
creatorId → Permission.read(Role.user(creatorId)) baked into row at creation
collaborators table → polymorphic: resourceType + resourceId + userId + permission
Permission updater function → async escalation after collaborator invite accepted
Sudo mode → transient confirmation window, respects privacy, for thoughtful vault changes
```

---

## 5. Data Layer & Offline-First Sync

### 5.1 Client SDK Proxy (`lib/appwrite/client.ts`)

The exported `tablesDB`, `databases`, `storage`, `realtime`, `account` objects are
**wrapped proxies** that intercept calls to inject JWT, handle offline states, coalesce
inflight requests, and normalize the arg shape between Appwrite `TablesDB` and `Databases` APIs.

### 5.2 Offline-First Merge Engine (`lib/sync/`)

```
local-copy-sync.ts — mergeServerPageWithLocalCopy()
  ├── Local list is SoT for UI display
  ├── Remote page merged in: local wins if updatedAt is newer
  ├── Pending (dirty) rows survive remote pulls
  ├── Hard deletes tracked via tombstone Set
  └── Sort: pinned first, then newest createdAt

pending-sync-bridge.ts — queue dirty writes to RxDB
optimistic-engine.ts  — optimistic UI update before server confirms
interpolation-engine.ts — content interpolation for concurrent edits
```

### 5.3 RxDB / Dexie Substrate

`lib/webrtc/RxDBManager.ts` manages an RxDB instance backed by Dexie (IndexedDB) for
call signal buffering and offline queue persistence. Notes and tasks use
`context/NotesContext.tsx` and `context/TaskContext.tsx` as the in-memory SoT backed by
local-copy-sync pull cadence (10 s active / 60 s idle via `shouldSoftPull`).

### 5.4 Cache Layers

| Layer | Location | TTL |
|-------|----------|-----|
| In-process Map (`queryCache`) | `lib/kylrixflow.ts` | 15 min |
| `nexus-fetcher` request coalescer | `lib/ecosystem/nexus-fetcher.ts` | configurable |
| `tablesdb-row-cache` read-through | `lib/ecosystem/tablesdb-row-cache.ts` | per-key |
| `commentIdentityCache` | `lib/commentIdentityCache.ts` | session |

---

## 6. Module Map (App Routes to Code)

| Route | Feature | Primary lib files |
|-------|---------|-------------------|
| `/app` | Ideas / Notes | `lib/appwrite/note.ts` (4261 lines), `context/NotesContext.tsx`, `lib/sync/` |
| `/flow` | Tasks, Goals, Calendar, Events | `lib/kylrixflow.ts`, `context/TaskContext.tsx` |
| `/vault` | Password Manager, TOTP, Keys | `lib/appwrite/vault.ts` (3301 lines), `lib/masterpass-crypto.ts` |
| `/connect` | Chat, Moments, Social, Calls | connect tables via `note.ts`, `lib/webrtc/` |
| `/agents` | Kylie AI assistant | `lib/agentic/`, `lib/actions/agentic.ts`, `lib/actions/ai.ts` |
| `/projects` | Project workspace | `lib/appwrite/projects.ts` |
| `/goals` | Goal tracking | `lib/kylrixflow.ts` tasks + `context/TaskContext.tsx` |
| `/billing` | Subscriptions | `lib/billing/`, `lib/actions/billing/` |
| `/settings` | Profile, MFA, Sessions | `lib/appwrite/vault.ts`, `components/ProfileManager.tsx` |

---

## 7. Agentic Engine (Kylie)

```
lib/agentic/
  ├── tools-registry.ts      Declarative tool definitions (create_note, create_goal, etc.)
  ├── context-workflows.ts   Zone-aware quick actions per app zone
  ├── client-executor.ts     Client-side tool dispatch to Server Actions to Appwrite
  ├── session-local-store.ts Conversation history in IndexedDB
  ├── search-engine.ts       Ecosystem-wide search (notes, tasks, vault, contacts)
  ├── hydrate-ecosystem-hits.ts Enriches search results with metadata
  ├── prompt-framework.ts    System prompt builder with zone + user context
  ├── ui-catalog.ts          Maps tool calls to UI drawer/navigation actions
  ├── workflow-bridge.ts     Bridges tool calls to workflow recording engine
  └── spine-bridge.ts        Connects to GlobalShell Spine for app-wide interjections

lib/actions/agentic.ts       'use server': Google Gemini API + tool orchestration
lib/actions/ai.ts            'use server': AI subscription gate + Gemini streaming
lib/context-engine.tsx       LocalContextProvider: telemetry niches, workflow recording

functions/flow-agent-orchestrator/    Appwrite Function for async agent runs
functions/agent-action-guardrail/     Ownership check before any agentic DB write
functions/ecosystem-context-aggregator/ Builds rich context snapshot for Gemini
```

**Execution path:**
User prompt → client-executor picks zone → buildSystemPrompt(zone) → Gemini API
(Server Action) → tool_call JSON parsed → client-executor dispatches → createRowSecure
or UI action → result fed back to Gemini.

AI access gated: Pro plan required. Compute balance tracked in `compute_balances` table
(100 k units/reset). `agent-action-guardrail` validates ownership on every agentic write.

---

## 8. Real-Time Communication

### 8.1 Appwrite Realtime

Subscriptions: `databases.{dbId}.tables.{tableId}.rows` channel.
Used for: chat messages, task updates, call signals, presence heartbeats, vault events.
`lib/kylrixflow.ts` exposes `subscribeToTable<T>()` generic wrapper.

### 8.2 WebRTC Calls (`lib/webrtc/WebRTCManager.ts`)

```
WebRTCManager
  ├── P2P mode: direct RTCPeerConnection (2 participants)
  ├── SFU mode: Cloudflare Calls (N participants)
  │     createCloudflareSession() + createCloudflareTracks()
  ├── Signaling: Appwrite call_signals table rows (offer/answer/ICE via realtime)
  ├── TURN: Cloudflare TURN credentials fetched on init
  ├── Screen share: getDisplayMedia() added as separate transceiver
  └── Recording: MediaRecorder → Blob chunks → storage.createFile()

CallRecorder.ts  wraps MediaRecorder lifecycle for call archives
RxDBManager.ts   buffers signaling state in local RxDB during reconnect
```

### 8.3 Presence & Typing

Ephemeral Appwrite `epochs` rows (short TTL). Presence heartbeat via `app_activity`
table. Typing indicators via channel-scoped realtime broadcast. No persistent storage.

---

## 9. Ecosystem Mesh (`lib/ecosystem/mesh.ts`)

Five logical nodes communicate via `BroadcastChannel('kylrix_mesh_internal')` within
the same tab, and via `window.postMessage` across iframes/popouts (origin-validated):

| Node | Type | Capabilities |
|------|------|-------------|
| `id` | control | auth, identity, quota |
| `note` | data | knowledge graph, AI search |
| `vault` | secure | encryption, passkeys |
| `flow` | logic | task orchestration, events |
| `connect` | message | realtime comm, P2P relay |

`EcosystemSecurity` listens for `LOCK_SYSTEM` mesh command to wipe in-RAM keys across modules.

---

## 10. Appwrite Functions (Serverless Workers)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `permission-updater` | Database event | Propagate ACL changes after collaborator accept |
| `sync-user-profile` | Auth event | Mirror Appwrite user to profiles table |
| `notify-on-share` | Database event | Email notification on note share |
| `notify-on-social-activity` | Database event | Email on follow/reaction |
| `flow-event-sync` | Scheduled | Sync recurring calendar events |
| `log-security-event` | HTTP / DB event | Write to securityLogs table |
| `sync-subscription-status` | Scheduled / webhook | Poll BlockBee + update subscriptions |
| `account-cleanup` | Auth delete event | Cascade delete all user data |
| `connect-call-cleanup` | Scheduled | Expire stale call rooms |
| `ghost-cleanup` | Scheduled | TTL-expire ghost note rows |
| `search-users` | HTTP | Cross-user search with admin SDK |
| `data-porter` | HTTP | Import/export (Bitwarden CSV, JSON) |
| `flow-agent-orchestrator` | HTTP | Async agentic task execution |
| `agent-action-guardrail` | HTTP | Ownership check before agentic writes |
| `ecosystem-context-aggregator` | HTTP | Build Kylie context snapshot |
| `goal-reminder-dispatch` | Scheduled | Push goal reminders via Telegram / email |

---

## 11. Billing & Subscriptions

```
lib/billing/
  ├── subscription-service.ts    Create/cancel subscriptions; check active plan
  ├── blockbee-urls.ts           Generate BlockBee hosted checkout URLs
  ├── blockbee-webhook-verify.ts Verify IPN HMAC signature
  ├── provider-factory.ts        Future: plug-in payment providers
  └── subscription-notifications.ts Email user on plan change

lib/actions/billing/             Server Actions: upgrade, cancel, apply coupon
functions/sync-subscription-status/ Scheduled Function for IPN reconciliation
```

Plans: Free / Pro. Crypto payments via BlockBee. Pro gates: AI access, file uploads
above 10 MB, extended vault, agent compute budget.

---

## 12. Storage Buckets

| Bucket | Use |
|--------|-----|
| `profile_pictures` | User avatars |
| `group_avatars` | Group/conversation icons |
| `notes_attachments` | Note & task file uploads |
| `general_storage` | Generic user files |
| `vault_attachments` | Secure vault file attachments |
| `chat_uploads` | Chat media |
| `kylrix_send` | Ephemeral Send file payloads (7-day TTL) |
| `event_covers` | Event & blog cover images |
| `voice` | Voice message recordings |
| `backups` | Data export archives |

Upload gating: plan check in `lib/actions/secure-upload.ts` before any `storage.createFile()`.

---

## 13. Key Cross-Cutting Patterns

### Isomorphic Server Action Adapter

Every module that does writes uses the same pattern:

```typescript
if (typeof window !== 'undefined') {
  const { createRow } = await import('@/lib/actions/client-ops');
} else {
  const { createRowSecure } = await import('@/lib/actions/secure-ops');
}
```

This allows the same business logic to run on both client and server without leaking the
admin SDK to the browser bundle.

### Ghost Notes (Ephemeral Comment Threads)

Ghost notes (`createGhostNoteSecure`) are lightweight note rows pinned to a resource
(call, task, project, event). They act as comment/chat channels without a separate table.
TTL-cleaned by the `ghost-cleanup` function.

### CrossLinks & Tags (`lib/sdk/crosslinks.ts`)

Notes reference other resources via composite tag prefixes (`source:kylrixnote:id`).
Replaces join tables. Vault items, tasks, and projects link to notes via this tag pattern.

### Context Engine (`lib/context-engine.tsx`)

`LocalContextProvider` sits at app root. Buffers up to 30 user events across telemetry
niches (workspace, productivity, connect, security, intelligence, billing, system).
Compiles `CompiledLocalContext` fed into Kylie's system prompt. Owns the workflow
recording engine (macro capture).

### Ecosystem State Tracker (`lib/ecosystem/state-tracker.ts`)

Persists last N visited routes to `localStorage('kylrix_ecosystem_state_tracker')`.
Middleware reads a cookie copy to fast-resume authenticated users to their last route.

---

## 14. Middleware & Edge Logic

`middleware.ts` (Next.js Edge Runtime):
1. Root `/` redirect: auth cookie hint to last-route resume or `/app`
2. Legacy route rewrites (`/app/{noteId}` to `/idea/{noteId}`, etc.)
3. Redirect loop circuit-breaker (`_rd` param depth >= 5 → rewrite to clean URL)
4. Reload-storm defense (cookie counter: 30 req / 5 s → 429 with 3 s retry)

---

## 15. DevOps & Self-Hosting

```
Dockerfile               Multi-stage Node 22 build → standalone Next.js output
docker-compose.yml       Full stack: Next.js app + Appwrite stack
docker-compose.app-only.yml  App only (for existing Appwrite instances)
ota.yaml                 Ota contract (verify, sqlite-dev, selfhost workflows)
appwrite.config.json     Declarative full schema (tables, indexes, buckets, functions)
```

Schema is deployed via `appwrite push` using `appwrite.config.json`. The 344 KB config
file defines every table attribute, index, and RLS rule — infrastructure as code for the
entire data model.

---

## 16. Dependency Highlights

| Package | Role |
|---------|------|
| `appwrite` v21 | Client SDK (TablesDB, Account, Realtime) |
| `node-appwrite` v19 | Server Admin SDK (Server Actions only) |
| `@google/generative-ai` | Gemini 1.5 / 2.0 for Kylie |
| `rxdb` + `dexie` | Local-first offline storage |
| `hash-wasm` | Argon2id in browser (WASM) |
| `@simplewebauthn/browser` + `/server` | WebAuthn / Passkeys |
| `@noble/ed25519` + `secp256k1` | Identity keys, Web3 wallet |
| `@scure/bip32` + `bip39` | HD wallet derivation |
| `viem` | EVM chain interactions |
| `framer-motion` | UI animations |
| `zod` | Runtime validation |
| `dompurify` | Gentle HTML handling for private content |
