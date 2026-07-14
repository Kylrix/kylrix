/** Tracks compose-session note IDs that exist in UI but are not yet persisted to Appwrite. */
const unpersistedDraftIds = new Set<string>();

export function markComposeDraft(noteId: string): void {
  const id = String(noteId || '').trim();
  if (!id) return;
  unpersistedDraftIds.add(id);
}

export function markComposePersisted(noteId: string): void {
  const id = String(noteId || '').trim();
  if (!id) return;
  unpersistedDraftIds.delete(id);
}

export function isUnpersistedComposeDraft(noteId?: string | null): boolean {
  const id = String(noteId || '').trim();
  if (!id) return false;
  return unpersistedDraftIds.has(id);
}

/** Legacy live-* drafts plus unpersisted Appwrite-format compose IDs. */
export function isEphemeralComposeNoteId(noteId?: string | null): boolean {
  const id = String(noteId || '').trim();
  if (!id) return false;
  if (id.startsWith('live-')) return true;
  return isUnpersistedComposeDraft(id);
}
