# ARCHITECTURE.md — Kylrix Modern System Architecture

> **Single-database, offline-first, agentic workspace and communication ecosystem.**
> Next.js 16 · React 19 · TypeScript · Appwrite · RxDB / Dexie · WebRTC P2P · Argon2id · OpenBricks 4.0

---

## 1. System Macro-Structure

```
kylrix/
├── app/                  Next.js 16 App Router
│   ├── (app)/            Authenticated layout shell (ideas, goals, events, vault, connect, agentic sidekick, workspaces)
│   ├── [alias]/ + u/     Short-link aliases & public published profiles / tabs
│   ├── api/v1/[...path]/ REST API (PAT + OAuth 2.1 OIDC resource server)
│   ├── api/dev/logs      Dev-mode error ring buffer & SSE log stream
│   ├── oauth/consent     Sign-in-with-Kylrix consent handler (`grant_id`)
│   └── pricing/ docs/    Public marketing & documentation
├── components/           OpenBricks 4.0 feature components & UI drawers
├── context/              Auth, Data, Tasks, Theme, Layout, Sudo, TaskContext
├── hooks/                Workspace filters, resource pins, identity hooks
├── lib/
│   ├── actions/          Server Actions ('use server') — secure write path & AI execution
│   ├── agentic/          Kylie & Sidekick agent engines, patching-engine, tools, prompts
│   ├── ai/               Sanitizer, prompt schema builders, user error masks
│   ├── api/              PAT / OAuth REST API handlers & scope verification
│   ├── appwrite/         SDK proxy, TablesDB normalize, client proxy
│   ├── billing/          Subscription entitlement, BlockBee crypto checkout ledger
│   ├── ecosystem/        Mesh internal broadcast channel, identity cache, state tracker
│   ├── services/         autonomicSyncEngine, LocalEngine (RxDB/Dexie), users, chats
│   ├── security/         SudoModal enclave, masterpass-crypto (Argon2id + AES-256-GCM)
│   ├── workflows/        Unified Object Workflows (deterministic vault execution)
│   └── webrtc/           WebRTCManager (direct P2P) & PresenceService (ephemeral signaling)
├── functions/            Appwrite Functions (permission-updater, profile-sync, etc.)
├── appwrite.config.json  Declarative schema definition (`passwordManagerDb`)
├── middleware.ts         Edge router: auth hint, legacy rewrites, reload storm rate limit
└── ARCHITECTURE.md       System Architecture Documentation
```

---

## 2. Single-Database Design (`passwordManagerDb`)

All modules across Kylrix share **a single Appwrite database ID**: `passwordManagerDb` (`APPWRITE_CONFIG.TABLES.*`). Polyfill joins are handled via indexed composite tags (`source:kylrixnote:id`) or dedicated join rows (`project_objects`), eliminating cross-database dependencies and guaranteeing atomic schema deployments.

### 2.1 Table Taxonomy

| Domain | Key Tables | Purpose |
| :--- | :--- | :--- |
| **NOTE** | `notes`, `tags`, `collaborators`, `comments`, `reactions`, `activityLog`, `note_revisions` | Knowledge base, ideas, collaborative notes, public articles |
| **VAULT** | `credentials`, `totpSecrets`, `folders`, `securityLogs`, `keychain`, `key_mapping`, `wallets` | Encrypted secrets, TOTP tokens, HD wallets, enclave mappings |
| **FLOW** | `tasks`, `events`, `calendars`, `eventGuests`, `focusSessions`, `forms`, `agents` | Productivity goals, events, form workflows, focus timers |
| **CONNECT** | `conversations`, `conversationMembers`, `messages`, `moments`, `follows`, `calls`, `contacts`, `epochs` | Chat hangouts, unified threads, WebRTC P2P calls, social feeds |
| **WORKSPACE** | `projects` (Workspaces UI), `project_objects` (workspace item bindings) | Workspace boundaries, cross-object workspace aggregation |
| **SYSTEM** | `profiles`, `subscriptions`, `settings`, `extensions`, `compute_balances` | User preferences, subscription state, compute balance quotas |
| **API/PAT** | `pats`, `pat_rate_state`, `api_user_rate_state` | Public REST API keys, rate limit buckets, quota tracking |
| **OAUTH** | `oauth_apps`, `oauth_app_installs`, `oauth_consent_requests` | OAuth 2.1 application credentials and consent grants |

