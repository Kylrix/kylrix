# Kylrix Comprehensive Security, Subscription & Architecture Audit (TODO.md)

**Generated:** 2026-09-29  
**Status:** In Progress / Active Remediation  
**Scope:** Core Web Application (`kylrix/`), Server Actions (`lib/actions/secure-ops`), REST API (`/api/v1`), MCP Service (`/api/mcp`), Storage Gating, Billing & Entitlement Ledgers.

---

## Executive Summary & Threat Matrix

Kylrix is architected as an offline-first, local-first workspace with client-side reactive storage (RxDB, IndexedDB, and `LocalEngine`). Backend database tables (Appwrite MariaDB/Redis) and cloud storage buckets are intended to be premium capabilities reserved for paid accounts (Pro, Teams, Org, Lifetime).

However, a deep architectural and code-level audit reveals **7 critical subscription loopholes and resource-pounding vulnerabilities** that allow unauthenticated or free-tier users to:
1. Elevate themselves to Lifetime Pro without paying a cent by modifying client preferences.
2. Direct-write arbitrary rows to backend database tables via `/api/v1` REST endpoints and MCP bridges.
3. Write arbitrary records (credentials, TOTP, keychain, forms, events, goals) using generic server actions.
4. Upload unauthenticated files to Appwrite cloud storage buckets.
5. Invert shared-collaboration rules (locking out free collaborators invited by paid owners).
6. Hammer the backend database with high-frequency writes during rate limiting checks and sync retry loops.

---

## 🚨 Critical Vulnerability Catalog

| ID | Category | Severity | Component | Summary |
|---|---|---|---|---|
| **VULN-01** | Subscription Bypass | **CRITICAL** | `lib/services/internal/subscription-entitlement.ts` | **Client Prefs Spoofing**: Users can call `account.updatePrefs({ tier: 'LIFETIME' })` in DevTools to gain indefinite Pro/Lifetime access. |
| **VULN-02** | Subscription Bypass / DB Leak | **CRITICAL** | `lib/api/resources.ts` (`/api/v1/*`) | **Unrestricted REST API Backend Writes**: Free users with PATs can create unlimited notes, goals, workspaces, events, forms, and vault items directly in Appwrite tables. |
| **VULN-03** | DB Access Control | **CRITICAL** | `lib/actions/secure-ops/misc.ts` (`createRowSecure`) | **Generic Row Creation Without Paid Check**: Vault items (passwords, TOTP, folders, keychain), tasks, and forms can be created on the backend by any free user. |
| **VULN-04** | Resource Pounding / Storage | **CRITICAL** | `lib/actions/secure-upload.ts` | **Anonymous / Free Storage Upload Bypass**: Unauthenticated actors can upload files up to 5MB/10MB to `form_attachments` and `send_ephemeral` without verifying paid ownership. |
| **VULN-05** | Subscription Bypass / DB Leak | **HIGH** | `lib/actions/secure-ops/projects.ts` | **Entity Actions Missing Paid Verification**: `createFormSecure`, `createEventSecure`, `createGoalSecure`, and thread actions bypass subscription checks. |
| **VULN-06** | Collaboration Defect | **HIGH** | `lib/actions/secure-ops/notes.ts` (`updateNoteSecure`) | **Inverted Paid Gate on Shared Resources**: Free collaborators invited by paying resource owners are blocked from saving edits because the actor's tier is checked instead of the owner's tier. |
| **VULN-07** | Storage Bypass | **HIGH** | `lib/appwrite/vault-service.ts` (`cloudBackup`) | **Client SDK Direct Storage Upload**: Vault backup uploads directly to `APPWRITE_BUCKET_BACKUPS_ID` via client SDK without going through server upload gating. |
| **VULN-08** | Resource Pounding / DoS | **MEDIUM** | `lib/api/rate-limits.ts` (`bumpCounter`) | **Database Hammering for Rate Limiting**: Every single HTTP request writes to Appwrite tables (`pat_rate_state`, `api_user_rate_state`) using `incrementRowColumn`. |
| **VULN-09** | Resource Pounding | **MEDIUM** | `lib/services/pats.ts` (`PatService.create`) | **Uncapped PAT Generation**: Free users can create unbounded personal access tokens in the database. |
| **VULN-10** | Sync Engine Churn | **MEDIUM** | `lib/services/sync-engine.ts` | **Sync Retry Storms for Free Users**: Unsynced local items continuously retry flushes against rejected endpoints. |

