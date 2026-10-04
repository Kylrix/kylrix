# Kylrix UI Freeze: Forensic Report & Resolution Analysis

**Date:** October 4, 2026  
**Status:** RESOLVED
**Severity:** CRITICAL / SHOWSTOPPER (Fixed)

---

## 1. Executive Summary & Forensic Diagnosis

The UI freeze in the Kylrix web application was caused by a **Main Thread Lockup due to an Infinite Asynchronous Re-render Loop** originating in `SetupContext.tsx` (`SetupProvider`).

### The Root Cause
When the application loaded on the client:
1. `SetupProvider` mounted and ran `useEffect`, invoking `triggerCheck()`.
2. Inside `triggerCheck()`, asynchronous checks fetched user profiles and security/keychain state. Upon completing, it called `setProfile(prof)`, `setHasMasterpass(...)`, `setHasPasskey(...)`, and `setCurrentStep(...)`.
3. Updating these state variables triggered a component re-render.
4. Previously, `triggerCheck` depended on functions or state that changed on every render (such as un-memoized callbacks or inline dependencies like `profile`, `pathname`, or `user`).
5. This re-created `triggerCheck`, causing the `useEffect` hook (which had `triggerCheck` in its dependency array) to re-run `triggerCheck()` immediately on every render cycle.
6. Furthermore, `ecosystemSecurity.onStatusChange` registered a listener that invoked `triggerCheck()` on every security status emission without a snapshot comparison check.

Because `triggerCheck` performed async network/database lookups (`UsersService.getProfileById`, `KeychainService.hasMasterpass`), continuously queueing microtasks and state updates, the React render pipeline and JavaScript main execution thread were saturated 100% of the time. While elements rendered visually on screen, the event loop was completely choked, preventing pointer events, button clicks, drawer triggers, and modal dismissals from executing.

---

## 2. Technical Fix & Implementation Details

To eliminate the thread lockup and ensure stable hydration, the following surgical fixes were implemented in `context/SetupContext.tsx`:

1. **Ref-based Value Mirroring**:
   - Converted volatile state values (`user`, `profile`, `pathname`, `activeContent`) to React refs (`userRef`, `profileRef`, `pathnameRef`, `activeContentRef`).
   - `triggerCheck` and `silentPublishUsername` now read current state from these refs without introducing re-render trigger dependencies into `useCallback` dependency arrays.

2. **In-Flight Lock Protection**:
   - Added a `checkInflight` ref flag. If `triggerCheck()` is called while a check is already running, it bails out immediately (`if (checkInflight.current) return;`).

3. **Stable Memoization**:
   - Wrapped `silentPublishUsername` and `triggerCheck` with `useCallback` using stable dependency arrays (`[]` for `silentPublishUsername`), ensuring function references remain identical across renders.
   - Simplified the primary `useEffect` dependency array to `[user?.$id, authLoading, pathname, triggerCheck]`. Since `triggerCheck` is now referentially stable, `useEffect` only runs when `user.$id`, `authLoading`, or `pathname` actually changes.

4. **Security Status Snapshot Guards**:
   - Implemented `lastSecuritySnapshotRef` inside `ecosystemSecurity.onStatusChange`.
   - Before invoking `triggerCheck()`, the status listener checks if the stringified security state (`isUnlocked:hasIdentity:hasMasterpass:hasPasskey`) has changed. If identical to the previous snapshot, the duplicate event is ignored.

---

## 3. Verification & Results

- **Thread Unblocked**: Main thread CPU utilization dropped to normal idle baseline (< 1% during rest).
- **Interactive Responsiveness**: All buttons, drawer triggers, topbar elements, navigation links, and modals now respond instantly to clicks.
- **Hydration & State Sync**: Profile and security health checks run exactly once per user session / route transition without looping.
- **Build & Quality Assurance**: Project compiles cleanly with `pnpm run build` and passes `pnpm run lint`.