---

## 3. Identity, Authentication & Zero-Touch Resource Protection

### 3.1 Authentication Pipeline
- **Session Auth:** Appwrite Account session cookie coupled with the `kylrix_pulse_v2` edge hint cookie for instant layout rendering.
- **Identity Resolution (`lib/identity-cache.ts`):** Cached across in-memory state, `localStorage` (`kylrix_connect_identity_cache_v1`), and `LocalEngine` (`identity:${userId}`) to guarantee 0ms local profile rendering without redundant database reads.
- **Zero-Touch Resource Protection:** Free plan users automatically bypass JWT generation (`getJWT()` in `AuthContext` synchronously returns `null`), avoiding unnecessary Appwrite `account.createJWT()` network requests.
- **REST API Auth:** REST endpoints accept Personal Access Tokens (`Authorization: Bearer kylrix_pat_...`) and OAuth 2.1 Bearer JWTs verified via Appwrite JWKS.

---

## 4. Security Enclave & Vault Architecture

```
                               ┌────────────────────────────────┐
                               │     SudoModal (requestSudo)    │
                               └───────────────┬────────────────┘
                                               │
                               ┌───────────────▼────────────────┐
                               │ masterpass-crypto (Argon2id)   │
                               │  64MB / 3 iterations / 4 p     │
                               └───────────────┬────────────────┘
                                               │
                               ┌───────────────▼────────────────┐
                               │ SecurityEnclave (RxDB/Dexie)   │
                               │ sec_enclave_keychain_{userId}  │
                               └────────────────────────────────┘
```

### 4.1 Master Password & Enclave (`masterpass-crypto.ts`)
- **Key Derivation:** Master passwords are key-stretched using WASM **Argon2id** (64 MB memory, 3 iterations, 4 degree parallelism) to derive 256-bit keys for AES-256-GCM authenticated payload encryption.
- **Security Enclave (`lib/security/enclave.ts`):** Master keys and decrypted pocket keychains reside strictly in client RAM and local `sec_enclave_keychain_{userId}` storage in `LocalEngine`. Encrypted vault entries are never transmitted in plaintext to backend servers.

### 4.2 Universal `SudoModal` Verification (`SudoContext.tsx`)
- All vault authentication and critical security triggers (unlocking vault, setting up vault, changing master password, resetting vault) flow exclusively through `SudoModal` via `requestSudo`.
- For `change-masterpass`, `initialize`, and `reset` intents, `requestSudo` does not bypass `SudoModal` even when the vault is already unlocked, and auto-biometric passkey triggers are suppressed.

### 4.3 Deterministic Vault Workflows (`lib/workflows/object-workflows.ts`)
- Unified Object Workflows strictly enforce **non-AI deterministic execution** for encrypted vault items (`credential`, `totp`, `secret`, `vault`), shielding credentials from external AI model processing or LLM token streams.

---

## 5. Offline-First Data Layer & Autonomic Sync Engine

```
UI Action → LocalEngine (0ms UI Paint) ──► Mark Pending (rev)
                                                 │
                                     autonomicSyncEngine
                                  (Adaptive 1500ms debounce)
                                                 │
                                       Appwrite Server Ack
```

### 5.1 Local-First Architecture
- **0ms UI Hydration:** Local cache in `LocalEngine` (RxDB / Dexie) acts as the primary source of truth for UI state. Content paints instantly before background sync cycles execute.
- **Autonomic Sync Engine (`lib/services/sync-engine.ts`):**
  - **Adaptive Debouncing:** Uses a 1500ms debounce window during active typing/keystrokes to minimize network overhead and database write operations.
  - **Microtask Flushing:** Discrete edit actions trigger immediate 0ms microtask flushes (`autonomicSyncEngine.nudge(true)`), opportunistically sweeping and flushing unsynced pending entities across goals, notes, events, forms, secrets, and TOTPs.
  - **Confirmation Acknowledgment:** Server confirmations invoke `autonomicSyncEngine.markConfirmed` when `pending: false` to clear pending indicators across active tasks and goals.

