# Non-Blocking UI Framework Plan

## 1. Objective
Establish a non-blocking execution environment for secondary application tasks, ensuring the main UI thread remains responsive for user interactions.

## 2. Identified Hotspots
- **App Startup/GlobalShell:** Authentication checks, user profile hydration, presence reconciliation, and daily token minting logic.
- **Note/Sidebar Interaction:** Expensive note hydration, credential linking (Flow/Vault), and event-log reconciliation.
- **Topbars/Navigation:** Frequent network polling (session status, ecosystem signals) and complex menu animations triggered by state changes.

## 3. The Pattern: `TaskExecutor`
Create a central execution bridge that delegates tasks away from the main thread using:
- **`requestIdleCallback` (for low-priority UI tasks):** Defer non-critical hydration (e.g., fetching historical activity or auxiliary profile data).
- **Web Workers (for heavy computation):** Move parsing, encryption/decryption, and complex state reconciliation to a background thread.
- **Delegated Promises (for network sequencing):** Ensure initial page load sequence doesn't chain blocking dependencies (e.g., Auth -> Profile -> Billing).

## 4. Migration Plan
1. **Delegation Layer:** Create `lib/services/internal/task-delegator.ts`.
2. **Hook Migration:** Refactor key `useEffect` hooks in `GlobalShell.tsx` and `TaskContext.tsx` to use the `TaskExecutor`.
3. **Sequence Optimization:** Separate critical path UI updates from auxiliary background tasks (e.g., analytics, remote logging, non-visible widget data fetching).
4. **Safety Enforcement:** Use `React.startTransition` for UI-intensive state changes that cannot be fully offloaded.
