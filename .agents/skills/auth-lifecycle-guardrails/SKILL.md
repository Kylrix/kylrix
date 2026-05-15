---
name: auth-lifecycle-guardrails
description: "Prevents interactivity issues caused by unauthorized background tasks. Use when background services (like cleanup or sync tasks) throw 'Unauthorized' errors on initial page load, causing infinite re-render loops or UI blocking."
---

# Auth-Lifecycle Guardrails

## The Scenario: "Unauthorized" Background Loops

When a background task (e.g., `cleanupStaleCallsSecure`) is triggered during the page lifecycle (in a `useEffect` or `useMemo`), it may run before the Auth context is fully initialized. 

If this background task throws an `Unauthorized` error instead of handling the auth state gracefully, it leads to:
1. **Uncaught Rejection:** The promise fails, triggering an error.
2. **Infinite Re-render:** The error bubble causes the component (or the entire shell) to trigger a re-render/re-mount, which restarts the task.
3. **Deadlocked UI:** The main thread gets saturated with these cycles, causing the page content to become unclickable or "frozen".

## Prevention Checklist

1. **Check Authenticity First:** Before running any secure operation, ensure the `requester` exists.
2. **Graceful Exit:** If not authenticated, exit the background task with a `console.warn` or a "skipped" return value instead of throwing an error.
3. **Load-Time Check:** If a task is triggered by `useEffect` on mount, verify `isLoading` status or wait for the `user` object to be present.

## Pattern Implementation

### Incorrect (Causes re-render loops)
```typescript
export async function runSecureTask() {
  const actor = await getActor();
  if (!actor) throw new Error('Unauthorized'); // ERROR!
  // ... proceed
}
```

### Correct (Resilient)
```typescript
export async function runSecureTask() {
  const actor = await getActor();
  if (!actor) {
    console.warn('[secure-ops] Skipping task: Requester unauthenticated.');
    return { success: false, reason: 'Unauthorized' }; // RETURN EARLY
  }
  // ... proceed
}
```

## Debugging

If the UI feels "dead" or buttons are non-responsive, check for repeated 'Unauthorized' logs in the terminal. If you see those, you have a task that is crashing on load.
