# Read Optimization Task

## Goal
Reduce Appwrite read volume aggressively across the canonical `kylrix/` app while preserving behavior.

## Constraints
- Do not touch generated Appwrite files.
- Prefer caches, single-flight fetches, indexed reads, and prehydrated route payloads.
- Avoid new API surfaces for in-app flows.
- Do not store decrypted Vault payloads in persistent caches.

## Scan summary
Hot paths repeatedly hit Appwrite in auth/session, profile hydration, keychain/masterpass checks, Connect chat, Note/social feeds, Flow/task state, wallet/billing, search/activity widgets, and server bridge routes.

## Eureka moment
The biggest savings come from collapsing repeated reads of the same small canonical rows: current user, profile rows, keychain presence, conversation base/member data, note previews, and subscription state. Most of the waste is not deep queries; it is the same row being fetched by multiple components during one route lifetime.

## Notes
- Use `cache/read-optimise/TODO.md` as the live backlog for file-specific changes.
- Focus on read coalescing before changing data shape.
- Prefer route-level snapshot hydration over component-level refetches.
