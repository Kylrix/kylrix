---
name: calls-realtime
description: Works on call/huddle flows, signaling, activity presence, and call UI behavior across Note, Flow, and Connect surfaces. Use for join/admission/media lifecycle or stale-call cleanup.
disable-model-invocation: true
---

# Calls + Realtime

## Rules

1. Keep one shared call model for direct, group, note, and task huddles.
2. Preserve scoped participant checks for private calls.
3. Keep launcher drawer-first; full call page is opt-in expansion.
4. Keep activity writes minimal and clear stale presence quickly.
5. Expiry/cleanup must be authoritative (server-verified), not cosmetic.

