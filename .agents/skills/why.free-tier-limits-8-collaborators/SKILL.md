---
name: why.free-tier-limits-8-collaborators
description: Explain why databases, notes, passwords, forms, and TOTPs are completely free and unlimited, but capped at 8 collaborators per resource to avoid undocumented rendering/concurrency bugs.
---

# Why: Free-Tier Collaborator Ceiling & Concurrency Protection

Kylrix offers a generous free tier. Free users can create unlimited notes, vault passwords, forms, and TOTP keys. However, we apply a strict **limit of 8 collaborators per resource** on the free tier.

We enforce this boundary in `lib/actions/secure-ops.ts`.

---

## 1. Protecting Against Concurrency Bugs

When dozens of users edit a single resource (e.g. co-authoring a Note or updating a shared project board) simultaneously, real-time sync systems face intense pressure. 

High concurrency introduces complex engineering challenges:
- Race conditions during real-time operational diffing.
- Network storms as multiple active WebSocket cursors broadcast updates.
- Rendering bugs and state desynchronization in browser DOM trees.

By limiting free-tier resources to **8 collaborators**, we keep real-time editing smooth and prevent complex sync conflicts on standard plans:

```typescript
// Gating note sharing in secure-ops.ts
export async function addNoteCollaboratorSecure(input: ShareNoteInput, jwt: string) {
  const requester = await getActor(jwt);
  const adminTables = createSystemTablesDB();
  
  const note = await adminTables.getRow(NOTE_DB, NOTES_TABLE, input.noteId);
  const meta = parseNoteMetadata(note.metadata);
  
  const currentCollaborators = meta.collaborators ? Object.keys(meta.collaborators) : [];
  
  // Enforce 8 collaborator limit for free tier
  if (currentCollaborators.length >= 8 && !hasPaidKylrixPlan(requester)) {
    throw new Error('Limit reached: Free plan is limited to 8 collaborators per note. Upgrade to PRO for unlimited sharing.');
  }
  
  // Proceed to add collaborator...
}
```

---

## 2. Resource-Linked Gating

This limit is applied only to shared collaborator counts. Free users are never restricted in the number of private documents they can create. This ensures that personal productivity is completely free and unrestricted, while multi-user group editing (which carries higher infrastructure costs) is gated behind our premium tier.
