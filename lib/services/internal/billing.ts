import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/appwrite/server';

export async function getAuthenticatedUserForBilling(req: Request) {
  const authHeader = req.headers.get('authorization');
  const jwt = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  
  const { account } = await createServerClient(jwt);
  try {
    return await account.get();
  } catch {
    return null;
  }
}

export function billingAuthErrorResponse() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

export async function getAuthenticatedUserForBillingAction(options?: { jwt?: string | null }) {
  const optJwt = String(options?.jwt || '').trim() || undefined;
  const { account } = await createServerClient(optJwt);
  try {
    return await account.get();
  } catch {
    return null;
  }
}
