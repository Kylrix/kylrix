'use server';

import { getActor } from '../secure-ops';

/**
 * Server-side check for admin status of the current authenticated user.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function isUserAdmin(): Promise<boolean> {
  const actor = await getActor();
  if (!actor?.$id || !actor.email) {
    return false;
  }
  
  // Private environment variable (not exposed to client)
  const ADMINS = process.env.ADMINS || '';
  const adminList = ADMINS.split(',').map(e => e.trim().toLowerCase());
  
  return adminList.includes(actor.email.toLowerCase());
}
