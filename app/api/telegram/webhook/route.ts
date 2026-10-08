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
    [{ text: '💡 Ideas' }, { text: '🎯 Goals' }],
    [{ text: '🔍 Search' }, { text: '⚡ Quick Capture' }],
    [{ text: '📂 Workspaces' }, { text: '⚙️ Settings' }],
    [{ text: '❓ Menu' }],
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
        { text: '💡 Ideas', callback_data: 'menu_notes' },
        { text: '🎯 Goals', callback_data: 'menu_goals' },
      ],
      [
        { text: '🔍 Search', callback_data: 'search_hint' },
        { text: '⚡ Quick Capture', callback_data: 'notes_new_hint' },
      ],
      [
        { text: '📂 Workspaces', callback_data: 'menu_workspaces' },
        { text: '⚙️ Settings', callback_data: 'menu_settings' },
      ],
      [
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

export const telegramActiveWorkspaceCache = new Map<string, { id: string; name: string }>();

export function getTelegramActiveWorkspace(chatId: string | number): { id: string; name: string } | null {
  return telegramActiveWorkspaceCache.get(String(chatId)) || null;
}

export function setTelegramActiveWorkspace(chatId: string | number, workspace: { id: string; name: string } | null) {
  if (!workspace || workspace.id === 'personal' || workspace.id === 'default') {
    telegramActiveWorkspaceCache.delete(String(chatId));
  } else {
    telegramActiveWorkspaceCache.set(String(chatId), workspace);
  }
}

async function renderNotesMenu(actor: ApiActor, chatId?: string | number) {
  try {
    const activeWs = chatId ? getTelegramActiveWorkspace(chatId) : null;
    const res = await ApiResources.listNotes(actor, 6);
    const allNotes = extractItems(res);
    const notes = activeWs ? allNotes.filter((n: any) => n.projectId === activeWs.id || n.workspaceId === activeWs.id) : allNotes;
    
    let text = `<b>💡 Kylrix Ideas</b> ${activeWs ? `(📁 ${escapeHtml(activeWs.name)})` : ''}\n\n`;

    if (notes.length === 0) {
      text += '<i>No ideas found in this workspace. Send any message to quick-capture, or use /idea [title]!</i>\n';
    } else {
      text += 'Your latest ideas:\n\n';
      notes.forEach((n, idx) => {
        const preview = n.content ? n.content.replace(/\n/g, ' ').slice(0, 50) : 'Empty body';
        text += `${idx + 1}. <b>${escapeHtml(n.title || 'Untitled Idea')}</b>\n`;
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
      { text: '➕ Create Idea', callback_data: 'notes_new_hint' },
      { text: '🔄 Refresh', callback_data: 'menu_notes' },
    ]);
    inline_keyboard.push([{ text: '🏠 Main Menu', callback_data: 'menu_main' }]);

    return { text, replyMarkup: { inline_keyboard } };
  } catch (err: any) {
    return {
      text: `❌ Error loading ideas: ${escapeHtml(err?.message)}`,
      replyMarkup: {
        inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu_main' }]],
      },
    };
  }
}

async function renderGoalsMenu(actor: ApiActor, chatId?: string | number) {
  try {
    const activeWs = chatId ? getTelegramActiveWorkspace(chatId) : null;
    const res = await ApiResources.listGoals(actor, 6);
    const allGoals = extractItems(res);
    const goals = activeWs ? allGoals.filter((g: any) => g.projectId === activeWs.id || g.workspaceId === activeWs.id) : allGoals;
    let text = `<b>🎯 Kylrix Goals & Deliverables</b> ${activeWs ? `(📁 ${escapeHtml(activeWs.name)})` : ''}\n\n`;

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

async function renderWorkspacesMenu(actor: ApiActor, chatId?: string | number) {
  try {
    const activeWs = chatId ? getTelegramActiveWorkspace(chatId) : null;
    const res = await ApiResources.listWorkspaces(actor, 10);
    const workspaces = extractItems(res);
    let text = '<b>📂 Sovereign Workspaces</b>\n\n';

    text += `Active Target: ${activeWs ? `🟢 <b>${escapeHtml(activeWs.name)}</b>` : '🟢 <b>Personal Workspace</b>'}\n\n`;

    if (workspaces.length === 0) {
      text += '<i>No custom workspaces found. You are currently in your Personal Workspace.</i>\n\n';
    } else {
      text += 'Tap below to switch active workspace for your Telegram session:\n\n';
      workspaces.forEach((w, idx) => {
        const isCurrent = activeWs?.id === w.id;
        text += `${idx + 1}. ${isCurrent ? '🟢' : '📁'} <b>${escapeHtml(w.name)}</b>\n`;
        text += `   <code>${w.id}</code>\n\n`;
      });
    }

    const inline_keyboard: any[][] = [];

    // Switch buttons for workspaces
    workspaces.forEach((w) => {
      const isCurrent = activeWs?.id === w.id;
      inline_keyboard.push([
        {
          text: `${isCurrent ? '🟢 ' : '📁 '} ${escapeHtml(w.name).slice(0, 25)}`,
          callback_data: `switch_ws:${w.id}`,
        },
      ]);
    });

    // Personal Workspace option
    inline_keyboard.push([
      {
        text: `${!activeWs ? '🟢 ' : '👤 '} Personal Workspace`,
        callback_data: 'switch_ws:personal',
      },
    ]);

    inline_keyboard.push([
      { text: '🌐 Web App', url: 'https://www.kylrix.space/app' },
      { text: '🔄 Refresh', callback_data: 'menu_workspaces' },
    ]);
    inline_keyboard.push([{ text: '🏠 Main Menu', callback_data: 'menu_main' }]);

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

export const TELEGRAM_BOT_COMMANDS = [
  { command: 'menu', description: 'Open interactive workspace menu' },
  { command: 'ideas', description: 'View and manage your ideas' },
  { command: 'idea', description: 'Create idea: /idea Title | Content' },
  { command: 'goals', description: 'View and track your goals' },
  { command: 'goal', description: 'Create goal: /goal Title' },
  { command: 'search', description: 'Search items: /search <keyword>' },
  { command: 'workspaces', description: 'List and switch workspaces' },
  { command: 'switch', description: 'Switch workspace: /switch <name or id>' },
  { command: 'settings', description: 'Notification settings and status' },
  { command: 'help', description: 'Open dashboard and quick menu' },
];

export async function syncTelegramBot(appUrl?: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
  if (!botToken) {
    return { success: false, error: 'Telegram bot token is not configured' };
  }

  // 1. Sync bot commands with Telegram Bot API
  let commandsSynced = false;
  try {
    const cmdRes = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: TELEGRAM_BOT_COMMANDS }),
    });
    const cmdJson = await cmdRes.json().catch(() => ({}));
    commandsSynced = !!cmdJson.ok;
    if (!commandsSynced) {
      console.warn('[telegram-webhook] Failed to setMyCommands:', cmdJson);
    }
  } catch (err: any) {
    console.error('[telegram-webhook] Failed to setMyCommands:', err);
  }

  // 2. Set webhook if a public HTTPS URL is provided or configured
  let webhookResult: { configured: boolean; url?: string; error?: string } = { configured: false };
  const targetUrl = (appUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim();

  if (targetUrl.startsWith('https://')) {
    const cleanUrl = targetUrl.replace(/\/+$/, '');
    const webhookUrl = `${cleanUrl}/api/telegram/webhook`;
    try {
      const whRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        }),
      });
      const whJson = await whRes.json().catch(() => ({}));
      if (whJson.ok) {
        webhookResult = { configured: true, url: webhookUrl };
      } else {
        webhookResult = { configured: false, error: whJson.description || 'Failed to set webhook' };
      }
    } catch (err: any) {
      webhookResult = { configured: false, error: err?.message };
    }
  }

  return {
    success: commandsSynced,
    commandsSynced,
    webhook: webhookResult,
  };
}