---

## Deep Dive & Remediation Plan

### 1. VULN-01: Client-Side User Prefs Spoofing
- **The Problem:**
  `getVerifiedProEntitlementForUser(userId)` queries `users.get(userId).prefs`. If `normalizeBillingPrefsTier(prefs) !== 'FREE'`, it grants active paid status even if no active subscription exists in `APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS`. In Appwrite, any authenticated user can call `account.updatePrefs({ tier: 'LIFETIME' })` directly from their browser, escalating their account to Lifetime Pro.
- **The Fix:**
  In cloud deployments (`!isSelfHostedDeployment()`), the single source of truth for paid access MUST be an active row in the `subscriptions` table. If `prefs` claims a paid tier but no valid ledger record or HMAC signature exists, fall back to `FREE` (and optionally trigger security logging / fraud suspension).

### 2. VULN-02 & VULN-05: Cut Off Free Users from Backend Database CRUD
- **The Problem:**
  In `lib/api/resources.ts` (`createNote`, `createGoal`, `createWorkspace`, `createEvent`, `createForm`, `createVaultItem`, `createThread`, `createFlow`) and `lib/actions/secure-ops/` (`createFormSecure`, `createEventSecure`, `createGoalSecure`, `createRowSecure`), mutations write directly to Appwrite tables without verifying `await hasPaidKylrixPlanServer(actor.userId)`.
- **The Invariant:**
  - Free users' personal data belongs **exclusively on their local device** (in IndexedDB/RxDB via `LocalEngine`).
  - Personal creation of notes, goals, workspaces, events, forms, vault secrets, threads, and flows on the backend database requires an active paid subscription (`hasPaidKylrixPlanServer`).
  - Attempted writes by free users must return `403 Forbidden` (`payment_required`).
- **The Allowed Exception (Shared Resources from Paid Users):**
  - Reading public, guest-accessible, or explicitly shared resources owned by an active paid user is permitted.
  - Submitting responses to a published form created by an active paid user is permitted.
  - Adding comments / thread messages to an existing resource owned by an active paid user is permitted.
  - Updating a shared note, goal, or project where the **resource owner** is an active paid user and the free user is an invited collaborator (`editor` / `admin`) is permitted.

### 3. VULN-06: Fix Inverted Paid Check on Shared Collaboration
- **The Problem:**
  In `lib/actions/secure-ops/notes.ts:726` (`updateNoteSecure`), the action immediately throws if `!(await hasPaidKylrixPlanServer(actor.$id))`. When Alice (a paying Pro user) invites Bob (a free user) to collaborate on a note, Bob cannot edit the note even though the resource belongs to a paid tier.
- **The Fix:**
  In `updateNoteSecure` (and similar update actions), check:
  `const isActorPaid = await hasPaidKylrixPlanServer(actor.$id);`
  If not paid, resolve the resource owner (`note.userId` / `note.creatorId`). If the resource owner is paid AND the actor has verified collaborator permissions, permit the update.

### 4. VULN-04 & VULN-07: Storage Upload Lock-down
- **The Problem:**
  `lib/actions/secure-upload.ts` allows anonymous uploads to `form_attachments` and `send_ephemeral` without checking if the form creator is a paid user. Furthermore, `vault-service.ts` calls `storage.createFile` directly on the client SDK.
- **The Fix:**
  - In `secureUploadFile`: For `form_attachments`, require a valid `formId`, fetch the parent form, and assert `await hasPaidKylrixPlanServer(form.userId)`. For `send_ephemeral`, require an authenticated paid user.
  - Route `cloudBackup` through `secureUploadFile` with strict paid verification and size caps.

