import { NextRequest, NextResponse } from 'next/server';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query } from 'node-appwrite';
import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PERSISTENT_REPLY_KEYBOARD = {
  keyboard: [
    [{ text: '📝 Notes' }, { text: '🎯 Goals' }],
    [{ text: '📂 Workspaces' }, { text: '⚙️ Settings' }],
    [{ text: '⚡ Quick Capture' }, { text: '❓ Help' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// Telegram Bot API helpers
async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: any
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
  if (!botToken) {
    console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN is missing');
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
        reply_markup: replyMarkup || PERSISTENT_REPLY_KEYBOARD,
      }),
    });
    if (!res.ok) {
      console.error('[telegram-webhook] Telegram sendMessage error:', await res.text());
    }
  } catch (error) {
    console.error('[telegram-webhook] Failed to invoke sendMessage:', error);
  }
}

async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: any
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
  if (!botToken) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    });
    if (!res.ok) {
      // If message cannot be edited (e.g. content identical or expired), fallback to sendMessage
      await sendTelegramMessage(chatId, text, replyMarkup);
    }
  } catch {
    await sendTelegramMessage(chatId, text, replyMarkup);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  } catch (error) {
    console.error('[telegram-webhook] answerCallbackQuery error:', error);
  }
}

// ── MENU RENDERERS ──

function buildMainMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '📝 Notes', callback_data: 'menu_notes' },
        { text: '🎯 Goals', callback_data: 'menu_goals' },
      ],
      [
        { text: '📂 Workspaces', callback_data: 'menu_workspaces' },
        { text: '⚙️ Settings', callback_data: 'menu_settings' },
      ],
      [
        { text: '⚡ Quick Capture', callback_data: 'notes_new_hint' },
        { text: '🔄 Refresh', callback_data: 'menu_main' },
      ],
    ],
  };
}

function extractItems(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
}

async function renderNotesMenu(actor: ApiActor) {
  try {
    const res = await ApiResources.listNotes(actor, 5);
    const notes = extractItems(res);
    let text = '<b>📝 Kylrix Notes</b>\n\n';

    if (notes.length === 0) {
      text += '<i>No notes found. Create your first note or send any message to quick-capture!</i>\n';
    } else {
      text += 'Your latest notes:\n\n';
      notes.forEach((n, idx) => {
        const preview = n.content ? n.content.replace(/\n/g, ' ').slice(0, 50) : 'Empty body';
        text += `${idx + 1}. <b>${escapeHtml(n.title)}</b>\n`;
        text += `   <i>"${escapeHtml(preview)}"</i>\n`;
        text += `   <code>${n.id}</code>\n\n`;
      });
    }

    const inline_keyboard: any[][] = [];
    notes.slice(0, 3).forEach((n, idx) => {
      inline_keyboard.push([
        { text: `📖 Read #${idx + 1}`, callback_data: `read_note:${n.id}` },
        { text: `🗑️ Delete #${idx + 1}`, callback_data: `del_note:${n.id}` },
      ]);
    });

    inline_keyboard.push([
      { text: '➕ Create Note', callback_data: 'notes_new_hint' },
      { text: '🔄 Refresh', callback_data: 'menu_notes' },
    ]);
    inline_keyboard.push([{ text: '🏠 Main Menu', callback_data: 'menu_main' }]);

    return { text, replyMarkup: { inline_keyboard } };
  } catch (err: any) {
    return {
      text: `❌ Error loading notes: ${escapeHtml(err?.message)}`,
      replyMarkup: {
        inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu_main' }]],
      },
    };
  }
}

