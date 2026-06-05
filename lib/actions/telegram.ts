'use server';

import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Permission, Role, Query } from 'node-appwrite';

/**
 * Stage 1: Initial Connect
 * Generates a pairing code, creates a transient connection row, and returns the deep link.
 */
export async function initializeTelegramConnection(jwt?: string, forceRegenerate = false) {
  try {
    const { getActor } = await import('./secure-ops');
    const actor = await getActor(jwt);
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
    } catch (e) {
      // Document doesn't exist, which is fine
    }

    // If already verified and not forcing a reset, return early with current status
    if (!forceRegenerate && existingDoc?.is_verified) {
        return {
            success: true,
            isVerified: true,
            tgUsername: existingDoc.tg_username || 'User',
            userId,
        };
    }

    if (!forceRegenerate && existingDoc && !existingDoc.is_verified && existingDoc.pair_code) {
      const updatedAtTime = new Date(existingDoc.$updatedAt).getTime();
      const nowTime = Date.now();
      const threeMinutesInMs = 3 * 60 * 1000;
      if (nowTime - updatedAtTime < threeMinutesInMs) {
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KylrixBot';
        const deepLink = `https://t.me/${botUsername}?start=${userId}_${existingDoc.pair_code}`;
        
        if (process.env.TELEGRAM_BOT_API) {
          syncServerTelegramListener().catch(err =>
            console.error('[telegram-bot] Failed to sync listener:', err)
          );
        }

        return {
          success: true,
          pairCode: existingDoc.pair_code,
          deepLink,
          userId,
          createdAt: existingDoc.$updatedAt,
        };
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
          tg_username: null,
        }
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
          is_verified: false,
        },
        [
          Permission.read(Role.user(userId))]
      );
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KylrixBot';
    const deepLink = `https://t.me/${botUsername}?start=${userId}_${pairCode}`;

    if (process.env.TELEGRAM_BOT_API) {
      syncServerTelegramListener().catch(err =>
        console.error('[telegram-bot] Failed to sync listener:', err)
      );
    }

    return {
      success: true,
      pairCode,
      deepLink,
      userId,
      createdAt: updatedDoc.$updatedAt || updatedDoc.$createdAt || new Date().toISOString(),
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
    const { getActor } = await import('./secure-ops');
    const actor = await getActor(jwt);
    if (!actor?.$id) {
      return { success: false, error: 'Unauthorized' };
    }
    const userId = actor.$id;

    const databases = createSystemTablesDB();

    if (process.env.TELEGRAM_BOT_API) {
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

/**
 * ----------------------------------------------------------------------------
 * BACKGROUND DAEMON POLLER FOR TELEGRAM BOT CONNECTIONS
 * ----------------------------------------------------------------------------
 */
let isBotPollerRunning = false;
let lastTelegramUpdateOffset = 0;
let pollerTimeout: NodeJS.Timeout | null = null;

export async function syncServerTelegramListener(jwt?: string) {
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  
  const { isUserAdmin } = await import('./admin/check-admin');
  const isAdmin = await isUserAdmin(jwt);
  if (!isAdmin) throw new Error('Forbidden: admin only');

  const botToken = process.env.TELEGRAM_BOT_API;
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

      if (!res.ok) {
        runPollerLoop(botToken);
        return;
      }

      const data = await res.json();
      if (data.ok && data.result.length > 0) {
        const databases = createSystemTablesDB();

        for (const update of data.result) {
          lastTelegramUpdateOffset = Math.max(lastTelegramUpdateOffset, update.update_id + 1);

          const message = update.message;
          if (!message || !message.text) continue;

          const text = message.text.trim();
          if (text.startsWith('/start ')) {
            const param = text.slice(7).trim(); // "userId_pairCode"
            const parts = param.split('_');
            if (parts.length === 2) {
              const [userId, pairCode] = parts;

              try {
                const doc = await databases.getRow(
                  APPWRITE_CONFIG.DATABASES.CONNECT,
                  APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
                  userId
                );

                if (doc && !doc.is_verified && doc.pair_code === pairCode) {
                  const createdTime = new Date(doc.$updatedAt || doc.$createdAt).getTime();
                  const threeMinutesInMs = 3 * 60 * 1000;

                  if (Date.now() - createdTime < threeMinutesInMs) {
                    const tgUsername = message.from.username || message.from.first_name || 'User';
                    const chatId = String(message.chat.id);

                    await databases.updateRow(
                      APPWRITE_CONFIG.DATABASES.CONNECT,
                      APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
                      userId,
                      {
                        is_verified: true,
                        tg_username: tgUsername,
                        tg_chat_id: chatId,
                      }
                    );

                    console.log(`[telegram-bot] Successfully verified Telegram connection for user ${userId} as @${tgUsername}`);

                    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: message.chat.id,
                        text: `🎉 Success! Your Telegram account has been paired with Kylrix as @${tgUsername}. Ephemeral secure notifications will be delivered here instantly!`,
                      }),
                    });
                  }
                }
              } catch (docErr) {
                // Ignore document retrieval errors
              }
            }
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
