import { Permission, Role, APPWRITE_CONFIG } from '@/lib/data';

const {} = APPWRITE_CONFIG;

/**
 * Permission levels for events
 */
export type EventVisibility = 'public' | 'private' | 'unlisted';

/**
 * Permission helper functions
 */
export const permissions = {
  /**
   * Get permissions array for a public resource (anyone can read)
   */
  publicRead: (userId: string) => [
    Permission.read(Role.any()),
    Permission.read(Role.user(userId))],

  /**
   * Get permissions array for a private resource (only owner)
   */
  privateOnly: (userId: string) => [
    Permission.read(Role.user(userId))],

  /**
   * Get permissions array for unlisted (anyone with link can read, but not discoverable)
   */
  unlistedRead: (userId: string) => [
    Permission.read(Role.any()),
    Permission.read(Role.user(userId))],

  /**
   * Get permissions based on visibility setting
   */
  forVisibility: (visibility: EventVisibility, userId: string) => {
    switch (visibility) {
      case 'public':
        return permissions.publicRead(userId);
      case 'unlisted':
        return permissions.unlistedRead(userId);
      case 'private':
      default:
        return permissions.privateOnly(userId);
    }
  }
};
