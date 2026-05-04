import { account } from './appwrite';

/**
 * Safely delete the current session, handling "no session" errors gracefully
 */
export async function safeDeleteCurrentSession(): Promise<void> {
  try {
    await account.deleteSession('current');
    // Give a moment for the session deletion to propagate
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (_e: unknown) {
    const error = _e as any;
    // Only ignore "session not found" errors, re-throw others
    if (error?.code !== 'user_session_not_found' && !error?.message?.includes('not found')) {
      // silently ignore, session might not exist
    }
  }
}

/**
 * Safely create a session, deleting any existing session first
 * This prevents the "Creation of a session is prohibited when a session is active" error
 */
export async function safeCreateSession(userId: string, secret: string): Promise<void> {
  // Validate inputs
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Invalid userId: must be a non-empty string');
  }
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('Invalid secret: must be a non-empty string');
  }
  
  // First ensure no active session exists
  await safeDeleteCurrentSession();
  
  // Now create the new session
  await account.createSession(
    userId,
    secret
  );
}