export async function handleTelegramUpdate(body: any): Promise<{
  success: boolean;
  status?: number;
  error?: string;
  message?: string;
}> {
  try {
    if (!body || (!body.message && !body.callback_query)) {
      return { success: false, status: 400, error: 'Invalid payload or message missing' };
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
        return { success: true };
      }

      // Resolve user account
      const connList = await databases
        .listRows(
          APPWRITE_CONFIG.DATABASES.CONNECT,
          APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
          [
            Query.equal('tg_chat_id', chatId.toString()),
            Query.equal('is_verified', true),
            Query.limit(1),
          ]
        )
        .catch(() => ({ rows: [] }));

      if (connList.rows.length === 0) {
        await sendTelegramMessage(
          chatId,
          '⚠️ <b>Account Not Connected</b>\n\nPlease pair your Telegram in <a href="https://www.kylrix.space/app">Kylrix Settings</a>.'
        );
        return { success: true };
      }

      const userId = connList.rows[0].$id;
      const actor: ApiActor = { userId, kind: 'session', scopes: ['*'] };

      // Dispatch Menu Callbacks
      if (callbackData === 'menu_main') {
        const text =
          '⚡ <b>Kylrix Sovereign Workspace</b>\n\n' +
          'Your decentralized workspace bridge. Choose an option below or send any text for instant quick-capture:';
        await editTelegramMessage(chatId, messageId, text, buildMainMenuMarkup());
        return { success: true };
      }

      if (callbackData === 'menu_notes') {
        const { text, replyMarkup } = await renderNotesMenu(actor, chatId);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return { success: true };
      }

      if (callbackData === 'menu_goals') {
        const { text, replyMarkup } = await renderGoalsMenu(actor, chatId);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return { success: true };
      }

      if (callbackData === 'menu_workspaces') {
        const { text, replyMarkup } = await renderWorkspacesMenu(actor, chatId);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return { success: true };
      }

      if (callbackData.startsWith('switch_ws:')) {
        const target = callbackData.replace('switch_ws:', '');
        if (target === 'personal') {
          setTelegramActiveWorkspace(chatId, null);
          await answerCallbackQuery(callbackId, 'Switched to Personal Workspace');
        } else {
          try {
            const ws = await ApiResources.getWorkspace(actor, target);
            setTelegramActiveWorkspace(chatId, { id: ws.id, name: ws.name || 'Workspace' });
            await answerCallbackQuery(callbackId, `Switched to ${ws.name || 'Workspace'}`);
          } catch (err: any) {
            await answerCallbackQuery(callbackId, `Switch failed: ${err?.message || 'Workspace not found'}`);
          }
        }
        const { text, replyMarkup } = await renderWorkspacesMenu(actor, chatId);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return { success: true };
      }

      if (callbackData === 'menu_settings') {
        const { text, replyMarkup } = await renderSettingsMenu(actor);
        await editTelegramMessage(chatId, messageId, text, replyMarkup);
        return { success: true };
      }

      if (callbackData === 'search_hint') {
        await sendTelegramMessage(
          chatId,
          '🔍 <b>Search Workspace</b>\n\nType: <code>/search &lt;keyword&gt;</code> to find matching ideas and goals.'
        );
        return { success: true };
      }

      if (callbackData === 'notes_new_hint') {
        await sendTelegramMessage(
          chatId,
          '💡 <b>Create Idea</b>\n\n' +
            '• Simply type any message to <b>Quick-Capture</b>\n' +
            '• Or use <code>/idea Title | Detailed content</code>'
        );
        return { success: true };
      }

      if (callbackData === 'goals_new_hint') {
        await sendTelegramMessage(
          chatId,
          '💡 <b>Create Goal</b>\n\nType: <code>/goal Launch Product Feature</code>'
        );
        return { success: true };
      }

      // Read Note / Idea
      if (callbackData.startsWith('read_note:')) {
        const noteId = callbackData.replace('read_note:', '');
        try {
          const note = await ApiResources.getNote(actor, noteId);
          const text =
            `💡 <b>${escapeHtml(note.title)}</b>\n\n` +
            `${escapeHtml(note.content || '(Empty content)')}\n\n` +
            `<code>ID: ${note.id}</code>`;
          const markup = {
            inline_keyboard: [
              [
                { text: '🗑️ Delete Idea', callback_data: `del_note:${note.id}` },
                { text: '🔙 Back to Ideas', callback_data: 'menu_notes' },
              ],
            ],
          };
          await editTelegramMessage(chatId, messageId, text, markup);
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ Could not read idea: ${escapeHtml(err?.message)}`);
        }
        return { success: true };
      }

      // Delete Note / Idea
      if (callbackData.startsWith('del_note:')) {
        const noteId = callbackData.replace('del_note:', '');
        try {
          await ApiResources.deleteNote(actor, noteId);
          await editTelegramMessage(
            chatId,
            messageId,
            `🗑️ <b>Idea Deleted</b>\n\nIdea <code>${noteId}</code> was removed.`,
            {
              inline_keyboard: [[{ text: '🔙 Back to Ideas', callback_data: 'menu_notes' }]],
            }
          );
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ Delete failed: ${escapeHtml(err?.message)}`);
        }
        return { success: true };
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
        return { success: true };
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
        return { success: true };
      }

      return { success: true };
    }

    // ── B. HANDLE INCOMING MESSAGE ──
    const message = body.message;
    if (!message) {
      return { success: false, status: 400, error: 'Message payload missing' };
    }

    const chatId = message.chat?.id;
    const rawText = (message.text || '').trim();
    const tgUsername = message.from?.username || '';

    if (!chatId) {
      return { success: false, status: 400, error: 'Chat ID missing' };
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
        return { success: false, status: 404, error: 'Connection record not found' };
      }

      if (doc.is_verified) {
        await sendTelegramMessage(
          chatId,
          '✅ <b>Already Active</b>\n\nYour account is already linked and verified! Tap below to open your workspace dashboard:',
          buildMainMenuMarkup()
        );
        return { success: true, message: 'Already verified' };
      }

      const deltaSeconds = (Date.now() - new Date(doc.$updatedAt).getTime()) / 1000;
      if (deltaSeconds > 180) {
        await sendTelegramMessage(
          chatId,
          '⏳ <b>Pairing Code Expired</b>\n\nPlease re-initiate pairing in Kylrix Settings to get a fresh 3-minute code.'
        );
        return { success: false, status: 400, error: 'Pairing window expired' };
      }

      if (doc.pair_code !== pairCode) {
        await sendTelegramMessage(
          chatId,
          '❌ <b>Pairing Failed</b>\n\nInvalid pairing code. Please double-check your link.'
        );
        return { success: false, status: 400, error: 'Invalid pairing code' };
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

      return { success: true, message: 'Verification successful' };
    }

    // 2. Resolve verified user
    const connList = await databases
      .listRows(
        APPWRITE_CONFIG.DATABASES.CONNECT,
        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
        [
          Query.equal('tg_chat_id', chatId.toString()),
          Query.equal('is_verified', true),
          Query.limit(1),
        ]
      )
      .catch(() => ({ rows: [] }));

    if (connList.rows.length === 0) {
      await sendTelegramMessage(
        chatId,
        '👋 <b>Welcome to Kylrix Bot!</b>\n\n' +
          'To connect your account and enable two-way CRUD for notes, tasks, and goals:\n' +
          '1. Open Kylrix at <a href="https://www.kylrix.space/app">www.kylrix.space</a>\n' +
          '2. Go to <b>Settings > Connect > Telegram</b>\n' +
          '3. Tap the pairing link to connect instantly.'
      );
      return { success: true, message: 'User not connected' };
    }

    const userId = connList.rows[0].$id;
    const actor: ApiActor = { userId, kind: 'session', scopes: ['*'] };

    // 3. Handle persistent keyboard & commands
    if (
      rawText === '💡 Ideas' ||
      rawText === '📝 Notes' ||
      rawText === '/notes' ||
      rawText === '/note' ||
      rawText === '/ideas' ||
      rawText === '/idea' ||
      rawText === '/newnote' ||
      rawText === '/newidea'
    ) {
      const { text, replyMarkup } = await renderNotesMenu(actor, chatId);
      await sendTelegramMessage(chatId, text, replyMarkup);
      return { success: true };
    }

    if (
      rawText === '🎯 Goals' ||
      rawText === '/goals' ||
      rawText === '/goal' ||
      rawText === '/tasks' ||
      rawText === '/task' ||
      rawText === '/newgoal' ||
      rawText === '/newtask'
    ) {
      const { text, replyMarkup } = await renderGoalsMenu(actor, chatId);
      await sendTelegramMessage(chatId, text, replyMarkup);
      return { success: true };
    }

    if (
      rawText === '📂 Workspaces' ||
      rawText === '/workspaces' ||
      rawText === '/workspace' ||
      rawText === '/ws'
    ) {
      const { text, replyMarkup } = await renderWorkspacesMenu(actor, chatId);
      await sendTelegramMessage(chatId, text, replyMarkup);
      return { success: true };
    }

    if (
      rawText.startsWith('/switch ') ||
      rawText.startsWith('/workspace switch ') ||
      rawText.startsWith('/ws switch ') ||
      rawText.startsWith('/ws ')
    ) {
      const query = rawText
        .replace(/^\/(switch|workspace switch|ws switch|ws)\s+/, '')
        .trim();

      if (!query || query.toLowerCase() === 'personal' || query.toLowerCase() === 'default') {
        setTelegramActiveWorkspace(chatId, null);
        await sendTelegramMessage(
          chatId,
          '🟢 <b>Switched to Personal Workspace</b>\n\nAll ideas and goals will now be saved in your personal workspace.'
        );
        return { success: true };
      }

      try {
        const res = await ApiResources.listWorkspaces(actor, 50);
        const workspaces = extractItems(res);
        const qLower = query.toLowerCase();
        const matched = workspaces.find(
          (w: any) =>
            w.id === query ||
            (w.name && w.name.toLowerCase() === qLower) ||
            (w.name && w.name.toLowerCase().includes(qLower))
        );

        if (matched) {
          setTelegramActiveWorkspace(chatId, { id: matched.id, name: matched.name });
          await sendTelegramMessage(
            chatId,
            `🟢 <b>Switched to Workspace:</b> 📁 <b>${escapeHtml(matched.name)}</b>\n\nAll subsequent ideas and goals will be saved to this workspace.`
          );
        } else {
          await sendTelegramMessage(
            chatId,
            `❌ Workspace "<b>${escapeHtml(query)}</b>" not found.\n\nUse /workspaces to see available workspaces.`
          );
        }
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Failed to switch workspace: ${escapeHtml(err?.message)}`);
      }
      return { success: true };
    }

    if (rawText === '⚙️ Settings' || rawText === '/settings') {
      const { text, replyMarkup } = await renderSettingsMenu(actor);
      await sendTelegramMessage(chatId, text, replyMarkup);
      return { success: true };
    }

    if (rawText === '⚡ Quick Capture') {
      const activeWs = getTelegramActiveWorkspace(chatId);
      await sendTelegramMessage(
        chatId,
        `⚡ <b>Quick Capture Mode</b> ${activeWs ? `(📁 ${escapeHtml(activeWs.name)})` : ''}\n\n` +
          'Simply send any thought, link, or note text and it will immediately save to your Kylrix workspace!'
      );
      return { success: true };
    }

    if (rawText === '❓ Help' || rawText === '❓ Menu' || rawText === '/help' || rawText === '/start' || rawText === '/menu') {
      await sendTelegramMessage(
        chatId,
        '⚡ <b>Kylrix Workspace Dashboard</b>\n\n' +
          'Tap any menu below to manage your decentralized workspace:',
        buildMainMenuMarkup()
      );
      return { success: true };
    }

    // Search command or keyboard tap
    if (rawText === '🔍 Search' || rawText === '/search') {
      await sendTelegramMessage(
        chatId,
        '🔍 <b>Search Workspace</b>\n\nType <code>/search &lt;keyword&gt;</code> to find any idea, goal, or deliverable.'
      );
      return { success: true };
    }

    if (rawText.startsWith('/search ')) {
      const query = rawText.replace(/^\/search\s+/, '').trim();
      if (!query) {
        await sendTelegramMessage(chatId, '🔍 Type <code>/search &lt;keyword&gt;</code> to search.');
        return { success: true };
      }

      try {
        const qLower = query.toLowerCase();
        const [notesRes, goalsRes] = await Promise.all([
          ApiResources.listNotes(actor, 15).catch(() => []),
          ApiResources.listGoals(actor, 15).catch(() => []),
        ]);

        const notes = extractItems(notesRes);
        const goals = extractItems(goalsRes);

        const matchedNotes = notes.filter(
          (n: any) =>
            (n.title && n.title.toLowerCase().includes(qLower)) ||
            (n.content && n.content.toLowerCase().includes(qLower))
        );
        const matchedGoals = goals.filter(
          (g: any) =>
            (g.title && g.title.toLowerCase().includes(qLower)) ||
            (g.description && g.description.toLowerCase().includes(qLower))
        );

        const totalMatches = matchedNotes.length + matchedGoals.length;
        if (totalMatches === 0) {
          await sendTelegramMessage(chatId, `🔍 <b>No Results Found</b>\n\nNo items matching "<b>${escapeHtml(query)}</b>".`);
          return { success: true };
        }

        let resultText = `🔍 <b>Search Results for "${escapeHtml(query)}"</b> (${totalMatches} found)\n\n`;
        const inlineKeyboard: any[][] = [];

        if (matchedNotes.length > 0) {
          resultText += '<b>💡 Ideas:</b>\n';
          matchedNotes.slice(0, 5).forEach((n: any, idx: number) => {
            resultText += `${idx + 1}. <b>${escapeHtml(n.title || 'Untitled')}</b>\n   <code>${n.id}</code>\n`;
            inlineKeyboard.push([{ text: `📖 Read: ${escapeHtml(n.title || 'Idea').slice(0, 30)}`, callback_data: `read_note:${n.id}` }]);
          });
          resultText += '\n';
        }

        if (matchedGoals.length > 0) {
          resultText += '<b>🎯 Goals:</b>\n';
          matchedGoals.slice(0, 5).forEach((g: any, idx: number) => {
            const statusIcon = g.status === 'completed' ? '✅' : '⏳';
            resultText += `${statusIcon} ${idx + 1}. <b>${escapeHtml(g.title || 'Goal')}</b> (${g.status || 'todo'})\n   <code>${g.id}</code>\n`;
            if (g.status !== 'completed') {
              inlineKeyboard.push([{ text: `✅ Done: ${escapeHtml(g.title || 'Goal').slice(0, 30)}`, callback_data: `done_goal:${g.id}` }]);
            }
          });
        }

        inlineKeyboard.push([{ text: '🔙 Main Menu', callback_data: 'menu_main' }]);

        await sendTelegramMessage(chatId, resultText, { inline_keyboard: inlineKeyboard });
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Search error: ${escapeHtml(err?.message)}`);
      }
      return { success: true };
    }

    // Specific CRUD slash commands
    if (
      rawText.startsWith('/note ') ||
      rawText.startsWith('/newnote ') ||
      rawText.startsWith('/idea ') ||
      rawText.startsWith('/newidea ')
    ) {
      const rawParams = rawText.replace(/^\/(note|newnote|idea|newidea)\s+/, '').trim();
      let title = 'Quick Idea';
      let content = '';

      if (rawParams.includes('|')) {
        const parts = rawParams.split('|');
        title = parts[0].trim() || 'Quick Idea';
        content = parts.slice(1).join('|').trim();
      } else {
        title = rawParams;
      }

      try {
        const activeWs = getTelegramActiveWorkspace(chatId);
        const payload: any = { title, content };
        if (activeWs) {
          payload.projectId = activeWs.id;
          payload.isWorkspace = true;
        }

        const newNote = await ApiResources.createNote(actor, payload);
        await sendTelegramMessage(
          chatId,
          `💡 <b>Idea Created!</b>\n\n` +
            `<b>Title:</b> ${escapeHtml(newNote.title)}\n` +
            (activeWs ? `<b>Workspace:</b> 📁 ${escapeHtml(activeWs.name)}\n` : '') +
            (content ? `<b>Body:</b> ${escapeHtml(content)}\n` : '') +
            `<code>ID: ${newNote.id}</code>`,
          {
            inline_keyboard: [
              [
                { text: '📖 Read', callback_data: `read_note:${newNote.id}` },
                { text: '🗑️ Delete', callback_data: `del_note:${newNote.id}` },
              ],
              [{ text: '💡 View Ideas', callback_data: 'menu_notes' }],
            ],
          }
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Failed to create idea: ${escapeHtml(err?.message)}`);
      }
      return { success: true };
    }

    if (
      rawText.startsWith('/goal ') ||
      rawText.startsWith('/task ') ||
      rawText.startsWith('/newgoal ') ||
      rawText.startsWith('/newtask ')
    ) {
      const title = rawText.replace(/^\/(goal|task|newgoal|newtask)\s+/, '').trim();
      if (!title) {
        await sendTelegramMessage(chatId, 'Usage: <code>/goal [title]</code>');
        return { success: true };
      }
      try {
        const activeWs = getTelegramActiveWorkspace(chatId);
        const payload: any = { title, status: 'todo' };
        if (activeWs) {
          payload.projectId = activeWs.id;
          payload.isWorkspace = true;
        }

        const newGoal = await ApiResources.createGoal(actor, payload);
        await sendTelegramMessage(
          chatId,
          `🎯 <b>Goal Logged!</b>\n\n` +
            `<b>Title:</b> ${escapeHtml(newGoal.title)}\n` +
            (activeWs ? `<b>Workspace:</b> 📁 ${escapeHtml(activeWs.name)}\n` : '') +
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
      return { success: true };
    }

    // Natural text quick-capture
    if (!rawText.startsWith('/')) {
      const firstLine = rawText.split('\n')[0].slice(0, 45).trim();
      const title = firstLine || 'Quick Thought';
      try {
        const activeWs = getTelegramActiveWorkspace(chatId);
        const payload: any = {
          title,
          content: rawText,
        };
        if (activeWs) {
          payload.projectId = activeWs.id;
          payload.isWorkspace = true;
        }

        const quickNote = await ApiResources.createNote(actor, payload);
        await sendTelegramMessage(
          chatId,
          `⚡ <b>Quick Idea Captured!</b>\n\n` +
            `<b>Title:</b> ${escapeHtml(quickNote.title)}\n` +
            (activeWs ? `<b>Workspace:</b> 📁 ${escapeHtml(activeWs.name)}\n` : '') +
            `<i>"${escapeHtml(rawText.slice(0, 80))}${rawText.length > 80 ? '...' : ''}"</i>\n\n` +
            `<code>ID: ${quickNote.id}</code>`,
          {
            inline_keyboard: [
              [
                { text: '📖 Read', callback_data: `read_note:${quickNote.id}` },
                { text: '🗑️ Delete', callback_data: `del_note:${quickNote.id}` },
              ],
              [{ text: '💡 All Ideas', callback_data: 'menu_notes' }],
            ],
          }
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Quick capture failed: ${escapeHtml(err?.message)}`);
      }
      return { success: true };
    }

    // Fallback unknown
    await sendTelegramMessage(
      chatId,
      '❓ Unknown command. Tap below to navigate:',
      buildMainMenuMarkup()
    );
    return { success: true };
  } catch (error: any) {
    console.error('[telegram-webhook] Exception in update handling:', error);
    return { success: false, status: 500, error: error?.message || 'Server error' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const result = await handleTelegramUpdate(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to process update' }, { status: result.status || 400 });
    }

    return NextResponse.json({ success: true, message: result.message }, { status: 200 });
  } catch (error: any) {
    console.error('[telegram-webhook] Exception in webhook execution:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
  if (!botToken) {
    return NextResponse.json({ ok: false, error: 'Telegram bot token is not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const shouldSync = searchParams.get('sync') === 'true';

  let syncResult = null;
  if (shouldSync) {
    syncResult = await syncTelegramBot(req.nextUrl.origin);
  }

  try {
    const [meRes, whRes] = await Promise.all([
      fetch(`https://api.telegram.org/bot${botToken}/getMe`).then((r) => r.json()).catch(() => ({ ok: false })),
      fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`).then((r) => r.json()).catch(() => ({ ok: false })),
    ]);

    return NextResponse.json({
      ok: true,
      bot: meRes.result || null,
      webhook: whRes.result || null,
      commands: TELEGRAM_BOT_COMMANDS,
      synced: syncResult,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }
}
