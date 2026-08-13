---
name: fix.vault-direct-client-pagination
description: Post-mortem diagnosis, list of failed attempts, and working first-principles resolution for Vault Credentials and TOTP rendering issues.
---

# Fix: Vault Direct Client SDK & Cursor Pagination (`fix.vault-direct-client-pagination`)

## Problem Overview
Users reported an empty UI state (`No Secrets Found`) in `/vault` and `/vault/totp` despite database inspection confirming 28 credentials and 4 TOTP codes existed with valid `read("user:<userId>")` RLS permissions.

---

## ❌ Comprehensive List of Failed Attempts

1. **Compound Filter Querying (`Query.and([Query.equal('userId', id), Query.equal('isPublic', true)])`)**
   - **Why it failed**: Querying non-indexed or null attribute columns (`isPublic`, `isPinned`) caused Appwrite to drop un-indexed valid rows from database results.

2. **Workspace Exclusion Filtering (`useWorkspaceFilteredItems`)**
   - **Why it failed**: The workspace filter dropped 100% of TOTP items because individual secrets lacked workspace context pointers.

3. **RxDB IndexedDB Cache Lock Layer (`LocalEngine.query`)**
   - **Why it failed**: `LocalEngine.query()` locked the UI on cached empty arrays (`[]`), blocking fresh remote network results from setting React state.

4. **Guest Actor Fallback in Operations**
   - **Why it failed**: Fallback logic created rows assigned to `userId: 'guest'`, corrupting user ownership scoping.

5. **Incorrect SDK Method Invocations**
   - **Why it failed**: Calling `databases.listRows()` directly threw `databases.listRows is not a function` because Web Client SDK requires `TablesDB.listRows()` or `Databases.listDocuments()`.

---

## ✅ What Finally Worked (First-Principles Solution)

1. **Direct Web Client SDK Fetching (`TablesDB.listRows`)**
   - Query `TablesDB` directly using single-field user filter `Query.equal('userId', activeUserId)`.
   - Set raw results straight into React UI state (`setAllCredentials(rows)` and `setTotpCodes(rows)`), bypassing intermediate cache locks.

2. **Cursor-Based Pagination**
   - Default page size: `Query.limit(50)` with `Query.orderDesc('$updatedAt')`.
   - Next cursor pointer: `Query.cursorAfter(lastRow.$id)`.
   - Append new items to state while deduplicating by `$id` via `new Set(prev.map(c => c.$id))`.

---

## Reference Code Files
- [page.tsx](file:///home/nathfavour/code/kylrix/kylrix/app/(app)/vault/(protected)/page.tsx)
- [totp/page.tsx](file:///home/nathfavour/code/kylrix/kylrix/app/(app)/vault/(protected)/totp/page.tsx)
