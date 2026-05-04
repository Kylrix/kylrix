import { account } from './appwrite';

/**
 * Checks if a valid Appwrite session exists.
 * This is the single source of truth for session validation across the IDMS.
 * 
 * @returns User object if session is valid, null if no session
 * @throws Error if session check fails unexpectedly
 */
export async function checkSession() {
  try {
    const user = await account.get();
    return user;
  } catch (error: any) {
    // Session doesn't exist or is invalid
    if (error?.code === 'user_unauthorized' || error?.code === 'user_session_not_found') {
      return null;
    }
    // Network or other unexpected errors should be thrown
    throw error;
  }
}

/**
 * Checks if a valid session exists (boolean version)
 * @returns true if session exists and is valid, false otherwise
 */
export async function hasSession(): Promise<boolean> {
  try {
    await account.get();
    return true;
  } catch (error: any) {
    if (error?.code === 'user_unauthorized' || error?.code === 'user_session_not_found') {
      return false;
    }
    throw error;
  }
}
