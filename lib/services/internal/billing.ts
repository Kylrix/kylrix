export async function getAuthenticatedUserForBillingAction(_options?: { jwt?: string | null }) {
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
  } catch {}

  return null;
}
