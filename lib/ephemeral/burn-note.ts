import { burnEphemeralNoteSecure } from '@/lib/actions/secure-ops';

/** Uses Server Action to delete read-only ghost/Send rows when proof matches. */
export async function burnEphemeralNoteWithProof(noteId: string, deletionSecret: string): Promise<void> {
  try {
    await burnEphemeralNoteSecure({ noteId, deletionSecret });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Could not burn this link.');
  }
}
