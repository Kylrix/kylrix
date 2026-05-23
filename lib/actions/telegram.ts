'use server';

import { createSystemClient } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite-server-only';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Permission, Role } from 'node-appwrite';

/**
 * Stage 1: Initial Connect
 * Generates a pairing code, creates a transient connection row, and returns the deep link.
 */
export async function initializeTelegramConnection(jwt?: string) {
  try {
    const { account } = await createServerClient(jwt);
    const actor = await account.get();
    if (!actor?.$id) {
      return { success: false, error: 'Unauthorized' };
    }
    const userId = actor.$id;

    // Generate secure 6-digit pairing code
    const pairCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create the system client to write with specific row permissions
    const { databases } = createSystemClient();

    // Check if the record already exists
    let existingDoc = null;
    try {
      existingDoc = await databases.getDocument(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId
      );
    } catch (e) {
      // Document doesn't exist, which is fine
    }

    if (existingDoc) {
      // Overwrite/update if it exists, resetting pairing state
      await databases.updateDocument(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId,
        {
          pair_code: pairCode,
          is_verified: false,
          tg_chat_id: null,
          tg_username: null,
        }
      );
    } else {
      // Create a new document with the document ID explicitly set to the user ID.
      // Set access control permissions: only read and delete for the resource owner.
      await databases.createDocument(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId,
        {
          pair_code: pairCode,
          is_verified: false,
        },
        [
          Permission.read(Role.user(userId))]
      );
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KylrixBot';
    const deepLink = `https://t.me/${botUsername}?start=${userId}_${pairCode}`;

    return {
      success: true,
      pairCode,
      deepLink,
    };
  } catch (error: any) {
    console.error('[telegram] Failed to initialize connection:', error);
    return { success: false, error: error?.message || 'Failed to initialize connection' };
  }
}

/**
 * Active status polling helper
 * Checks if the current user's Telegram connection is verified.
 */
export async function checkTelegramConnection(jwt?: string) {
  try {
    const { account } = await createServerClient(jwt);
    const actor = await account.get();
    if (!actor?.$id) {
      return { success: false, error: 'Unauthorized' };
    }
    const userId = actor.$id;

    const { databases } = createSystemClient();
    try {
      const doc = await databases.getDocument(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId
      );
      return {
        success: true,
        isVerified: !!doc?.is_verified,
        tgUsername: doc?.tg_username || null,
      };
    } catch (e: any) {
      // Record not found is not an error, it just means not linked
      return {
        success: true,
        isVerified: false,
        tgUsername: null,
      };
    }
  } catch (error: any) {
    console.error('[telegram] Failed to check connection:', error);
    return { success: false, error: error?.message || 'Failed to check connection' };
  }
}
