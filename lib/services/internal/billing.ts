import { NextResponse } from 'next/server';
import { Account, Client } from 'node-appwrite';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export async function getAuthenticatedUserForBilling(req: Request) {
  const client = new Client().setEndpoint(APPWRITE_CONFIG.ENDPOINT).setProject(APPWRITE_CONFIG.PROJECT_ID);
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    client.setJWT(authHeader.split(' ')[1]);
  } else {
    const sessionName = `a_session_${APPWRITE_CONFIG.PROJECT_ID.toLowerCase()}`;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(sessionName) || cookieStore.get(`${sessionName}_legacy`);
    if (!sessionCookie) return null;
    client.setSession(sessionCookie.value);
  }

  const account = new Account(client);
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
  const client = new Client().setEndpoint(APPWRITE_CONFIG.ENDPOINT).setProject(APPWRITE_CONFIG.PROJECT_ID);
  const jwt = String(options?.jwt || '').trim();
  if (jwt) {
    client.setJWT(jwt);
    const account = new Account(client);
    try {
      return await account.get();
    } catch {
      // fall through to header/cookie path
    }
  }
  const h = await headers();
  const authHeader = h.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    client.setJWT(authHeader.split(' ')[1]);
  } else {
    const sessionName = `a_session_${APPWRITE_CONFIG.PROJECT_ID.toLowerCase()}`;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(sessionName) || cookieStore.get(`${sessionName}_legacy`);
    if (!sessionCookie) return null;
    client.setSession(sessionCookie.value);
  }

  const account = new Account(client);
  try {
    return await account.get();
  } catch {
    return null;
  }
}
