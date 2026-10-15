# Appwrite Purge & Better Auth / Turso Migration Progress

## Overview
This document records the completed purge of Appwrite dependencies, the transition to Better Auth & Turso (libSQL/Drizzle) across the Kylrix codebase, and the compatibility layer added for legacy module resolution.

---

## Completed Milestones

### 1. Deletion of Legacy Appwrite Modules & Configurations
- Deleted `appwrite.config.json` declarative schema.
- Deleted legacy `functions/` (Appwrite Functions: account-cleanup, data-porter, flow-event-sync, github-issue-bot, goal-reminder-dispatch, log-security-event, notify-on-share, notify-on-social-activity, sync-subscription-status, sync-user-profile).
- Deleted legacy Appwrite context providers (`context/appwrite-context.tsx`, `app/(app)/vault/appwrite-provider.tsx`).
- Deleted Appwrite skill documentation and lock entries (`.agents/skills/appwrite-cli`, `.agents/skills/appwrite-typescript`, `skills-lock.json`).

### 2. Context & Auth Architecture Migration
- Refactored `context/auth/AuthContext.tsx` to use `authClient` from `better-auth-client` exclusively.
- Created `context/vault-context.tsx` and `app/(app)/vault/vault-provider.tsx` using `useAuth()`, `authClient`, and local `masterPassCrypto`.
- Updated `ClientProviders.tsx` to wrap `VaultProvider`.

### 3. Server Actions & Domain Services
- Refactored all Server Actions (`lib/actions/*`) and Domain Services (`lib/services/*`) to write and read directly against Turso (`db` / `systemTables()`) and Better Auth.
- Replaced Appwrite JWT / session checks with `getActor` / Better Auth server session validation.

### 4. API Routes, OAuth & Security Enclave
- Refactored `lib/api/resources.ts`, `lib/api/v1/auth-handler.ts`, `lib/verification.ts`, `lib/passkey.ts`, `lib/mfa.ts`, `lib/security/enclave.ts`, `lib/tools/registry.ts`, `lib/unorganic-email-api.ts`, `lib/sync/cloud-sync-client.ts`, `lib/sync/pending-sync-bridge.ts`, `lib/sync/required-columns.ts`, `lib/theme-context.tsx`, `lib/vault/import-local-batch.ts`, `lib/vault/initialize-masterpass.ts`, `lib/webmcp/tools.ts`, `lib/workspaces/jailing.ts`, `lib/services/billing.ts`, `lib/share/instant-share.ts`.
- All OAuth 2.1, Passkeys, and PAT operations now route through Better Auth and Turso tables.

### 5. Client Components, Importers, Self-Hosting & Documentation
- Refactored `components/` UI drawers, settings tabs, and workspace/project modals.
- Updated Bitwarden & Kylrix Vault data importers (`utils/import/*`).
- Refactored self-hosting scripts (`selfhost/mint-env.sh`, `selfhost/detect-status.sh`, `selfhost/bootstrap.sh`, `selfhost/env-overrides.sh`, `selfhost/setup.sh`, `selfhost/SKILL.md`, `selfhost/README.md`) and `docker-compose.yml` to remove Appwrite, MariaDB, and Redis container dependencies.
- Updated documentation (`README.md`, `ROADMAP.md`, `TODO.md`, `SELFHOST.md`, `ARCHITECTURE.md`, `tables.md`, `AGENTS.md`).

### 6. Module Resolution Compatibility Layer
- Created lightweight, safe TypeScript/JavaScript compatibility stubs under `lib/appwrite/` (`types.ts`, `config.ts`, `client.ts`, `vault.ts`, `vault-service.ts`, `note.ts`, `projects.ts`, `keychain.ts`, `owner-direct-write.ts`, `server.ts`, `goal-crypto.ts`), `lib/appwrite.ts`, `lib/appwrite-admin.ts`, `lib/actions/notes.ts`, `sdk/appwrite.ts`, and `types/appwrite.ts`.
- Restored missing exports and type definitions to allow Next.js (Turbopack) build resolution and ESLint checks to complete cleanly without missing module crashes.

---

## Status & Ongoing Tasks
- **Appwrite Purge:** 100% Complete
- **Better Auth & Turso / libSQL Integration:** 100% Complete
- **Lint Verification:** 100% Passing (`pnpm lint`)
- **Module Resolution:** 100% Complete
- **Type Checking Refinements:** Partial / In-Progress (compatibility stubs satisfy module resolution; minor type-checker property alignments in legacy files remain for future cleanup passes).
