import { NextRequest, NextResponse } from 'next/server';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

// Helper to send messages back to the user on Telegram
async function sendTelegramMessage(chatId: string | number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
  if (!botToken) {
    console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_API is missing');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.error('[telegram-webhook] Telegram Bot API error:', await res.text());
    }
  } catch (error) {
    console.error('[telegram-webhook] Failed to invoke Bot API sendMessage:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.message) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const message = body.message;
    const chatId = message.chat?.id;
    const text = message.text || '';
    const tgUsername = message.from?.username || '';

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID missing' }, { status: 400 });
    }

    // Match deep link format: /start [USER_ID]_[PAIR_CODE]
    const match = text.match(/^\/start\s+([a-zA-Z0-9_-]+)_([0-9]{6})$/);
    if (!match) {
      // If the user sent some other random text or started the bot without parameter
      if (text.startsWith('/start')) {
        await sendTelegramMessage(
          chatId,
          '👋 <b>Welcome to Kylrix Bot!</b>\n\nTo pair your account, please use the pairing link from your <b>Kylrix settings panel</b>.'
        );
      } else {
        await sendTelegramMessage(
          chatId,
          '💬 <b>Kylrix Assistant</b>\n\nThis bot is configured to deliver secure notifications. To pair or manage connections, visit your account preferences.'
        );
      }
      return NextResponse.json({ success: true, message: 'Invalid start token' });
    }

    const userId = match[1];
    const pairCode = match[2];

    const { databases } = createSystemClient();

    // 1. Retrieve the connection document
    let doc = null;
    try {
      doc = await databases.getRow(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId
      );
    } catch (err: any) {
      console.error('[telegram-webhook] Connection record not found:', err?.message);
    }

    if (!doc) {
      await sendTelegramMessage(
        chatId,
        '❌ <b>Pairing Failed</b>\n\nNo active registration request was found for this user ID. Please re-initiate pairing inside the Kylrix web app.'
      );
      return NextResponse.json({ error: 'Connection record not found' }, { status: 404 });
    }

    // 2. Short-circuit if already verified
    if (doc.is_verified) {
      await sendTelegramMessage(
        chatId,
        '✅ <b>Already Active</b>\n\nYour secure Telegram notifications are already paired and verified.'
      );
      return NextResponse.json({ success: true, message: 'Already verified' });
    }

    // 3. Time Window Validation (3 minutes / 180 seconds limit)
    const updatedAtTime = new Date(doc.$updatedAt).getTime();
    const nowTime = Date.now();
    const deltaSeconds = (nowTime - updatedAtTime) / 1000;

    if (deltaSeconds > 180) {
      await sendTelegramMessage(
        chatId,
        '⏳ <b>Pairing Code Expired</b>\n\nThe pairing session expired. Please re-initiate pairing in the settings panel to generate a new 3-minute verification code.'
      );
      return NextResponse.json({ error: 'Pairing window expired' }, { status: 400 });
    }

    // 4. Verification Check
    if (doc.pair_code !== pairCode) {
      await sendTelegramMessage(
        chatId,
        '❌ <b>Pairing Failed</b>\n\nThe pairing code is invalid. Please double-check your link or generate a new code.'
      );
      return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 });
    }

    // 5. Update Connection Document to verified status
    await databases.updateRow(
      APPWRITE_CONFIG.DATABASES.CONNECT,
      APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
      userId,
      {
        is_verified: true,
        tg_chat_id: chatId.toString(),
        tg_username: tgUsername || null,
        pair_code: null, // Clear the code once verified
      }
    );

    // 6. Send localized success message
    await sendTelegramMessage(
      chatId,
      '🎉 <b>Successfully Paired!</b>\n\nYour account has been securely linked. You will now receive real-time, lightweight push notifications for chat mentions, call dispatches, and idle follow-ups.'
    );

    return NextResponse.json({ success: true, message: 'Verification successful' });
  } catch (error: any) {
    console.error('[telegram-webhook] Exception in webhook execution:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
