---
name: flow.drafts-autosave-recovery
description: Deep dive into the localized form drafts autosave and manifest tracking in Kylrix. Explains the uncommitted state persistence, metadata segregation, and storage resets.
---

# Why: Localized Draft Autosaves & Manifest Isolation

When building complex forms, workflows, or long documents, network disruptions or accidental page refreshes can cause users to lose their work. Saving every keystroke directly to database servers creates unnecessary network traffic and database writes.

We solve this using a localized **Drafts Autosave Service** in `lib/services/drafts.ts`.

## 1. Segregated Manifest & Content Pattern

To keep the application fast, we separate the draft content from its metadata:
- **`manifest`** (`kylrix_flow_drafts_manifest`): A lightweight map containing only the title, ID, and update time of all active drafts.
- **`content`** (`kylrix_flow_draft_id`): The full JSON object containing fields, values, and settings.

```typescript
// Save content under a unique, isolated key
localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(draft));

// Save lightweight metadata in the main manifest
const manifest = this.getManifest();
manifest[id] = {
    title: draft.title || 'Untitled Portal',
    updatedAt: draft.updatedAt
};
localStorage.setItem(METADATA_KEY, JSON.stringify(manifest));
```

This ensures the UI can check for draft states in milliseconds without loading heavy content into memory.

## 2. Server-Side Guarding (Universal SSR Safety)

Because `localStorage` is only available in the browser, calling it during server-side rendering (SSR) in Next.js will crash the application. We protect against this by enforcing explicit runtime environment guards:

```typescript
if (typeof window === 'undefined') return;
```

This allows components to import the Drafts Service safely on both client and server pages.

## 3. Atomic Pruning and Cleanup

When a user submits a form or discards a draft, we clean up the storage to save space:

```typescript
clearDraft(id: string) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
    const manifest = this.getManifest();
    delete manifest[id];
    localStorage.setItem(METADATA_KEY, JSON.stringify(manifest));
}
```

This prevents orphaned drafts from polluting browser memory over time.
