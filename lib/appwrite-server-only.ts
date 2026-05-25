import { Client, Account } from 'node-appwrite';
import { cookies } from 'next/headers';
import { APPWRITE_CONFIG } from './appwrite/config';
import { cache } from 'react';

/**
 * Creates a server-side Appwrite client that respects the user's session.
 * 
 * Hardened for Kylrix:
 * - Uses canonical Cloud endpoint for stable SDK-to-SDK validation.
 * - Supports exhaustive cookie discovery.
 * - Prioritizes explicit JWT for cross-environment reliability.
 */
export const createServerClient = cache(async (jwt?: string) => {
  const client = new Client();
  
  // Use the primary ecosystem endpoint for session/JWT validation.
  // This ensures compatibility with custom domains and self-hosted instances.
  client.setEndpoint(APPWRITE_CONFIG.ENDPOINT);
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
});
