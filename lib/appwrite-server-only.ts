import { Client, Account } from 'node-appwrite';
import { cookies } from 'next/headers';
import { APPWRITE_CONFIG } from './appwrite/config';

/**
 * Creates a server-side Appwrite client that respects the user's session.
 * Supports both standard session cookies and explicit JWTs.
 */
export async function createServerClient(customRequest?: Request | string) {
  const client = new Client();
  client.setEndpoint(APPWRITE_CONFIG.ENDPOINT);
  client.setProject(APPWRITE_CONFIG.PROJECT_ID);

  // 1. Handle explicit JWT (string or Request header)
  if (typeof customRequest === 'string' && customRequest.length > 32) {
    client.setJWT(customRequest);
    return { client, account: new Account(client) };
  }

  if (customRequest instanceof Request) {
    const authHeader = customRequest.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      client.setJWT(authHeader.split(' ')[1]);
      return { client, account: new Account(client) };
    }
  }

  // 2. Fallback to session cookies
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Look for ANY cookie that looks like an Appwrite session
    // a_session_[projectId], a_session_[projectId]_legacy, session, etc.
    const sessionCookie = allCookies.find(c => 
        c.name.startsWith('a_session_') || 
        c.name === 'session' ||
        c.name === 'a_session'
    );

    if (sessionCookie?.value) {
        client.setSession(sessionCookie.value);
    }
  } catch (err) {
    console.warn('[createServerClient] Cookie discovery failed:', err);
  }

  return {
    client,
    account: new Account(client),
  };
}
