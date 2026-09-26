import { NextRequest, NextResponse } from 'next/server';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query } from 'node-appwrite';
import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
        disable_web_page_preview: true,
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
    const rawText = (message.text || '').trim();
    const tgUsername = message.from?.username || '';

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID missing' }, { status: 400 });
    }

    const { databases } = createSystemClient();

    // ── 1. ACCOUNT PAIRING FLOW (/start [USER_ID]_[PAIR_CODE]) ──
    const pairMatch = rawText.match(/^\/start\s+([a-zA-Z0-9_-]+)_([0-9]{6})$/);
    if (pairMatch) {
      const userId = pairMatch[1];
      const pairCode = pairMatch[2];

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

      if (doc.is_verified) {
        await sendTelegramMessage(
          chatId,
          '✅ <b>Already Active</b>\n\nYour secure Telegram account is already paired and verified. Type /help to see available commands.'
        );
        return NextResponse.json({ success: true, message: 'Already verified' });
      }

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

      if (doc.pair_code !== pairCode) {
        await sendTelegramMessage(
          chatId,
          '❌ <b>Pairing Failed</b>\n\nThe pairing code is invalid. Please double-check your link or generate a new code.'
        );
        return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 });
      }

      await databases.updateRow(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        userId,
        {
          is_verified: true,
          tg_chat_id: chatId.toString(),
          tg_username: tgUsername || null,
          pair_code: null,
        }
      );

      await sendTelegramMessage(
        chatId,
        '🎉 <b>Successfully Paired!</b>\n\n' +
        'Your account is now linked. You can now manage your account directly from Telegram:\n\n' +
        '• Send any message to <b>Quick-Capture</b> a note\n' +
        '• <code>/notes</code> - List your recent notes\n' +
        '• <code>/note [title] | [content]</code> - Create note\n' +
        '• <code>/goals</code> - List your goals\n' +
        '• <code>/goal [title]</code> - Create goal\n' +
        '• <code>/help</code> - View all commands'
      );

      return NextResponse.json({ success: true, message: 'Verification successful' });
    }

    // ── 2. RESOLVE CONNECTED USER ACCOUNT ──
    let userRow: any = null;
    try {
      const connList = await databases.listRows(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        [
          Query.equal('tg_chat_id', chatId.toString()),
          Query.equal('is_verified', true),
          Query.limit(1),
        ]
      );
      if (connList.rows.length > 0) {
        userRow = connList.rows[0];
      }
    } catch (err: any) {
      console.error('[telegram-webhook] Error resolving Telegram connection:', err?.message);
    }

    if (!userRow) {
      // User not connected yet
      if (rawText.startsWith('/start') || rawText.startsWith('/help')) {
        await sendTelegramMessage(
          chatId,
          '👋 <b>Welcome to Kylrix Bot!</b>\n\n' +
          'To connect your account and enable two-way CRUD for notes, tasks, and goals:\n' +
          '1. Open Kylrix at <a href="https://www.kylrix.space/app">www.kylrix.space</a>\n' +
          '2. Go to <b>Settings > Connect > Telegram</b>\n' +
          '3. Tap the pairing link to connect instantly.'
        );
      } else {
        await sendTelegramMessage(
          chatId,
          '⚠️ <b>Account Not Connected</b>\n\n' +
          'Please pair your Telegram account in <a href="https://www.kylrix.space/app">Kylrix Settings</a> to create and manage notes and goals here.'
        );
      }
      return NextResponse.json({ success: true, message: 'User not connected' });
    }

    const userId = userRow.$id;
    const actor: ApiActor = {
      userId,
      kind: 'session',
      scopes: ['*'],
    };

    // ── 3. BIDIRECTIONAL CRUD COMMAND DISPATCH ──

    // /help or /start
    if (rawText === '/help' || rawText === '/start') {
      await sendTelegramMessage(
        chatId,
        '⚡ <b>Kylrix Telegram Assistant</b>\n\n' +
        '<b>📝 Notes:</b>\n' +
        '• <code>/notes</code> - List your latest notes\n' +
        '• <code>/note [title] | [content]</code> - Create a new note\n' +
        '• <code>/read [noteId]</code> - Read note content\n' +
        '• <code>/deletenote [noteId]</code> - Delete a note\n\n' +
        '<b>🎯 Goals:</b>\n' +
        '• <code>/goals</code> - List your active goals\n' +
        '• <code>/goal [title]</code> - Create a goal\n' +
        '• <code>/done [goalId]</code> - Mark goal as completed\n' +
        '• <code>/deletegoal [goalId]</code> - Delete a goal\n\n' +
        '<b>⚡ Quick Capture:</b>\n' +
        '• Simply type and send any message to immediately capture it as a note!'
      );
      return NextResponse.json({ success: true });
    }

    // /notes (List Notes)
    if (rawText === '/notes' || rawText === '/notes list' || rawText.startsWith('/notes ')) {
      try {
        const notes = await ApiResources.listNotes(actor, { limit: 5 });
        if (!notes.items || notes.items.length === 0) {
          await sendTelegramMessage(
            chatId,
            '📝 <b>No notes found.</b>\n\nSend any message to quick-capture your first note or use <code>/note Title | Body</code>.'
          );
        } else {
          let listMsg = '📝 <b>Your Recent Notes:</b>\n\n';
          notes.items.forEach((n, idx) => {
            const preview = n.content ? n.content.replace(/\n/g, ' ').slice(0, 60) : 'Empty note';
            listMsg += `${idx + 1}. <b>${escapeHtml(n.title)}</b>\n`;
            listMsg += `   <i>"${escapeHtml(preview)}"</i>\n`;
            listMsg += `   <code>/read ${n.id}</code> • <code>/deletenote ${n.id}</code>\n\n`;
          });
          await sendTelegramMessage(chatId, listMsg);
        }
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Failed to list notes: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // /read [noteId]
    if (rawText.startsWith('/read ') || rawText.startsWith('/getnote ')) {
      const noteId = rawText.replace(/^\/(read|getnote)\s+/, '').trim();
      if (!noteId) {
        await sendTelegramMessage(chatId, 'Usage: <code>/read [noteId]</code>');
        return NextResponse.json({ success: true });
      }
      try {
        const note = await ApiResources.getNote(actor, noteId);
        await sendTelegramMessage(
          chatId,
          `📝 <b>${escapeHtml(note.title)}</b>\n\n` +
          `${escapeHtml(note.content || '(Empty body)')}\n\n` +
          `<i>ID: <code>${note.id}</code></i>`
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Could not find note: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // /deletenote [noteId]
    if (rawText.startsWith('/deletenote ') || rawText.startsWith('/rmnote ')) {
      const noteId = rawText.replace(/^\/(deletenote|rmnote)\s+/, '').trim();
      if (!noteId) {
        await sendTelegramMessage(chatId, 'Usage: <code>/deletenote [noteId]</code>');
        return NextResponse.json({ success: true });
      }
      try {
        await ApiResources.deleteNote(actor, noteId);
        await sendTelegramMessage(chatId, `🗑️ <b>Note Deleted</b>\n\nNote <code>${noteId}</code> was removed.`);
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Delete failed: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // /note [title] | [content]
    if (rawText.startsWith('/note ') || rawText.startsWith('/newnote ')) {
      const rawParams = rawText.replace(/^\/(note|newnote)\s+/, '').trim();
      let title = 'Quick Note';
      let content = '';

      if (rawParams.includes('|')) {
        const parts = rawParams.split('|');
        title = parts[0].trim() || 'Quick Note';
        content = parts.slice(1).join('|').trim();
      } else {
        title = rawParams;
      }

      try {
        const newNote = await ApiResources.createNote(actor, { title, content });
        await sendTelegramMessage(
          chatId,
          `✅ <b>Note Created!</b>\n\n` +
          `<b>Title:</b> ${escapeHtml(newNote.title)}\n` +
          (content ? `<b>Body:</b> ${escapeHtml(content)}\n` : '') +
          `<i>ID: <code>${newNote.id}</code></i>`
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Note creation failed: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // /goals or /tasks (List Goals)
    if (rawText === '/goals' || rawText === '/tasks' || rawText.startsWith('/goals ')) {
      try {
        const goals = await ApiResources.listGoals(actor, { limit: 8 });
        if (!goals.items || goals.items.length === 0) {
          await sendTelegramMessage(
            chatId,
            '🎯 <b>No goals found.</b>\n\nCreate a new goal with <code>/goal Launch Feature</code>.'
          );
        } else {
          let listMsg = '🎯 <b>Your Goals:</b>\n\n';
          goals.items.forEach((g, idx) => {
            const isDone = g.status === 'completed';
            const icon = isDone ? '✅' : '⏳';
            listMsg += `${idx + 1}. ${icon} <b>${escapeHtml(g.title)}</b>\n`;
            if (!isDone) {
              listMsg += `   <code>/done ${g.id}</code> • <code>/deletegoal ${g.id}</code>\n\n`;
            } else {
              listMsg += `   <i>Completed</i> • <code>/deletegoal ${g.id}</code>\n\n`;
            }
          });
          await sendTelegramMessage(chatId, listMsg);
        }
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Failed to list goals: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // /goal [title]
    if (rawText.startsWith('/goal ') || rawText.startsWith('/task ')) {
      const title = rawText.replace(/^\/(goal|task)\s+/, '').trim();
      if (!title) {
        await sendTelegramMessage(chatId, 'Usage: <code>/goal [title]</code>');
        return NextResponse.json({ success: true });
      }
      try {
        const newGoal = await ApiResources.createGoal(actor, { title, status: 'todo' });
        await sendTelegramMessage(
          chatId,
          `🎯 <b>Goal Logged!</b>\n\n` +
          `<b>Title:</b> ${escapeHtml(newGoal.title)}\n` +
          `<i>ID: <code>${newGoal.id}</code></i>`
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Goal creation failed: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // /done [goalId]
    if (rawText.startsWith('/done ') || rawText.startsWith('/complete ')) {
      const goalId = rawText.replace(/^\/(done|complete)\s+/, '').trim();
      if (!goalId) {
        await sendTelegramMessage(chatId, 'Usage: <code>/done [goalId]</code>');
        return NextResponse.json({ success: true });
      }
      try {
        const updated = await ApiResources.updateGoal(actor, goalId, { status: 'completed' });
        await sendTelegramMessage(
          chatId,
          `✅ <b>Goal Completed!</b>\n\n` +
          `<b>Title:</b> ${escapeHtml(updated.title)}`
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Failed to update goal: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // /deletegoal [goalId]
    if (rawText.startsWith('/deletegoal ') || rawText.startsWith('/rmgoal ')) {
      const goalId = rawText.replace(/^\/(deletegoal|rmgoal)\s+/, '').trim();
      if (!goalId) {
        await sendTelegramMessage(chatId, 'Usage: <code>/deletegoal [goalId]</code>');
        return NextResponse.json({ success: true });
      }
      try {
        await ApiResources.deleteGoal(actor, goalId);
        await sendTelegramMessage(chatId, `🗑️ <b>Goal Deleted</b>\n\nGoal <code>${goalId}</code> was removed.`);
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Delete failed: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // ── 4. NATURAL TEXT QUICK CAPTURE ──
    // If not a slash command, treat as instant thought / quick note capture
    if (!rawText.startsWith('/')) {
      const firstLine = rawText.split('\n')[0].slice(0, 45).trim();
      const title = firstLine || 'Quick Thought';
      try {
        const quickNote = await ApiResources.createNote(actor, {
          title,
          content: rawText,
        });
        await sendTelegramMessage(
          chatId,
          `⚡ <b>Quick Note Captured</b>\n\n` +
          `<b>Title:</b> ${escapeHtml(quickNote.title)}\n` +
          `<i>"${escapeHtml(rawText.slice(0, 100))}${rawText.length > 100 ? '...' : ''}"</i>\n\n` +
          `Synced to your Kylrix account (<code>${quickNote.id}</code>).`
        );
      } catch (err: any) {
        console.error('[telegram-webhook] Quick capture error:', err);
        await sendTelegramMessage(chatId, `❌ Quick capture failed: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // Fallback unknown command
    await sendTelegramMessage(
      chatId,
      '❓ Unknown command. Type <code>/help</code> for available commands.'
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[telegram-webhook] Exception in webhook execution:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
