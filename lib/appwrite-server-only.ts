import { Client, Account } from 'node-appwrite';
import { cookies } from 'next/headers';
import { APPWRITE_CONFIG } from './appwrite/config';

/**
 * Creates a server-side Appwrite client that respects the user's session.
 * 
 * Hardened for Kylrix:
 * - Uses canonical Cloud endpoint for stable SDK-to-SDK validation.
 * - Supports exhaustive cookie discovery.
 * - Prioritizes explicit JWT for cross-environment reliability.
 */
export async function createServerClient(jwt?: string) {
  const client = new Client();
  
  // Canonical Cloud endpoint is more reliable for server-side session/JWT validation
  // than custom CNAMEs in certain network environments.
  client.setEndpoint('https://fra.cloud.appwrite.io/v1');
  client.setProject(APPWRITE_CONFIG.PROJECT_ID);

  if (jwt && jwt.length > 32) {
    client.setJWT(jwt);
    return { client, account: new Account(client) };
  }

  try {
    const cookieStore = await cookies();
    const projectId = APPWRITE_CONFIG.PROJECT_ID;
    
    // Check all possible Appwrite session cookie keys
    const sessionCookie = 
        cookieStore.get(`a_session_${projectId.toLowerCase()}`) || 
        cookieStore.get(`a_session_${projectId}`) ||
        cookieStore.get('a_session') ||
        cookieStore.get('session');

    if (sessionCookie?.value) {
        client.setSession(sessionCookie.value);
    }
  } catch (err) {
    // Non-request context (e.g. build time or background task)
  }

  return {
    client,
    account: new Account(client),
  };
}
