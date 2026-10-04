# Kylrix UI Freeze: Forensic Report & Status Quo Analysis

**Date:** October 4, 2026  
**Status:** UNRESOLVED — UI remains unresponsive / frozen on client load.  
**Severity:** CRITICAL / SHOWSTOPPER  

---

## 1. Executive Summary & Objective Status Quo

Despite multiple consecutive debugging passes and surgical patches, the Kylrix web application UI remains completely frozen for users:
- **No buttons respond to clicks**: Navigation links, drawer triggers, action buttons, and modal dismissals cannot be interacted with.
- **Zero objects hydrate or display interactively**: Notes, goals, ideas, and workspace entities fail to populate or remain unresponsive.
- **Universal freeze**: The freeze reproduces regardless of whether the user is authenticated, unauthenticated (guest), or resuming a cached pulse session.

### The Objective Root Timeline
This issue **did not exist** in the repository prior to late September 2026. The baseline commit from September 26, 2026 (`2ac8a4df`) had a fully functional UI, zero freezing, clean hydration, and responsive user interaction.

The freeze began **immediately and objectively upon introducing Better Auth and Turso database** as part of a planned gradual migration path away from Appwrite (commencing across commits `68729951`, `a3dc1359`, `41182b2a`, and subsequent commits). While the migration was architected to be gentle and seamless—preserving RxDB, local-first IndexedDB, and Appwrite as fallback—the resulting architectural collision has completely locked the frontend execution thread.

---

## 2. Chronological Log of Everything Attempted

Across multiple debugging sessions and PRs, the following specific fixes were applied to origin/master:

### Attempt 1: PartyKit & Realtime Subscription Sanitization
* **Commits:** `fb07d586`, `558ca868`, `a2581e0f`
* **Hypothesis:** `realtime.subscribe` was hijacked by PartyKit WebSockets when `NEXT_PUBLIC_PARTYKIT_HOST` was introduced. A missing `.then()` or failed WebSocket connection threw unhandled exceptions during startup.
* **Changes Made:**
  - Wrapped `realtime.subscribe` in a `createThenableUnsubscribe` wrapper in `lib/appwrite/client.ts`.
  - Stripped protocol prefixes (`https://`, `wss://`) from PartyKit host string.
  - Wrapped party socket creation in defensive try/catch blocks.
* **Result:** No effect on the freeze.

### Attempt 2: Debounced Sync & Note Filtering Scope
* **Commits:** `35934c5e`, `0c0da7b7`, `b931dcd5`
* **Hypothesis:** Sync markers in `LocalEngine` and `useWorkspaceFilteredItems` were dropping personal notes because of newly added `project_objects` relational constraints in Turso schema.
* **Changes Made:**
  - Debounced localStorage writes for sync markers.
  - Bypassed redundant note filtering in `app/(app)/app/(app)/page.tsx` (`workspaceScopedNotes = activeNotes`).
  - Added fallback in `useWorkspaceFilteredItems` to treat `inbox`, `personal`, and `null` projects as personal items.
* **Result:** Did not unfreeze buttons or render pipeline.

### Attempt 3: Backdrop & Overlay DOM Traps
* **Commits:** `00935e0b`, `fc5d4eb2`
* **Hypothesis:** An invisible full-screen DOM element (`fixed inset-0 z-[1600]`) was capturing pointer events across the entire viewport.
* **Changes Made:**
  - In `components/ui/Overlay.tsx`, added an early bail-out `if (!isOpen) return null;`.
  - In `components/onboarding/AccountHealthDrawers.tsx`, added strict null guards (`if (!user || !user.$id || user.isPulse || currentStep === 'none') return null;`) to prevent Drawer mounting for unauthenticated/pulse sessions.
  - In `components/layout/NativeSidebarBridge.tsx`, decoupled `useNativeSidebarApiOptional` to stop re-render cycles between left/right rails.
* **Result:** No effect on the freeze. Pointer events remained dead.

### Attempt 4: Offloading Turso Operations from Client Bundle
* **Commits:** `d505bad3`, `5456524e`
* **Hypothesis:** Dynamic client-side invocation of `ensureBetterAuthUserTurso` in `lib/actions/turso-ops.ts` (which imports `lib/db` with `import 'server-only'`) was crashing or stalling the client worker thread during hydration.
* **Changes Made:**
  - Created a dedicated server API route `POST /api/auth/sync-user`.
  - Replaced the direct server action call in `context/auth/AuthContext.tsx` with a non-blocking `fetch('/api/auth/sync-user')`.
* **Result:** No effect on the freeze.

### Attempt 5: Decoupling Better Auth Client from Core UI Bundle
* **Commits:** `068d47ca`, `888db920`
* **Hypothesis:** `lib/auth.ts` re-exported `authClient` and hooks from `better-auth/react`. Because over 30 UI components import `useAuth` from `lib/auth.ts`, `createAuthClient()` was executing eagerly at module evaluation time before the DOM was ready.
* **Changes Made:**
  - Stripped `better-auth-client.ts` re-exports from `lib/auth.ts`.
  - Isolated Better Auth client strictly to its own dedicated file.
  - Wrapped `initProfile` in `requestIdleCallback` with a 3.5s `AbortController` timeout.
