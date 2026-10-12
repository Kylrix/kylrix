'use server';

import { getActor } from '../secure-ops';

/**
 * Server-side check for admin status of the current authenticated user.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function isUserAdmin(jwt?: string): Promise<boolean> {
  const actor = await getActor(jwt);
  if (!actor?.$id || !actor.email) {
    return false;
  }
  if (actor.isAdmin) return true;
  if (actor.labels && Array.isArray(actor.labels) && actor.labels.includes('admin')) return true;
  
  // Private environment variable (not exposed to client)
  const ADMINS = process.env.ADMINS || '';
  const adminList = ADMINS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  
  return adminList.includes(actor.email.toLowerCase());
}
