import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  parseTelegramNotificationPreferences,
  resolveTelegramAction,
  shouldDeliverTelegramNotification,
  TELEGRAM_PREFS_KEY,
  type TelegramNotificationAction} from '@/lib/telegram/notification-preferences';

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
        resourceType: context?.resourceType || undefined});

    if (
      !shouldDeliverTelegramNotification(preferences, {
        action,
        resourceType: context?.resourceType,
        resourceId: context?.resourceId})
    ) {
      return false;
    }

    // 1. Blind Lookup matching Target_UserID (by row ID or userId field)
    let doc: any = null;
    try {
      doc = await databases.getRow(
        APPWRITE_CONFIG.DATABASES.CONNECT || 'passwordManagerDb',
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS || 'telegram_connections',
        targetUserId
      );
    } catch (_e) {
      // Try list query fallback if rowId != targetUserId
      try {
        const { Query } = await import('node-appwrite');
        const list = await databases.listRows(
          APPWRITE_CONFIG.DATABASES.CONNECT || 'passwordManagerDb',
          APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS || 'telegram_connections',
          [Query.equal('userId', targetUserId), Query.limit(1)]
        );
        if (list.total > 0) doc = list.rows[0];
      } catch (_listErr) {
        return false;
      }
    }

    // 2. Assertion check: must exist, be verified, and have a valid chat ID
    if (!doc || !doc.is_verified || (!doc.tg_chat_id && !doc.chatId)) {
      return false;
    }

    const chatId = doc.tg_chat_id || doc.chatId;

    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
    if (!botToken) {
      console.warn('[telegram-dispatch] TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_API is missing. Dispatch aborted.');
      return false;
    }

    // 3. Dispatch directly to Telegram Bot API sendMessage
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
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
