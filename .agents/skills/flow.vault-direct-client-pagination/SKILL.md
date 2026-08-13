---
name: flow.vault-direct-client-pagination
description: Direct Web Client SDK cursor-based fetching for Vault Credentials and TOTP secrets without cache-lock traps.
---

# Vault Direct Client SDK & Cursor Pagination Pattern

## Intent
Ensure snappy, uninterrupted listing and rendering of secure Vault Credentials and TOTP Smart Codes by querying the Appwrite Web Client SDK directly with cursor-based pagination, completely bypassing empty-state cache-lock traps.

## Core Architectural Invariants

### 1. Direct Web Client SDK Fetching
- Query `TablesDB` (from `appwrite` Web Client SDK) directly using `Query.equal('userId', activeUserId)`.
- **Zero Cache Locks**: Bypass intermediate local storage/RxDB locks that return transient empty arrays (`[]`) before remote network completion.
- **Zero Pre-filtering**: Do not run workspace exclusion filters (`useWorkspaceFilteredItems`) on personal secrets/TOTP items.

### 2. Single-Field User Index Querying
- Always use `Query.equal('userId', activeUserId)` as the primary query filter.
- **Never Auto-Inject Compound Filters**: Avoid combining `isPinned` or `isPublic` in compound `Query.and` filters at the database level, as missing/null attribute columns cause Appwrite to drop un-indexed user rows.

### 3. Cursor-Based Pagination Pattern
- Page size ceiling: **50 items** per batch.
- Order by timestamp: `Query.orderDesc('$updatedAt')`.
- Next cursor: `Query.cursorAfter(lastRow.$id)`.
- Append new items to state while deduplicating by `$id` using `new Set(prev.map(c => c.$id))`.

## Reference Implementation
- [page.tsx](file:///home/nathfavour/code/kylrix/kylrix/app/(app)/vault/(protected)/page.tsx)
- [totp/page.tsx](file:///home/nathfavour/code/kylrix/kylrix/app/(app)/vault/(protected)/totp/page.tsx)
- [test/page.tsx](file:///home/nathfavour/code/kylrix/kylrix/app/(app)/vault/(protected)/test/page.tsx)