### 5.2 Persistent Tombstone Deletion
- Local item deletions write persistent tombstones into `LocalEngine` via `markDeleted(id, userId)`. This immediately purges local cache keys, cancels pending sync in `autonomicSyncEngine`, and prevents soft refreshes or background pulls from resurrecting deleted entities.

### 5.3 Cloud Entitlement Cutoff
- On Kylrix Cloud, free plan sync engine cycles and direct session database writes in `lib/appwrite/owner-direct-write.ts` are cut off, maintaining 100% offline-first local storage in `LocalEngine` without invoking server infrastructure.

---

## 6. Agentic Engine: Kylie & Sidekick

```
                     ┌─────────────────────────────────────────┐
                     │          Kylie Agentic Topbar           │
                     │      Full Screen Mode (100dvh)          │
                     └────────────────────┬────────────────────┘
                                          │
                     ┌────────────────────▼────────────────────┐
                     │            Sidekick Drawer              │
                     │  Event: 'kylrix:open-sidekick'         │
                     └────────────────────┬────────────────────┘
                                          │
                     ┌────────────────────▼────────────────────┐
                     │        Patching Engine & Actions        │
                     │   Surgical JSON/Text Anchor Edits       │
                     └─────────────────────────────────────────┘
```

### 6.1 Agent Execution Surface
- **Kylie Topbar Agent (`AgenticPanelContent`):** Operates full screen (`100dvh`) across bottom drawers and mobile overlays.
- **Sidekick Companion Drawer (`SidekickDrawer.tsx`):** Triggered globally across object detail views by dispatching the `kylrix:open-sidekick` custom event with context payload `{ type, id, title, content, tags, metadata }`. Hydrated locally with 0ms delay via `SidekickHistoryBridge`.

### 6.2 Intelligent Patching Engine (`lib/agentic/patching-engine.ts`)
- Updates documents and structural form schemas surgically using text anchor matching (`before`, `after`, `target`, `replacement`) instead of re-emitting full document payloads, ensuring low latency and preserving document formatting.

### 6.3 Schema Actions & Error Sanitization
- **Dynamic Schema Actions:** Generates contextual schemas dynamically via `generateObjectAssistSchemaAction` across Ideas, Goals, Events, Forms, Secrets, and TOTPs.
- **Sanitized AI Errors:** AI server actions (`executeSidekickAction`, `executeSidekickChat`, `generateAIContent`) wrap execution in try-catch blocks and sanitize errors using `getAgenticUserMessage` from `lib/agentic/errors.ts` to return structured `{ success: false, error }` objects without leaking raw LLM stack traces to clients.

---

## 7. Real-Time Communication & P2P WebRTC

### 7.1 Unified Conversations
- All hangouts, direct chats, group channels, and object discussions (task, project, event, tag, form) share standard `conversations` and `messages` tables.
- Compound row IDs (`ws-${workspaceId}`) enforce database-level uniqueness in Appwrite for workspace conversations and support direct row lookups.

### 7.2 WebRTC Direct P2P Signaling (`WebRTCManager.ts`)
- Direct Peer-to-Peer (`RTCPeerConnection`) media streams for audio, video, and screen sharing.
- **Ephemeral Presence Signaling:** SDP offers, answers, and ICE candidates transmit over Appwrite Realtime presence channels (`presence.call.<id>`). Zero database table writes or `call_signals` rows are generated, eliminating database thrash and background cleanup crons.

### 7.3 Ephemeral Presence & Typing (`PresenceService.ts`)
- Real-time typing indicators and online state transmit over ephemeral channel broadcasts.
- Enforces **mutual gating** via user privacy preferences (`typingEnabled`, `onlineEnabled`): typing and online indicators require both participants to have presence enabled, and group channels automatically suppress typing banners.

