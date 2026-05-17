import { Client, Account } from 'node-appwrite';
import { cookies } from 'next/headers';
import { APPWRITE_CONFIG } from './appwrite/config';

/**
 * Creates a server-side Appwrite client that respects the user's session.
 * Standardizes on the public endpoint to match browser session domain.
 */
export async function createServerClient(jwt?: string) {
  const client = new Client();
  
  // MUST match the endpoint used by the client SDK to ensure session cookies are valid
  client.setEndpoint(APPWRITE_CONFIG.ENDPOINT);
  client.setProject(APPWRITE_CONFIG.PROJECT_ID);

  if (jwt && jwt.length > 32) {
    client.setJWT(jwt);
    return { client, account: new Account(client) };
  }

  try {
    const cookieStore = await cookies();
    const projectId = APPWRITE_CONFIG.PROJECT_ID;
    
    // Exhaustive search for the project-specific session cookie
    const sessionCookie = 
        cookieStore.get(`a_session_${projectId}`) || 
        cookieStore.get(`a_session_${projectId.toLowerCase()}`) ||
        cookieStore.get('session');

    if (sessionCookie?.value) {
        client.setSession(sessionCookie.value);
    }
  } catch (err) {
    console.warn('[createServerClient] Cookie discovery skipped:', err);
  }

  return {
    client,
    account: new Account(client),
  };
}
