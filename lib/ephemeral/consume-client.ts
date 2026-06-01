import { account } from '@/lib/appwrite/client';
import { consumeEphemeralNoteSecure } from '@/lib/actions/secure-ops';

/** Authenticated client → removes ephemeral row after successful import. */
export async function consumeEphemeralRemote(noteId: string, claimSecret: string): Promise<void> {
  try {
    const jwt = await account.createJWT();
    await consumeEphemeralNoteSecure({ noteId, claimSecret }, jwt.jwt);
  } catch (err: any) {
    if (err?.code === 'PRO_REQUIRED') {
      const proErr = new Error(err.message || 'Pro required');
      (proErr as any).code = 'PRO_REQUIRED';
      throw proErr;
    }
    throw new Error(err instanceof Error ? err.message : 'Could not remove ephemeral link.');
  }
}