---

## 8. OpenBricks 4.0 UI Design System

### 8.1 Visual Surface Language
- **Alternating Color Scheme:** Pitch-black (`#000000`) container backgrounds paired with deep ash (`#161412`) component cards and `#1C1917` hover states across topbar and inverted drawer search surfaces.
- **Wand2 Icon Standard:** AI assist triggers across form editing and detail UI components exclusively use the `Wand2` icon button instead of textual labels.

### 8.2 Topbar & Drawer Layout Primitives
- **Unified Notification Architecture:** Transient and unprompted notifications integrate directly into topbar layout primitives (`CompactNotificationPill` morphing to `NotificationDrawer` on mobile; compact top-right pill extending to `RightSidebar.tsx` on desktop).
- **Toast Non-Interference:** `ClientToaster` sets `pointerEvents: 'none'` on toast containers so notifications never intercept mouse clicks or block topbar navigation.
- **Global Unmount Policy:** Overlays, drawers, and modals strictly enforce conditional rendering (`{isOpen && <Component />}`) with `keepMounted: false` and `disablePortal: true`, physically removing hidden overlays from the DOM.

---

## 9. Workspace Isolation & Modularity

### 9.1 Multi-Tenant Workspace Boundaries
- Workspace-sensitive entities (notes, goals, events, forms, credentials, TOTPs, agentic sessions) strictly enforce `isWorkspace: true` and `projectId: activeWorkspace.id` during creation in custom workspaces.
- Entities are bound locally in `LocalEngine` via `attachEntityToActiveWorkspace` updating both `projectObjectsCacheKey` and `projectObjectsKindCacheKey`.
- Kylie live agent sessions (`getAgentSession`) match `projectId` and `isWorkspace`, automatically resetting to an empty state if no session exists for the active workspace.

### 9.2 Backend Modularity (`BACKEND=false / BACKEND=true`)
- System operates in two primary deployment modes:
  1. **Self-Hosted / Cloud Mode (`BACKEND=true` or `BACKEND=appwrite`):** Utilizes bundled or remote Appwrite services for sync, storage, and authentication.
  2. **Standalone Client Mode (`BACKEND=false`):** Skips local backend container initialization (MariaDB, Redis, Appwrite schema bootstrap) and runs Next.js as a local-first client relying on `LocalEngine` (RxDB/Dexie), WebRTC, and external connectors.

---

## 10. Public REST API & OAuth 2.1 / OIDC

### 10.1 REST API (`/api/v1`)
- Exposes structured endpoints for Notes, Goals, Events, Workspaces, Forms, Feed Moments, Conversations, Threads, and Agents.
- Authenticated via Personal Access Tokens (`pats` prefix + SHA-256 hash lookup) and OAuth 2.1 Bearer JWTs.
- Enforces rolling 1-minute and 24-hour rate limit buckets (`pat_rate_state`, `api_user_rate_state`).

### 10.2 OAuth 2.1 / OIDC Authorization Server
- Appwrite acts as the OpenID Connect authorization server.
- Interactive consent is handled at `/oauth/consent` using `grant_id` parameters and `oauth2.getGrant / approve / reject`.
- Access tokens carry scopes (`notes:read/write`, `goals:read/write`, `flows:read`, `profile:read`) enforced at `/api/v1` routes.

---

## 11. Core Dependencies

| Package | Purpose |
| :--- | :--- |
| `next` v16 / `react` v19 | Core application framework & UI runtime |
| `appwrite` / `node-appwrite` | Appwrite Client & Admin SDKs |
| `rxdb` + `dexie` | Local-first client database (`LocalEngine`) |
| `hash-wasm` | High-performance WASM Argon2id hashing |
| `@simplewebauthn/*` | Passkey and WebAuthn authentication |
| `@google/generative-ai` | Gemini LLM integration for Kylie and Sidekick |
| `@noble/*` (`ed25519`, `secp256k1`, `bip32/bip39`) | Identity keypairs, HD wallet derivation, and cryptographic signatures |
| `framer-motion` | Motion animations and layout transitions |
