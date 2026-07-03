import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  parseTelegramNotificationPreferences,
  resolveTelegramAction,
  shouldDeliverTelegramNotification,
  TELEGRAM_PREFS_KEY,
  type TelegramNotificationAction,
} from '@/lib/telegram/notification-preferences';

export interface TelegramDispatchContext {
  action?: TelegramNotificationAction;
  resourceType?: string | null;
  resourceId?: string | null;
  notificationType?: 'invite' | 'standard';
  title?: string;
}

/**
 * Stage 3: Active Notification Push (Blind Lookup Engine)
 * Attempts to deliver a notification to a target user via Telegram.
 * Silently drops if not linked or verified to preserve privacy.
 */
export async function dispatchTelegramNotification(
  targetUserId: string,
  message: string,
  context?: TelegramDispatchContext
) {
  try {
    const { databases, users } = createSystemClient();

    let userPrefs: Record<string, unknown> = {};
    try {
      const userDoc = await users.get(targetUserId);
      userPrefs = (userDoc.prefs || {}) as Record<string, unknown>;
    } catch {
      return false;
    }

    const preferences = parseTelegramNotificationPreferences(userPrefs[TELEGRAM_PREFS_KEY]);
    const action =
      context?.action ||
      resolveTelegramAction({
        type: context?.notificationType,
        title: context?.title,
        resourceType: context?.resourceType || undefined,
      });

    if (
      !shouldDeliverTelegramNotification(preferences, {
        action,
        resourceType: context?.resourceType,
        resourceId: context?.resourceId,
      })
    ) {
      return false;
    }

    // 1. Blind Lookup matching Target_UserID
    let doc = null;
    try {
      doc = await databases.getRow(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        targetUserId
      );
    } catch (e) {
      // Silently fail/ignore if document doesn't exist to comply with privacy rules
      return false;
    }

    // 2. Assertion check: must exist, be verified, and have a valid chat ID
    if (!doc || !doc.is_verified || !doc.tg_chat_id) {
      return false;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn('[telegram-dispatch] TELEGRAM_BOT_TOKEN is missing. Dispatch aborted.');
      return false;
    }

    // 3. Dispatch directly to Telegram Bot API sendMessage
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: doc.tg_chat_id,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      console.error('[telegram-dispatch] Telegram Bot API returned error:', await res.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('[telegram-dispatch] Silent failure sending notification:', error);
    return false;
  }
}