async function renderGoalsMenu(actor: ApiActor) {
  try {
    const res = await ApiResources.listGoals(actor, 6);
    const goals = extractItems(res);
    let text = '<b>🎯 Kylrix Goals & Deliverables</b>\n\n';

    if (goals.length === 0) {
      text += '<i>No active goals found. Create one with /goal [title]!</i>\n';
    } else {
      text += 'Your current goals:\n\n';
      goals.forEach((g, idx) => {
        const isDone = g.status === 'completed';
        const icon = isDone ? '✅' : '⏳';
        text += `${idx + 1}. ${icon} <b>${escapeHtml(g.title)}</b>\n`;
        text += `   <code>${g.id}</code>\n\n`;
      });
    }

    const inline_keyboard: any[][] = [];
    goals.slice(0, 4).forEach((g, idx) => {
      const isDone = g.status === 'completed';
      const actionBtn = isDone
        ? { text: `✅ Done #${idx + 1}`, callback_data: 'goals_list' }
        : { text: `✔️ Complete #${idx + 1}`, callback_data: `done_goal:${g.id}` };

      inline_keyboard.push([
        actionBtn,
        { text: `🗑️ Del #${idx + 1}`, callback_data: `del_goal:${g.id}` },
      ]);
    });

    inline_keyboard.push([
      { text: '➕ Create Goal', callback_data: 'goals_new_hint' },
      { text: '🔄 Refresh', callback_data: 'menu_goals' },
    ]);
    inline_keyboard.push([{ text: '🏠 Main Menu', callback_data: 'menu_main' }]);

    return { text, replyMarkup: { inline_keyboard } };
  } catch (err: any) {
    return {
      text: `❌ Error loading goals: ${escapeHtml(err?.message)}`,
      replyMarkup: {
        inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu_main' }]],
      },
    };
  }
}

async function renderWorkspacesMenu(actor: ApiActor) {
  try {
    const res = await ApiResources.listWorkspaces(actor, 5);
    const workspaces = extractItems(res);
    let text = '<b>📂 Sovereign Workspaces</b>\n\n';

    if (workspaces.length === 0) {
      text += '<i>No workspaces found. You are currently in your Personal Workspace.</i>\n\n';
    } else {
      text += 'Your active workspaces:\n\n';
      workspaces.forEach((w, idx) => {
        text += `${idx + 1}. <b>${escapeHtml(w.name)}</b>\n`;
        text += `   <code>${w.id}</code>\n\n`;
      });
    }

    const inline_keyboard = [
      [{ text: '🌐 Open Kylrix Web App', url: 'https://www.kylrix.space/app' }],
      [{ text: '🔄 Refresh', callback_data: 'menu_workspaces' }],
      [{ text: '🏠 Main Menu', callback_data: 'menu_main' }],
    ];

    return { text, replyMarkup: { inline_keyboard } };
  } catch (err: any) {
    return {
      text: `❌ Error loading workspaces: ${escapeHtml(err?.message)}`,
      replyMarkup: {
        inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu_main' }]],
      },
    };
  }
}

