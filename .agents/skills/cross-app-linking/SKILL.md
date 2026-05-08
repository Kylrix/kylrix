---
name: cross-app-linking
description: Maintains cross-app pointers and metadata links between notes, tasks, calls, and secure objects. Use when connecting features across domain surfaces without duplicating data.
disable-model-invocation: true
---

# Cross-App Linking

## Rules

1. Prefer pointers over copied state.
2. Keep ownership/visibility explicit for linked objects.
3. For secure data, attach references only (never plaintext payloads).
4. Keep source metadata canonical so each surface can hydrate correctly.

