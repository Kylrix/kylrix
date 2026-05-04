import { Permission, Role } from 'appwrite';
import { tablesDB } from './appwrite/client';
import { APPWRITE_CONFIG } from './appwrite/config';

const { DATABASE_ID, TABLES } = APPWRITE_CONFIG;

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
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ],

  /**
   * Get permissions array for a private resource (only owner)
   */
  privateOnly: (userId: string) => [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ],

  /**
   * Get permissions array for unlisted (anyone with link can read, but not discoverable)
   * In Appwrite, this is similar to public but we track it via visibility field
   */
  unlistedRead: (userId: string) => [
    Permission.read(Role.any()),
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ],

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
export const eventPermissions = {
  /**
   * Make an event public (anyone can view)
   */
  makePublic: async (eventId: string, userId: string): Promise<void> => {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.EVENTS,
      rowId: eventId,
      data: { visibility: 'public' },
      permissions: permissions.publicRead(userId),
    });
  },

  /**
   * Make an event private (only owner can view)
   */
  makePrivate: async (eventId: string, userId: string): Promise<void> => {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.EVENTS,
      rowId: eventId,
      data: { visibility: 'private' },
      permissions: permissions.privateOnly(userId),
    });
  },

  /**
   * Make an event unlisted (anyone with link can view)
   */
  makeUnlisted: async (eventId: string, userId: string): Promise<void> => {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.EVENTS,
      rowId: eventId,
      data: { visibility: 'unlisted' },
      permissions: permissions.unlistedRead(userId),
    });
  },

  /**
   * Update event visibility
   */
  setVisibility: async (
    eventId: string,
    visibility: EventVisibility,
    userId: string
  ): Promise<void> => {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.EVENTS,
      rowId: eventId,
      data: { visibility },
      permissions: permissions.forVisibility(visibility, userId),
    });
  },

  /**
   * Check if an event is publicly accessible
   */
  isPublic: (visibility: string | undefined | null): boolean => {
    return visibility === 'public' || visibility === 'unlisted';
  },
};

export default permissions;