async function renderSettingsMenu(actor: ApiActor) {
  try {
    const [profile, billing] = await Promise.all([
      ApiResources.me(actor).catch(() => null),
      ApiResources.getBillingStatus(actor).catch(() => null),
    ]);

    const isPro = Boolean(billing?.active || profile?.quotas?.isPro);
    const tier = billing?.tier || profile?.tier || 'FREE';
    const balance = billing?.balance?.amount ?? 0;
    const symbol = billing?.balance?.symbol || 'KYL';

    const text =
      '<b>⚙️ Kylrix Account & Security Settings</b>\n\n' +
      `👤 <b>User ID:</b> <code>${actor.userId}</code>\n` +
      `🛡️ <b>Subscription Tier:</b> ${isPro ? '⭐ <b>PRO</b>' : `<b>${escapeHtml(tier)}</b>`}\n` +
      `👥 <b>Collaborators Cap:</b> ${profile?.quotas?.maxCollaboratorsPerResource ?? 8} per resource\n` +
      `🪙 <b>Token Balance:</b> <code>${balance} ${symbol}</code>\n` +
      `🔒 <b>Zero-Knowledge Security:</b> Active & Enforced\n` +
      `📱 <b>Telegram Bridge:</b> Connected & Verified\n\n` +
      'All actions from Telegram sync instantly to your cloud and offline-first caches.';

    const inline_keyboard = [
      [{ text: '🌐 Open Web Dashboard', url: 'https://www.kylrix.space/app' }],
      [{ text: '🏠 Main Menu', callback_data: 'menu_main' }],
    ];

    return { text, replyMarkup: { inline_keyboard } };
  } catch (err: any) {
    return {
      text: `❌ Error loading settings: ${escapeHtml(err?.message)}`,
      replyMarkup: {
        inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu_main' }]],
      },
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { databases } = createSystemClient();

    // ── A. HANDLE CALLBACK QUERY (Inline Button Taps) ──
    if (body.callback_query) {
      const cb = body.callback_query;
      const callbackId = cb.id;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const callbackData = (cb.data || '').trim();

      await answerCallbackQuery(callbackId);

      if (!chatId) {
        return NextResponse.json({ success: true });
      }

      // Resolve user account
      const connList = await databases.listRows(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        [
          Query.equal('tg_chat_id', chatId.toString()),
          Query.equal('is_verified', true),
          Query.limit(1),
        ]
      ).catch(() => ({ rows: [] }));

      if (connList.rows.length === 0) {
        await sendTelegramMessage(
          chatId,
          '⚠️ <b>Account Not Connected</b>\n\nPlease pair your Telegram in <a href="https://www.kylrix.space/app">Kylrix Settings</a>.'
        );
        return NextResponse.json({ success: true });
      }

      const userId = connList.rows[0].$id;
      const actor: ApiActor = { userId, kind: 'session', scopes: ['*'] };

      // Dispatch Menu Callbacks
      if (callbackData === 'menu_main') {
        const text =
          '⚡ <b>Kylrix Sovereign Workspace</b>\n\n' +
          'Your decentralized workspace bridge. Choose an option below or send any text for instant quick-capture:';
        await editTelegramMessage(chatId, messageId, text, buildMainMenuMarkup());
        return NextResponse.json({ success: true });
      }

      if (callbackData === 'menu_notes') {
        const { text, replyMarkup } = await renderNotesMenu(actor);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return NextResponse.json({ success: true });
      }

      if (callbackData === 'menu_goals') {
        const { text, replyMarkup } = await renderGoalsMenu(actor);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return NextResponse.json({ success: true });
      }

      if (callbackData === 'menu_workspaces') {
        const { text, replyMarkup } = await renderWorkspacesMenu(actor);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return NextResponse.json({ success: true });
      }

      if (callbackData === 'menu_settings') {
        const { text, replyMarkup } = await renderSettingsMenu(actor);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return NextResponse.json({ success: true });
      }

      if (callbackData === 'notes_new_hint') {
        await sendTelegramMessage(
          chatId,
          '💡 <b>Create Note</b>\n\n' +
          '• Simply type any message to <b>Quick-Capture</b>\n' +
          '• Or use <code>/note Title | Detailed content</code>'
        );
        return NextResponse.json({ success: true });
      }

      if (callbackData === 'goals_new_hint') {
        await sendTelegramMessage(
          chatId,
          '💡 <b>Create Goal</b>\n\nType: <code>/goal Launch Product Feature</code>'
        );
        return NextResponse.json({ success: true });
      }

      // Read Note
      if (callbackData.startsWith('read_note:')) {
        const noteId = callbackData.replace('read_note:', '');
        try {
          const note = await ApiResources.getNote(actor, noteId);
          const text =
            `📝 <b>${escapeHtml(note.title)}</b>\n\n` +
            `${escapeHtml(note.content || '(Empty content)')}\n\n` +
            `<code>ID: ${note.id}</code>`;
          const markup = {
            inline_keyboard: [
              [
                { text: '🗑️ Delete Note', callback_data: `del_note:${note.id}` },
                { text: '🔙 Back to Notes', callback_data: 'menu_notes' },
              ],
            ],
          };
          await editTelegramMessage(chatId, messageId, text, markup);
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ Could not read note: ${escapeHtml(err?.message)}`);
        }
        return NextResponse.json({ success: true });
      }

      // Delete Note
      if (callbackData.startsWith('del_note:')) {
        const noteId = callbackData.replace('del_note:', '');
        try {
          await ApiResources.deleteNote(actor, noteId);
          await editTelegramMessage(
            chatId,
            messageId,
            `🗑️ <b>Note Deleted</b>\n\nNote <code>${noteId}</code> was removed.`,
            {
              inline_keyboard: [[{ text: '🔙 Back to Notes', callback_data: 'menu_notes' }]],
            }
          );
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ Delete failed: ${escapeHtml(err?.message)}`);
        }
        return NextResponse.json({ success: true });
      }

      // Mark Goal Completed
      if (callbackData.startsWith('done_goal:')) {
        const goalId = callbackData.replace('done_goal:', '');
        try {
          const updated = await ApiResources.updateGoal(actor, goalId, { status: 'completed' });
          await editTelegramMessage(
            chatId,
            messageId,
            `✅ <b>Goal Completed!</b>\n\n<b>${escapeHtml(updated.title)}</b> is marked done.`,
            {
              inline_keyboard: [[{ text: '🔙 Back to Goals', callback_data: 'menu_goals' }]],
            }
          );
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ Update failed: ${escapeHtml(err?.message)}`);
        }
        return NextResponse.json({ success: true });
      }

      // Delete Goal
      if (callbackData.startsWith('del_goal:')) {
        const goalId = callbackData.replace('del_goal:', '');
        try {
          await ApiResources.deleteGoal(actor, goalId);
          await editTelegramMessage(
            chatId,
            messageId,
            `🗑️ <b>Goal Deleted</b>\n\nGoal <code>${goalId}</code> was removed.`,
            {
              inline_keyboard: [[{ text: '🔙 Back to Goals', callback_data: 'menu_goals' }]],
            }
          );
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ Delete failed: ${escapeHtml(err?.message)}`);
        }
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ success: true });
    }

    // ── B. HANDLE INCOMING MESSAGE ──
    const message = body.message;
    if (!message) {
      return NextResponse.json({ error: 'Message payload missing' }, { status: 400 });
    }

    const chatId = message.chat?.id;
    const rawText = (message.text || '').trim();
    const tgUsername = message.from?.username || '';

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID missing' }, { status: 400 });
    }

    // 1. Initial Account Pairing Flow (/start [USER_ID]_[PAIR_CODE])
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
          '❌ <b>Pairing Failed</b>\n\nNo active registration request found. Please re-initiate pairing inside the Kylrix web app.'
        );
        return NextResponse.json({ error: 'Connection record not found' }, { status: 404 });
      }

      if (doc.is_verified) {
        await sendTelegramMessage(
          chatId,
          '✅ <b>Already Active</b>\n\nYour account is already linked and verified! Tap below to open your workspace dashboard:',
          buildMainMenuMarkup()
        );
        return NextResponse.json({ success: true, message: 'Already verified' });
      }

      const deltaSeconds = (Date.now() - new Date(doc.$updatedAt).getTime()) / 1000;
      if (deltaSeconds > 180) {
        await sendTelegramMessage(
          chatId,
          '⏳ <b>Pairing Code Expired</b>\n\nPlease re-initiate pairing in Kylrix Settings to get a fresh 3-minute code.'
        );
        return NextResponse.json({ error: 'Pairing window expired' }, { status: 400 });
      }

      if (doc.pair_code !== pairCode) {
        await sendTelegramMessage(
          chatId,
          '❌ <b>Pairing Failed</b>\n\nInvalid pairing code. Please double-check your link.'
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
        'Your Telegram account is now securely linked to Kylrix. Everything you type here seamlessly creates, reads, and updates your sovereign notes and goals.\n\n' +
        'Tap a button below to explore your workspace:',
        buildMainMenuMarkup()
      );

      return NextResponse.json({ success: true, message: 'Verification successful' });
    }

    // 2. Resolve verified user
    const connList = await databases.listRows(
      APPWRITE_CONFIG.DATABASES.CONNECT,
      APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
      [
        Query.equal('tg_chat_id', chatId.toString()),
        Query.equal('is_verified', true),
        Query.limit(1),
      ]
    ).catch(() => ({ rows: [] }));

    if (connList.rows.length === 0) {
      await sendTelegramMessage(
        chatId,
        '👋 <b>Welcome to Kylrix Bot!</b>\n\n' +
        'To connect your account and enable two-way CRUD for notes, tasks, and goals:\n' +
        '1. Open Kylrix at <a href="https://www.kylrix.space/app">www.kylrix.space</a>\n' +
        '2. Go to <b>Settings > Connect > Telegram</b>\n' +
        '3. Tap the pairing link to connect instantly.'
      );
      return NextResponse.json({ success: true, message: 'User not connected' });
    }

    const userId = connList.rows[0].$id;
    const actor: ApiActor = { userId, kind: 'session', scopes: ['*'] };

    // 3. Handle persistent keyboard & commands
    if (rawText === '📝 Notes' || rawText === '/notes') {
      const { text, replyMarkup } = await renderNotesMenu(actor);
      await sendTelegramMessage(chatId, text, replyMarkup);
      return NextResponse.json({ success: true });
    }

    if (rawText === '🎯 Goals' || rawText === '/goals') {
      const { text, replyMarkup } = await renderGoalsMenu(actor);
      await sendTelegramMessage(chatId, text, replyMarkup);
      return NextResponse.json({ success: true });
    }

    if (rawText === '📂 Workspaces' || rawText === '/workspaces') {
      const { text, replyMarkup } = await renderWorkspacesMenu(actor);
      await sendTelegramMessage(chatId, text, replyMarkup);
      return NextResponse.json({ success: true });
    }

    if (rawText === '⚙️ Settings' || rawText === '/settings') {
      const { text, replyMarkup } = await renderSettingsMenu(actor);
      await sendTelegramMessage(chatId, text, replyMarkup);
      return NextResponse.json({ success: true });
    }

    if (rawText === '⚡ Quick Capture') {
      await sendTelegramMessage(
        chatId,
        '⚡ <b>Quick Capture Mode</b>\n\nSimply send any thought, link, or note text and it will immediately save to your Kylrix account!'
      );
      return NextResponse.json({ success: true });
    }

    if (rawText === '❓ Help' || rawText === '/help' || rawText === '/start' || rawText === '/menu') {
      await sendTelegramMessage(
        chatId,
        '⚡ <b>Kylrix Workspace Dashboard</b>\n\n' +
        'Tap any menu below to manage your decentralized workspace:',
        buildMainMenuMarkup()
      );
      return NextResponse.json({ success: true });
    }

    // Specific CRUD slash commands
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
          `<code>ID: ${newNote.id}</code>`,
          {
            inline_keyboard: [
              [
                { text: '📖 Read', callback_data: `read_note:${newNote.id}` },
                { text: '🗑️ Delete', callback_data: `del_note:${newNote.id}` },
              ],
              [{ text: '📋 View Notes', callback_data: 'menu_notes' }],
            ],
          }
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Failed to create note: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

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
          `<code>ID: ${newGoal.id}</code>`,
          {
            inline_keyboard: [
              [
                { text: '✔️ Mark Completed', callback_data: `done_goal:${newGoal.id}` },
                { text: '🗑️ Delete', callback_data: `del_goal:${newGoal.id}` },
              ],
              [{ text: '🎯 View Goals', callback_data: 'menu_goals' }],
            ],
          }
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Failed to create goal: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // Natural text quick-capture
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
          `⚡ <b>Quick Note Captured!</b>\n\n` +
          `<b>Title:</b> ${escapeHtml(quickNote.title)}\n` +
          `<i>"${escapeHtml(rawText.slice(0, 80))}${rawText.length > 80 ? '...' : ''}"</i>\n\n` +
          `<code>ID: ${quickNote.id}</code>`,
          {
            inline_keyboard: [
              [
                { text: '📖 Read', callback_data: `read_note:${quickNote.id}` },
                { text: '🗑️ Delete', callback_data: `del_note:${quickNote.id}` },
              ],
              [{ text: '📋 All Notes', callback_data: 'menu_notes' }],
            ],
          }
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Quick capture failed: ${escapeHtml(err?.message)}`);
      }
      return NextResponse.json({ success: true });
    }

    // Fallback unknown
    await sendTelegramMessage(
      chatId,
      '❓ Unknown command. Tap below to navigate:',
      buildMainMenuMarkup()
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[telegram-webhook] Exception in webhook execution:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
