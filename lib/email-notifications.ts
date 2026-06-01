import { dispatchEmailSecure } from '@/lib/actions/secure-ops';

export async function sendKylrixEmailNotification(payload: Record<string, unknown>) {
  try {
    return await dispatchEmailSecure(payload);
  } catch (err: any) {
    throw new Error(err.message || 'Failed to queue notification email');
  }
}
