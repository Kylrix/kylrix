import { describe, it, vi, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST, GET, syncTelegramBot, TELEGRAM_BOT_COMMANDS } from './route';
import { createSystemClient } from '@/lib/appwrite/types';
import { ApiResources } from '@/lib/api/resources';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: 'user_123' }]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(Object.assign(Promise.resolve([]), { catch: vi.fn().mockResolvedValue([]) })) }),
  },
}));

vi.mock('@/lib/actions/turso-ops', () => ({
  upsertTelegramConnectionTurso: vi.fn().mockResolvedValue({ success: true }),
  listNotesTurso: vi.fn().mockResolvedValue({ success: false, rows: [] }),
  listGoalsTurso: vi.fn().mockResolvedValue({ success: false, rows: [] }),
  listWorkspacesTurso: vi.fn().mockResolvedValue({ success: false, rows: [] }),
  getNoteTurso: vi.fn().mockResolvedValue({ success: false }),
  deleteNoteTurso: vi.fn().mockResolvedValue({ success: true }),
  getGoalTurso: vi.fn().mockResolvedValue({ success: false }),
  upsertGoalTurso: vi.fn().mockResolvedValue({ success: true }),
  deleteGoalTurso: vi.fn().mockResolvedValue({ success: true }),
  upsertNoteTurso: vi.fn().mockResolvedValue({ success: true }),
  getWorkspaceTurso: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('@/lib/appwrite-admin', () => ({
  createSystemClient: vi.fn(),
}));

vi.mock('@/lib/api/resources', () => ({
  ApiResources: {
    listNotes: vi.fn(),
    createNote: vi.fn(),
    getNote: vi.fn(),
    deleteNote: vi.fn(),
    listGoals: vi.fn(),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    listWorkspaces: vi.fn(),
    me: vi.fn(),
    getBillingStatus: vi.fn(),
  },
}));

describe('Telegram Webhook Route Handler - Interactive Menus & 1:1 Parity', () => {
  const mockDatabases = {
    getRow: vi.fn(),
    listRows: vi.fn(),
    updateRow: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    (createSystemClient as any).mockReturnValue({ databases: mockDatabases });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    });
  });

  it('rejects payloads without valid chat or message', async () => {
    const req = new NextRequest('http://localhost:3005/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
  });

  it('handles /menu for verified connected user and displays main interactive menu', async () => {
    mockDatabases.listRows.mockResolvedValueOnce({
      rows: [{ $id: 'user_123', is_verified: true, tg_chat_id: '98765' }],
    });

    const req = new NextRequest('http://localhost:3005/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 98765 },
          text: '/menu',
          from: { username: 'tg_user' },
        },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.ok(global.fetch.mock.calls.length > 0);
    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    assert.ok(sentBody.text.includes('Dashboard'));
    assert.ok(sentBody.reply_markup.inline_keyboard.length > 0);
  });

  it('handles callback query inline button tap to render notes submenu', async () => {
    mockDatabases.listRows.mockResolvedValueOnce({
      rows: [{ $id: 'user_123', is_verified: true, tg_chat_id: '98765' }],
    });
    (ApiResources.listNotes as any).mockResolvedValueOnce({
      items: [{ id: 'note_99', title: 'Secret Specs', content: 'Top secret plan' }],
    });

    const req = new NextRequest('http://localhost:3005/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query: {
          id: 'cb_query_1',
          data: 'menu_notes',
          message: {
            message_id: 42,
            chat: { id: 98765 },
          },
        },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.ok(ApiResources.listNotes.mock.calls.length === 1);
  });

  it('handles callback query to mark goal done', async () => {
    mockDatabases.listRows.mockResolvedValueOnce({
      rows: [{ $id: 'user_123', is_verified: true, tg_chat_id: '98765' }],
    });
    (ApiResources.updateGoal as any).mockResolvedValueOnce({
      id: 'goal_55',
      title: 'Deploy to Cloud',
      status: 'completed',
    });

    const req = new NextRequest('http://localhost:3005/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query: {
          id: 'cb_query_2',
          data: 'done_goal:goal_55',
          message: {
            message_id: 43,
            chat: { id: 98765 },
          },
        },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.ok(ApiResources.updateGoal.mock.calls.length === 1);
    assert.equal(ApiResources.updateGoal.mock.calls[0][1], 'goal_55');
  });

  it('handles natural text as Quick Note capture', async () => {
    mockDatabases.listRows.mockResolvedValueOnce({
      rows: [{ $id: 'user_123', is_verified: true, tg_chat_id: '98765' }],
    });
    (ApiResources.createNote as any).mockResolvedValueOnce({
      id: 'note_new',
      title: 'Buy coffee beans',
      content: 'Buy coffee beans',
    });

    const req = new NextRequest('http://localhost:3005/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 98765 },
          text: 'Buy coffee beans',
          from: { username: 'tg_user' },
        },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.ok(ApiResources.createNote.mock.calls.length === 1);
  });

  it('syncTelegramBot registers commands and sets webhook for https target', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: true }),
    });

    const res = await syncTelegramBot('https://www.kylrix.space');
    assert.equal(res.success, true);
    assert.equal(res.commandsSynced, true);
    assert.equal(res.webhook.configured, true);
    assert.equal(res.webhook.url, 'https://www.kylrix.space/api/telegram/webhook');

    // Verify calls to setMyCommands and setWebhook
    const fetchCalls = (global.fetch as any).mock.calls;
    const cmdCall = fetchCalls.find((call: any[]) => call[0].includes('setMyCommands'));
    const whCall = fetchCalls.find((call: any[]) => call[0].includes('setWebhook'));
    assert.ok(cmdCall, 'setMyCommands was called');
    assert.ok(whCall, 'setWebhook was called');
  });

  it('GET returns status and command list', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('getMe')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { id: 12345, username: 'KylrixBot' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true, result: { url: 'https://www.kylrix.space/api/telegram/webhook' } }),
      });
    });

    const req = new NextRequest('http://localhost:3005/api/telegram/webhook');
    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.bot.username, 'KylrixBot');
    assert.equal(data.commands.length, TELEGRAM_BOT_COMMANDS.length);
  });
});