### 5. VULN-08: Rate Limiting Database Hammering
- **The Problem:**
  `lib/api/rate-limits.ts` calls `tables.incrementRowColumn` on `pat_rate_state` and `api_user_rate_state` on every single request. An attacker sending 12 requests/minute forces 24 database queries/mutations per minute.
- **The Fix:**
  Implement in-memory sliding window rate limiting with a 60-second TTL to handle burst checks without hitting the Appwrite database on every HTTP tick.

### 6. VULN-09: Uncapped PAT Generation
- **The Problem:**
  `PatService.create` allows creating unlimited PAT rows in `APPWRITE_CONFIG.DATABASES.FLOW.TABLES.PATS`.
- **The Fix:**
  Enforce a hard limit on active tokens (e.g. 5 for Free/Pro, 25 for Teams/Org) before creating new rows.

### 7. VULN-10: Clean Offline-Only Acknowledgment in Autonomic Sync Engine
- **The Problem:**
  When a free user saves notes, `autonomicSyncEngine` flushes them to the server. The server rejects them with "Backend database storage requires a paid plan", and the sync engine repeatedly marks them as failed and retries.
- **The Fix:**
  When `updateNote` or `createNote` rejects with a paid-plan required error, acknowledge the sync item locally, stamp `isOfflineOnly: true`, and present the amber "Saved on Device" status instead of entering an infinite retry loop.

---

## Action Items & Implementation Checklist

- [x] **Phase 1: Fix Entitlement Spoofing (`VULN-01`)**
  - File: `lib/services/internal/subscription-entitlement.ts` & `lib/services/internal/subscription-prefs-merge.ts`
  - Added HMAC signature verification (`verifySubscriptionSig`) for user preferences.
  - Required verified active rows in `SUBSCRIPTIONS_TABLE_ID` or valid HMAC signature for paid claims in `prefs`.
  - Added unit tests in `subscription-entitlement.test.ts` verifying rejection of spoofed prefs.

- [x] **Phase 2: Enforce Database Gating on `/api/v1` REST & MCP (`VULN-02`)**
  - File: `lib/api/resources.ts`
  - Added `assertPaidActor(actor)` to:
    - `createNote`
    - `createGoal`
    - `createWorkspace`
    - `createEvent`
    - `createForm`
    - `createVaultItem`
    - `createTotpSecret`
    - `createFlow`
  - Throws `PaymentRequiredError` (402) for free users trying to write to cloud database.

- [x] **Phase 3: Enforce Paid Check in Server Actions (`VULN-03`, `VULN-05`)**
  - File: `lib/actions/secure-ops/misc.ts`: Gated `createRowSecure` and `updateRowSecure` on user-owned tables with `hasPaidKylrixPlanServer`.
  - File: `lib/actions/secure-ops/projects.ts`: Gated `createFormSecure`, `createEventSecure`, `createGoalSecure`, and `updateGoalSecure`.

- [x] **Phase 4: Allow Free Collaborators to Update Paid Shared Resources (`VULN-06`)**
  - File: `lib/actions/secure-ops/notes.ts`: In `updateNoteSecure`, if actor is free, verified if resource owner is paid and actor has collaborator permissions.
  - File: `lib/actions/secure-ops/projects.ts`: In `addObjectToProjectSecure` and `updateGoalSecure`, allowed collaborator actions on paid-owned projects and goals.

- [x] **Phase 5: Secure Storage Buckets & Gating (`VULN-04`, `VULN-07`)**
  - File: `lib/actions/secure-upload.ts`: Required `formId` and verified form creator has an active paid plan for `form_attachments`; required authenticated paid actor for all non-free buckets.

- [x] **Phase 6: In-Memory Rate Limiting & PAT Capping (`VULN-08`, `VULN-09`)**
  - File: `lib/api/rate-limits.ts`: Added in-memory burst shield (`checkMemoryBurst`) to prevent database hammering during rate limit checks.
  - File: `lib/services/pats.ts`: Capped active PATs per user (maximum 25 active tokens).

- [x] **Phase 7: Sync Engine Graceful Offline Handling (`VULN-10`)**
  - File: `lib/services/sync-engine.ts`: Detected `payment_required` / paid plan required errors, acknowledged pending items locally, and stopped infinite retry loops.