* **Result:** Build and lint passed cleanly, but the running application UI remains completely frozen.

### Attempt 6: Deferring CloudSyncProvider
* **Commit:** `04b4a1af`
* **Hypothesis:** `CloudSyncProvider` was firing an immediate synchronous check on mount.
* **Changes Made:**
  - Wrapped initial and interval sync checks in `requestIdleCallback`.
* **Result:** No change in behavior.

---

## 3. Forensic Comparison: Baseline (`2ac8a4df`) vs Current Master

A full diff comparison against commit `2ac8a4df` (Sept 26, 2026, 1 week ago) reveals 185 modified files and over 16,000 lines of change. The most critical divergence points:

| Layer | State 1 Week Ago (`2ac8a4df`) | Current State (`HEAD`) | Suspected Conflict |
|---|---|---|---|
| **Auth Provider** | Pure Appwrite `account.get()` + pulse cookies + local cache fallback. | Hybrid Appwrite + Better Auth (`better-auth/react`, session sync, `/api/auth/sync-user`). | Auth state listener racing with Appwrite cookie revalidation, leaving React in perpetual unready state. |
| **Database/Sync** | RxDB (Dexie) + Appwrite TablesDB. | RxDB + Appwrite TablesDB + Turso/libSQL (`@libsql/client`, Drizzle ORM, `sync-bridge.ts`). | `sync-bridge.ts` inspecting `localStorage` keys during startup; potential schema mismatch in local RxDB partition `kylrix_nexus_db_v3`. |
| **Realtime** | Pure Appwrite WebSocket proxy. | Hybrid PartyKit WebSocket proxy (`partykit.ts`, PartySocket) + Appwrite Realtime. | PartyKit initialization in `lib/appwrite/client.ts` called synchronously on module import. |
| **Workspaces** | Lightweight workspace ID match on notes/tasks. | Strict `project_objects` join mapping + privacy mode + auto-invite logic. | Queries for project objects hanging or returning empty sets for inbox/personal notes. |
| **Layout/Shell** | Standard `GlobalShell` with conditional drawers. | Extended with `AccountHealthDrawers`, `NativeSidebarBridge`, `CloudSyncProvider` loops. | Deep component provider cascade (15+ nested providers in `ClientProviders.tsx`) where one stuck promise stalls the entire child tree. |

---

## 4. Deep-Root Architectural Hypotheses for the Persistent Freeze

Because all isolated visual fixes (backdrops, CSS, timeouts) have failed, the freeze is almost certainly **not a simple CSS overlay issue**. It is an **engine/runtime lockup**:

1. **Provider Tree Stalling / Deadlock**:
   In `app/ClientProviders.tsx`, there are 15+ nested context providers (`AuthProvider`, `SetupProvider`, `UnifiedDrawerProvider`, `WorkspaceProvider`, `NotesProvider`, `TaskContext`, `CloudSyncProvider`, etc.). If `AuthProvider` or `SetupProvider` sets `isLoading = true` or contains an unresolved `await` in an effect that child contexts depend on synchronously, the entire page renders in a frozen/inert state.
2. **LocalEngine / RxDB Schema Corruption**:
   Commit `cbc0bfb7` introduced `stampTursoSync` and quiet markers directly into RxDB cached documents. If IndexedDB (`kylrix_nexus_db_v3`) encountered a Dexie/RxDB schema version incompatibility on client machines, it may be stuck in an infinite schema migration / database open lock.
3. **Module-Level Circular Require Deadlock**:
   `lib/appwrite/client.ts` dynamically requires `lib/realtime/partykit.ts`, which in turn requires `lib/appwrite/client.ts`. In Turbopack/Next.js client runtime, circular dynamic requires can result in unresolved empty exports or silent execution halting without a thrown exception.
4. **React 19 / Turbopack Hydration Lockup**:
   Differences between server-rendered HTML and client state (due to localStorage reads during render in `sync-bridge.ts`, `SetupContext`, and `AuthContext`) can cause React to halt event delegation entirely.

---

## 5. Unambiguous Recommendation for Next Steps

Given that surgical patches have not restored responsiveness, the following actions are recommended:

1. **Option A: Clean Git Bisect / Hard Rollback to `2ac8a4df`**
   - Stash or branch the Turso/Better Auth implementation into a dedicated branch (e.g., `feature/turso-betterauth-v2`).
   - Roll `master` back to `2ac8a4df` to immediately restore a 100% working, responsive product for all users.
   - Re-introduce Turso and Better Auth incrementally behind an isolated feature flag (`ENABLE_TURSO_MIGRATION=false`), rather than weaving it into the core auth and data paths simultaneously.

2. **Option B: Total Decoupling of Better Auth & Turso from the Client**
   - Remove all references to Turso, Drizzle, Better Auth, and PartyKit from `client.ts`, `AuthContext.tsx`, `NotesContext.tsx`, and `LocalEngine.ts`.
   - Ensure the client runs 100% purely against Appwrite and local IndexedDB as it did a week ago.
   - Restrict Turso/Better Auth strictly to standalone server routes and external CLI tools until client stability is verified in an isolated test environment.

---
*Report filed by Autonomous Agent Antigravity. Pushed to `origin/master`.*
