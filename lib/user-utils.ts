/**
 * User utility functions for profile management
 */

/**
 * Extracts the profile picture ID from a user object
 * Handles different possible property names and null/undefined values
 */
export function getUserProfilePicId(user: any): string | null {
  if (!user) return null;
  
  // Check for common profile picture ID field names
  return (
    user.profilePicId ||
    user.profile_pic_id ||
    user.profilePictureId ||
    user.profile_picture_id ||
    user.avatarId ||
    user.avatar_id ||
    null
  );
}
