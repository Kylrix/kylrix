import { describe, it, vi, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { createSystemClient } from '@/lib/appwrite-admin';
import { ApiResources } from '@/lib/api/resources';

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
  },
}));

describe('Telegram Webhook Route Handler', () => {
  const mockDatabases = {
    getRow: vi.fn(),
    listRows: vi.fn(),
    updateRow: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    (createSystemClient as any).mockReturnValue({ databases: mockDatabases });
    // Mock global fetch for Telegram sendMessage
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

  it('notifies unconnected user when sending commands', async () => {
    mockDatabases.listRows.mockResolvedValueOnce({ rows: [] });

    const req = new NextRequest('http://localhost:3005/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 98765 },
          text: '/notes',
          from: { username: 'tg_user' },
        },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.message, 'User not connected');
    assert.ok(global.fetch.mock.calls.length > 0);
  });

  it('handles /notes for verified connected user', async () => {
    mockDatabases.listRows.mockResolvedValueOnce({
      rows: [{ $id: 'user_123', is_verified: true, tg_chat_id: '98765' }],
    });
    (ApiResources.listNotes as any).mockResolvedValueOnce({
      items: [{ id: 'note_1', title: 'Test Note', content: 'Note content' }],
    });

    const req = new NextRequest('http://localhost:3005/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 98765 },
          text: '/notes',
          from: { username: 'tg_user' },
        },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.ok(ApiResources.listNotes.mock.calls.length === 1);
    assert.ok(global.fetch.mock.calls.length > 0);
  });

  it('handles natural text as Quick Note capture', async () => {
    mockDatabases.listRows.mockResolvedValueOnce({
      rows: [{ $id: 'user_123', is_verified: true, tg_chat_id: '98765' }],
    });
    (ApiResources.createNote as any).mockResolvedValueOnce({
      id: 'note_new',
      title: 'Buy organic milk and coffee',
      content: 'Buy organic milk and coffee',
    });

    const req = new NextRequest('http://localhost:3005/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 98765 },
          text: 'Buy organic milk and coffee',
          from: { username: 'tg_user' },
        },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.ok(ApiResources.createNote.mock.calls.length === 1);
    assert.equal(
      ApiResources.createNote.mock.calls[0][1].content,
      'Buy organic milk and coffee'
    );
    assert.ok(global.fetch.mock.calls.length > 0);
  });
});
