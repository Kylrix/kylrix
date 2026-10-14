import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface TelegramDispatchContext {
  action?: any;
  resourceType?: string | null;
  resourceId?: string | null;
  notificationType?: 'invite' | 'standard';
  title?: string;
}

export async function dispatchTelegramNotification(
  targetUserId: string,
  message: string,
  _context?: TelegramDispatchContext
) {
  try {
    const rows = await db
      .select()
      .from(schema.telegramConnections)
      .where(eq(schema.telegramConnections.id, targetUserId))
      .limit(1);

    if (rows.length === 0 || !rows[0].isVerified || !rows[0].tgChatId) {
      return false;
    }

    const chatId = rows[0].tgChatId;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
    if (!botToken) return false;

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

    return res.ok;
  } catch (error) {
    console.error('[telegram-dispatch] Failure sending notification:', error);
    return false;
  }
}
