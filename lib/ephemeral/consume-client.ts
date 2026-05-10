import { account } from '@/lib/appwrite/client';

/** Authenticated client → removes ephemeral row after successful import. */
export async function consumeEphemeralRemote(noteId: string, claimSecret: string): Promise<void> {
  const jwt = await account.createJWT();
  const res = await fetch('/api/ephemeral-note/consume', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt.jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ noteId, claimSecret }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 402) {
    const err = new Error(typeof body.error === 'string' ? body.error : 'Pro required');
    (err as Error & { code?: string }).code = 'PRO_REQUIRED';
    throw err;
  }
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Could not remove ephemeral link.');
  }
}
