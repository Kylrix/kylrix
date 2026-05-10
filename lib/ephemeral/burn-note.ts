/** Browser → Next route that uses admin Appwrite to delete read-only ghost/Send rows when proof matches. */
export async function burnEphemeralNoteWithProof(noteId: string, deletionSecret: string): Promise<void> {
  const res = await fetch('/api/ephemeral-note/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ noteId, deletionSecret }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Could not burn this link.');
  }
}
