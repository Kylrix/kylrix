'use server';

import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Permission, Role, Query } from 'node-appwrite';
import { z } from 'zod';
import { JWTSchema } from '@/lib/validations/schemas';
import {
  TELEGRAM_PREFS_KEY,
  parseTelegramNotificationPreferences,
  type TelegramNotificationPreferences} from '@/lib/telegram/notification-preferences';

/**
 * Stage 1: Initial Connect
 * Generates a pairing code, creates a transient connection row, and returns the deep link.
 */
export async function initializeTelegramConnection(
  jwt?: string,
  forceRegenerate = false,
  appUrl?: string
) {
  // Rigorous runtime validation
  const validatedJwt = JWTSchema.parse(jwt);
  const validatedForce = z.boolean().default(false).parse(forceRegenerate);
  const validatedAppUrl = typeof appUrl === 'string' ? appUrl.trim() : undefined;

  try {
    const { getActor } = await import('./secure-ops');
    const actor = await getActor(validatedJwt);
    if (!actor?.$id) {
      return { success: false, error: 'Unauthorized' };
    }
    const userId = actor.$id;

    // Generate secure 6-digit pairing code
    const pairCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create the system tables client to write with proper terminology rows methods
    const databases = createSystemTablesDB();

    // Check if the record already exists
    let existingDoc = null;
    try {
      existingDoc = await databases.getRow(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId
      );
    } catch (_e) {
      // Document doesn't exist, which is fine
    }

    // If already verified and not forcing a reset, return early with current status
    if (!validatedForce && existingDoc?.is_verified) {
        return {
            success: true,
            isVerified: true,
            tgUsername: existingDoc.tg_username || 'User',
            userId};
    }

    if (!validatedForce && existingDoc && !existingDoc.is_verified && existingDoc.pair_code) {
      const updatedAtTime = new Date(existingDoc.$updatedAt).getTime();
      const nowTime = Date.now();
      const threeMinutesInMs = 3 * 60 * 1000;
      if (nowTime - updatedAtTime < threeMinutesInMs) {
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KylrixBot';
        const deepLink = `https://t.me/${botUsername}?start=${userId}_${existingDoc.pair_code}`;
        
        const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
        if (botToken) {
          syncTelegramBotCommands(validatedJwt, validatedAppUrl).catch(err =>
            console.error('[telegram-bot] Failed to sync bot commands/webhook:', err)
          );
          syncServerTelegramListener().catch(err =>
            console.error('[telegram-bot] Failed to sync listener:', err)
          );
        }

        return {
          success: true,
          pairCode: existingDoc.pair_code,
          deepLink,
          userId,
          createdAt: existingDoc.$updatedAt};
      }
    }

    let updatedDoc;
    if (existingDoc) {
      // Overwrite/update if it exists, resetting pairing state
      updatedDoc = await databases.updateRow(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId,
        {
          pair_code: pairCode,
          is_verified: false,
          tg_chat_id: null,
          tg_username: null}
      );
    } else {
      // Create a new document with the document ID explicitly set to the user ID.
      // Set access control permissions: only read and delete for the resource owner.
      updatedDoc = await databases.createRow(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId,
        {
          pair_code: pairCode,
          is_verified: false},
        [
          Permission.read(Role.user(userId))]
      );
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KylrixBot';
    const deepLink = `https://t.me/${botUsername}?start=${userId}_${pairCode}`;

    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
    if (botToken) {
      syncTelegramBotCommands(validatedJwt, validatedAppUrl).catch(err =>
        console.error('[telegram-bot] Failed to sync bot commands/webhook:', err)
      );
      syncServerTelegramListener().catch(err =>
        console.error('[telegram-bot] Failed to sync listener:', err)
      );
    }

    return {
      success: true,
      pairCode,
      deepLink,
      userId,
      createdAt: updatedDoc.$updatedAt || updatedDoc.$createdAt || new Date().toISOString()};
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
  // Rigorous runtime validation
  const validatedJwt = JWTSchema.parse(jwt);

  try {
    const { getActor } = await import('./secure-ops');
    const actor = await getActor(validatedJwt);
    if (!actor?.$id) {
      return { success: false, error: 'Unauthorized' };
    }
    const userId = actor.$id;

    // 1. Primary Check in Turso
    try {
      const { db } = await import('@/lib/db');
      const { schema } = await import('@/lib/db');
      const { eq } = await import('drizzle-orm');
      const tursoRows = await db
        .select()
        .from(schema.telegramConnections)
        .where(eq(schema.telegramConnections.id, userId))
        .limit(1);

      if (tursoRows.length > 0 && tursoRows[0].isVerified) {
        return {
          success: true,
          isVerified: true,
          tgUsername: tursoRows[0].tgUsername || 'User',
        };
      }
    } catch {}

    const databases = createSystemTablesDB();

    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
    if (botToken) {
      syncServerTelegramListener().catch(err =>
        console.error('[telegram-bot] Failed to sync listener:', err)
      );
    }

    try {
      const doc = await databases.getRow(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId
      );
      if (doc?.is_verified) {
        // Sync to Turso opportunistically
        const { upsertTelegramConnectionTurso } = await import('@/lib/actions/turso-ops');
        await upsertTelegramConnectionTurso({
          id: userId,
          pairCode: doc.pair_code || null,
          tgChatId: doc.tg_chat_id || null,
          tgUsername: doc.tg_username || null,
          isVerified: true,
          createdAt: doc.$createdAt || new Date().toISOString(),
        }).catch(() => {});
      }
      return {
        success: true,
        isVerified: !!doc?.is_verified,
        tgUsername: doc?.tg_username || null};
    } catch (_e: any) {
      // Record not found is not an error, it just means not linked
      return {
        success: true,
        isVerified: false,
        tgUsername: null};
    }
  } catch (error: any) {
    console.error('[telegram] Failed to check connection:', error);
    return { success: false, error: error?.message || 'Failed to check connection' };
  }
}

export async function getTelegramNotificationPreferences(jwt?: string) {
  const validatedJwt = JWTSchema.parse(jwt);

  try {
    const { getActor } = await import('./secure-ops');
    const actor = await getActor(validatedJwt);
    if (!actor?.$id) {
      return { success: false, error: 'Unauthorized' };
    }

    const { users } = createSystemClient();
    const userDoc = await users.get(actor.$id);
    const preferences = parseTelegramNotificationPreferences(
      (userDoc.prefs as Record<string, unknown> | undefined)?.[TELEGRAM_PREFS_KEY]
    );

    return { success: true, preferences };
  } catch (error: any) {
    console.error('[telegram] Failed to load notification preferences:', error);
    return { success: false, error: error?.message || 'Failed to load preferences' };
  }
}

export async function updateTelegramNotificationPreferences(
  jwt: string | undefined,
  preferences: TelegramNotificationPreferences
) {
  const validatedJwt = JWTSchema.parse(jwt);

  try {
    const { getActor } = await import('./secure-ops');
    const actor = await getActor(validatedJwt);
    if (!actor?.$id) {
      return { success: false, error: 'Unauthorized' };
    }

    const { users } = createSystemClient();
    const userDoc = await users.get(actor.$id);
    const currentPrefs = (userDoc.prefs || {}) as Record<string, unknown>;
    const normalized = parseTelegramNotificationPreferences(preferences);

    await users.updatePrefs(actor.$id, {
      ...currentPrefs,
      [TELEGRAM_PREFS_KEY]: normalized});

    return { success: true, preferences: normalized };
  } catch (error: any) {
    console.error('[telegram] Failed to update notification preferences:', error);
    return { success: false, error: error?.message || 'Failed to update preferences' };
  }
}

export async function syncTelegramBotCommands(jwt?: string, appUrl?: string) {
  try {
    const { syncTelegramBot } = await import('@/app/api/telegram/webhook/route');
    return await syncTelegramBot(appUrl);
  } catch (err: any) {
    console.error('[telegram] Failed to sync bot commands:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * ----------------------------------------------------------------------------
 * BACKGROUND DAEMON POLLER FOR TELEGRAM BOT CONNECTIONS
 * ----------------------------------------------------------------------------
 */
let isBotPollerRunning = false;
let lastTelegramUpdateOffset = 0;
let pollerTimeout: NodeJS.Timeout | null = null;

async function syncServerTelegramListener(jwt?: string) {
  if (jwt) {
    const { getActor } = await import('./secure-ops');
    const actor = await getActor(jwt);
    if (!actor?.$id) throw new Error('Unauthorized');
    
    const { isUserAdmin } = await import('./admin/check-admin');
    const isAdmin = await isUserAdmin(jwt);
    if (!isAdmin) throw new Error('Forbidden: admin only');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
  if (!botToken) {
    return;
  }

  if (isBotPollerRunning) {
    return;
  }

  const databases = createSystemTablesDB();

  // Check if there are any active pending (unverified) connections
  try {
    const listRes = await databases.listRows(
      APPWRITE_CONFIG.DATABASES.CONNECT,
      APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
      [Query.equal('is_verified', false)]
    );

    const pendingDocs = listRes.rows.filter(doc => {
      const createdTime = new Date(doc.$updatedAt || doc.$createdAt).getTime();
      const threeMinutesInMs = 3 * 60 * 1000;
      return Date.now() - createdTime < threeMinutesInMs;
    });

    if (pendingDocs.length === 0) {
      if (pollerTimeout) {
        clearTimeout(pollerTimeout);
        pollerTimeout = null;
      }
      isBotPollerRunning = false;
      return;
    }

    // Spin up!
    isBotPollerRunning = true;
    console.log(`[telegram-bot] Spinning up listener daemon for ${pendingDocs.length} pending connection(s)...`);

    // Initialize offset to only get future updates, preventing replay attacks
    try {
      const initRes = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=1&offset=-1`);
      if (initRes.ok) {
        const initData = await initRes.json();
        if (initData.ok && initData.result.length > 0) {
          lastTelegramUpdateOffset = initData.result[0].update_id + 1;
        }
      }
    } catch (err) {
      console.error('[telegram-bot] Failed to initialize update offset:', err);
    }

    // Start loop
    runPollerLoop(botToken);

  } catch (err) {
    console.error('[telegram-bot] Failed in syncServerTelegramListener:', err);
    isBotPollerRunning = false;
  }
}

function runPollerLoop(botToken: string) {
  if (pollerTimeout) {
    clearTimeout(pollerTimeout);
  }

  pollerTimeout = setTimeout(async () => {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastTelegramUpdateOffset}&timeout=5`
      );

      // If a webhook is active, Telegram rejects getUpdates with HTTP 409 Conflict
      if (res.status === 409) {
        console.log('[telegram-bot] Webhook active on Telegram; poller daemon standing down.');
        isBotPollerRunning = false;
        pollerTimeout = null;
        return;
      }

      if (!res.ok) {
        runPollerLoop(botToken);
        return;
      }

      const data = await res.json();
      if (data.ok && data.result.length > 0) {
        const { handleTelegramUpdate } = await import('@/app/api/telegram/webhook/route');

        for (const update of data.result) {
          lastTelegramUpdateOffset = Math.max(lastTelegramUpdateOffset, update.update_id + 1);
          try {
            await handleTelegramUpdate(update);
          } catch (updateErr) {
            console.error('[telegram-bot] Error handling update in poller:', updateErr);
          }
        }
      }

      const databasesInstance = createSystemTablesDB();
      const listRes = await databasesInstance.listRows(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        [Query.equal('is_verified', false)]
      );

      const pendingDocs = listRes.rows.filter(doc => {
        const createdTime = new Date(doc.$updatedAt || doc.$createdAt).getTime();
        const threeMinutesInMs = 3 * 60 * 1000;
        return Date.now() - createdTime < threeMinutesInMs;
      });

      if (pendingDocs.length === 0) {
        console.log('[telegram-bot] Zero active pending connections left. Winding down listener daemon.');
        isBotPollerRunning = false;
        pollerTimeout = null;
      } else {
        runPollerLoop(botToken);
      }

    } catch (err) {
      console.error('[telegram-bot] Error in poller loop:', err);
      runPollerLoop(botToken);
    }
  }, 2000);
}
