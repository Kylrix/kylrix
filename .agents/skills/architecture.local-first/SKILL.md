---
name: architecture.local-first
description: >-
  Product-wide local-first invariants (no store names). Use when loading lists,
  merging remote data, or gating UI on account/network.
---

# Local-first architecture

1. **Paint local first.** Lists and details show the live local copy immediately. Never block the first paint on account verify or a network round-trip.
2. **Live copy is content SoT.** Remote pulls *upsert into* local presence. Failed pulls must not wipe a populated live set.
3. **Pending is separate.** Outbound sync status (amber/green) is not the same store as the text the user sees.
4. **Auth is late-binding.** Optimistic user id from last local session is fine for hydration; confirm identity in the background.
5. **Guests still get a local copy.** No-account flows use the same cascade with a guest keyspace.
6. **Detail open ≠ refetch as SoT.** Prefer the live row already in memory; network refresh is background only.

Companion: `sync` (mechanics). UI chrome: `openbricks`, `ui.chrome-surfaces`.
