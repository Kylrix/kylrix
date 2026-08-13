---
name: fix.ideas-client-side-pinned-shared-filtering
description: Pattern for simplifying over-engineered database-level pinned and shared filters by fetching clean user lists and applying client-side sorting/filtering.
---

# Fix: Ideas & Vault Client-Side Pinned / Shared Filtering (`fix.ideas-client-side-pinned-shared-filtering`)

## Core Insight & Truth
Database-level compound queries (e.g. `Query.and([Query.equal('userId', id), Query.equal('isPinned', true)])`) fail in Appwrite whenever optional attribute columns (`isPinned`, `isPublic`) are `null` or un-indexed. This causes database queries to drop 90% of valid items.

Instead, the **reliable pattern** established in `/vault` is:
1. **Single-Field Database Query**: Fetch user items directly via single-field owner query `Query.equal('userId', activeUserId)`.
2. **Client-Side Sorting**: Use `useResourcePins` to float pinned items (`isResourcePinned`) to the top of the UI list without database intervention.
3. **Client-Side Metadata Badges**: Render `isPublic` / `isGuest` badges based on document properties rather than partitioning queries at the database layer.

---

## ❌ Over-Engineered Anti-Patterns to Avoid
- **Database Compound Filters**: Do not pass `Query.equal('isPinned', true)` or `Query.equal('isPublic', true)` into `listRows()`.
- **Database Partitioning Thrash**: Do not execute separate backend round-trips for pinned vs unpinned items.

---

## ✅ Canonical Pattern
```typescript
// 1. Fetch clean dataset by owner ID
const items = await listRows(dbId, tableId, [Query.equal('userId', userId), Query.limit(50)]);

// 2. Sort client-side using local pin state
const sortedItems = useMemo(() => {
  return [...items].sort((a, b) => {
    const aPinned = isResourcePinned('kind', a.$id, a.userId, a.isPinned);
    const bPinned = isResourcePinned('kind', b.$id, b.userId, b.isPinned);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime();
  });
}, [items, isResourcePinned]);
```

## Related Skills
- [fix.vault-direct-client-pagination](file:///home/nathfavour/code/kylrix/kylrix/.agents/skills/fix.vault-direct-client-pagination/SKILL.md)
- [note.filtering](file:///home/nathfavour/code/kylrix/kylrix/.agents/skills/note.filtering/SKILL.md)
