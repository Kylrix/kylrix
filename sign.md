# Current Engineering State & Build Handoff (`sign.md`)

> **FOR KIRO / INCOMING AGENTS**: Read this file first. It contains the exact status, recent architecture migrations, committed fixes, and remaining work.

---

## 1. What Just Happened & Architectural Invariants

### 1.1 Appwrite Phased Out completely
- **Reason**: Vendor lock-in, unmaintainable schema drift, high latency, and risks of remote schema wipe via CLI.
- **Replacement**:
  - **Database**: Turso (LibSQL / SQLite) via Drizzle ORM (`lib/core/adapters/turso/database.adapter.ts`).
  - **Auth**: Better-Auth.
  - **Shims**: `appwrite` and `node-appwrite` packages are **completely removed** from `package.json`. Sovereign type shims live in `lib/shims/shared.ts`, `lib/shims/appwrite.ts`, and `lib/shims/node-appwrite.ts`.
- **STRICT MANDATE**: Do NOT reinstall `appwrite` or `node-appwrite`. Do not add them back to `package.json`.

### 1.2 Realtime Replacement: Cloudflare PartyKit Durable Objects
- **Worker Host**: `kylrix-party.kylrix.workers.dev` (env: `NEXT_PUBLIC_PARTY_HOST` / `NEXT_PUBLIC_PARTYKIT_HOST`).
- **Client Realtime Engine**: `lib/realtime/partykit.ts` connects via WebSocket to `wss://${NEXT_PUBLIC_PARTY_HOST}/room/global` with automatic reconnection and prefix/wildcard event routing (`databases.*`, `collections.*`, `tables.*`, `rows.*`, `${table}.${action}`).
- **Hooks**: `realtime.subscribe()` in `lib/appwrite/client.ts` and `lib/shims/shared.ts` delegates directly to `partyRealtime.subscribe()`.
- **Database Broadcaster**: Every mutation in `lib/core/adapters/turso/database.adapter.ts` (`createRow`, `updateRow`, `deleteRow`, `incrementRowColumn`) asynchronously broadcasts events to the Cloudflare PartyKit room via non-blocking HTTP POST.

---

## 2. Progress Completed in Recent Commits

### Commit `f5a0f7ef`: Realtime Wiring
- Wired Cloudflare PartyKit WebSocket engine into client subscriptions and Turso mutations.

### Commit `bb18a2ff`: Initial Build Fixes
- Added missing `OAuthProvider` enum (`Google`, `Github`, `Apple`, `Discord`, `Spotify`) to `lib/shims/shared.ts`.
- Removed unused `AppwriteAuthAdapter` import from `lib/core/di/registry.ts`.

### Commit `1ccb4edc`: Major Build & Type Resolution (23 files, -1,899 LOC)
- **Export Restorations**: Restored missing `APPWRITE_DATABASE_ID`, `APPWRITE_BUCKET_BACKUPS_ID`, `APPWRITE_BUCKET_PROFILE_PICTURES_ID`, `APPWRITE_COLLECTION_KEYCHAIN_ID`, and pulse/preview helpers in `lib/appwrite/client.ts`.
- **Client & Shim Compatibility**:
  - Added backwards-compatible `Client.subscribe()` on `Client` class in `lib/shims/shared.ts`.
  - Added `Account.getPrefs()` and `Account.updatePrefs()`.
  - Typed `Users` return promises and `Messaging.createEmail()`.
  - Fixed untyped `(e: string)` callbacks in `lib/services/social.ts`.
  - Fixed `app/(app)/forms/page.tsx` subscription call to use `realtime.subscribe`.
- **Storage Subsystem Removal**:
  - Cleanly removed deprecated `storage.adapter.ts`, `storage.port.ts`, `secure-upload.ts`, `services/storage.ts`, and download route.
  - Stripped dead storage dependencies from `lib/core/di/registry.ts` and `components/overlays/UnifiedFileAttachmentDrawer.tsx`.

### Commit `9acac6d9`: `.idx/dev.nix` Resource Optimization
- Removed the automatic `pnpm run dev` preview server block from `.idx/dev.nix` to prevent memory exhaustion and token wastage.

---

## 3. What Needs to Be Done Next (For Kiro / Next Agent)

1. **Verify Local Typecheck**:
   Run:
   ```bash
   pnpm tsc --noEmit
   ```
   Check for any remaining type errors across pages or components that referenced removed storage APIs.

2. **Run Linting**:
   ```bash
   pnpm lint
   ```
   Fix any unused imports or lint issues surgically.

3. **Verify Turbopack Build**:
   ```bash
   pnpm build
   ```
   Turbopack is memory-intensive; if running locally, ensure node memory limit is sufficient:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm build
   ```

4. **Sync / Deploy**:
   Once lint and build pass with zero errors, commit and push to `master`. If fork syncing is required, sync to `nathfavour/kylrix` via GitHub CLI or API without co-author headers.
