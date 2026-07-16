# Real-Time Input RxDB Sync Pattern

## Intent
Implement lag-free, real-time character input mirroring from textareas and inputs directly to local database/cache cards (RxDB/Dexie context layers) without waiting for React rendering queues or debounce windows.

## Problem Context
When using React `useEffect` hooks to mirror raw inputs into shared parent state or local caches (like RxDB), fast keystrokes trigger rapid state transitions. If this is coupled with auto-derivation hooks (e.g. auto-title from content) or background network autosaves, React's asynchronous scheduler delays execution. This causes race conditions, input lag, and drops updates (such as only registering the first character on a list card).

## Architectural Mandate
1. **Direct Event Interception**: Intercept input changes inside the native `<textarea>` or `<input>` element's `onChange` event callback rather than inside a decoupled `useEffect`.
2. **Synchronous Local Dispatch**: Call cache update hooks (e.g. `pushLiveNote`, `setCachedData`, `RxDB.upsert`) synchronously within the event handler.
3. **Decouple Database Sync**: Keep the remote database sync completely asynchronous and decoupled from the typing loop (e.g., only execute database writes upon closing the form, explicit submission, or page change).

## Code Pattern Example

### ❌ Anti-Pattern (Using Decoupled Effects)
```typescript
// Laggy and prone to losing keystrokes
onChange={(e) => setContent(e.target.value)}

useEffect(() => {
  const cardPreview = { id, content };
  pushLiveNote(cardPreview);
}, [content]);
```

### ✅ Clean Pattern (Direct Interception)
```typescript
const handleContentChange = useCallback((nextValue: string) => {
  setContent(nextValue);

  // Synchronously update card cache
  const draftNote = {
    $id: draftId,
    content: nextValue,
    title: resolveNoteCardTitle(title, nextValue),
    $updatedAt: new Date().toISOString(),
  };
  pushLiveNote(draftNote);
  setCachedData(`note_${draftId}`, draftNote);
}, [resolvedNoteId, title, pushLiveNote, setCachedData]);
```
