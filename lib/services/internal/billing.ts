import { createServerClient } from '@/lib/appwrite/server';

export async function getAuthenticatedUserForBillingAction(options?: { jwt?: string | null }) {
  // 1. Check Better Auth session first
  try {
    const { auth } = await import('@/lib/auth/better-auth');
    const { headers } = await import('next/headers');
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (session?.user?.id) {
      return {
        $id: session.user.id,
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      } as any;
    }
  } catch {
    // fallback
  }

  // 2. Secondary fallback via Appwrite
  const optJwt = String(options?.jwt || '').trim() || undefined;
  const { account } = await createServerClient(optJwt);
  try {
    return await account.get();
  } catch {
    return null;
  }
}
