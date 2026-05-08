---
name: kylrix-global-hud
description: Handles global activity HUD behavior, unread/read pointers, and transient presence signals. Use for topbar/live activity indicators and ecosystem notification surfaces.
disable-model-invocation: true
---

# Global HUD

## Rules

1. Use durable `activityLog` for history and lightweight activity/presence for transient state.
2. Keep unread/read pointer behavior explicit and deterministic.
3. Avoid leaking private details into global surfaces.
4. Keep UI low-noise; call out only high-value live activity.

