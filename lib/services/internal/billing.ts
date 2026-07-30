import { createServerClient } from '@/lib/appwrite/server';



export async function getAuthenticatedUserForBillingAction(options?: { jwt?: string | null }) {
  const optJwt = String(options?.jwt || '').trim() || undefined;
  const { account } = await createServerClient(optJwt);
  try {
    return await account.get();
  } catch {
    return null;
  }
}
