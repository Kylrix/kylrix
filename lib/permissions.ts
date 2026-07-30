import { Permission, Role } from 'appwrite';
import { APPWRITE_CONFIG } from './appwrite/config';

const { DATABASE_ID} = APPWRITE_CONFIG;

/**
 * Permission levels for events
 */
export type EventVisibility = 'public' | 'private' | 'unlisted';

/**
 * Permission helper functions for Appwrite
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
   * In Appwrite, this is similar to public but we track it via visibility field
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
  },
};

/**
 * Event permission management
 */

