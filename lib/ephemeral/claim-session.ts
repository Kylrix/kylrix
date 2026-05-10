const NOTE_ID = 'kylrix_claim_resume_note_id';
const STASH = 'kylrix_claim_resume_stash';

export type ClaimStashKind = 'ghost' | 'send';

export function stashEphemeralClaimResume(noteId: string, kind: ClaimStashKind) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(NOTE_ID, noteId);
  sessionStorage.setItem(STASH, kind);
}

export function peekEphemeralClaimResume(expectedKind: ClaimStashKind): string | null {
  if (typeof window === 'undefined') return null;
  const kind = sessionStorage.getItem(STASH);
  const id = sessionStorage.getItem(NOTE_ID);
  if (!id || kind !== expectedKind) return null;
  return id;
}

export function clearEphemeralClaimResume() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(NOTE_ID);
  sessionStorage.removeItem(STASH);
}

/** @deprecated Prefer peek + clear once UI is ready */
export function takeEphemeralClaimResume(expectedKind: ClaimStashKind): string | null {
  const id = peekEphemeralClaimResume(expectedKind);
  if (id) clearEphemeralClaimResume();
  return id;
}
