import { dispatchEmailSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';

export async function sendKylrixEmailNotification(payload: Record<string, unknown>) {
  try {
    let jwt: string | undefined;
    if (typeof window !== 'undefined') {
      try {
        const res = await account.createJWT();
        jwt = res.jwt;
      } catch (e) {
        console.warn('[email-notifications] Failed to generate JWT:', e);
      }
    }
    return await dispatchEmailSecure(payload, jwt);
  } catch (err: any) {
    throw new Error(err.message || 'Failed to queue notification email');
  }
}

