'use server';

/**
 * Server-side check for admin status using the private ADMINS environment variable.
 * @param email The user's email to check
 * @returns boolean indicating if the user is an admin
 */
export async function isUserAdmin(email: string): Promise<boolean> {
  if (!email) return false;
  
  // Private environment variable (not exposed to client)
  const ADMINS = process.env.ADMINS || '';
  const adminList = ADMINS.split(',').map(e => e.trim().toLowerCase());
  
  return adminList.includes(email.toLowerCase());
}
