import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { isValidDiscordWebhookUrl, verifyDiscordSignature, POST } from './route';
import { ApiResources } from '@/lib/api/resources';

vi.mock('@/lib/api/resources', () => ({
  ApiResources: {
    listNotes: vi.fn().mockResolvedValue({
      items: [{ id: 'note_123', title: 'Roadmap', content: 'Decentralized sync' }],
    }),
    createNote: vi.fn().mockResolvedValue({
      id: 'note_created',
      title: 'Project Roadmap',
      content: 'Ship decentralized sync engine',
    }),
    listGoals: vi.fn().mockResolvedValue({
      items: [{ id: 'goal_123', title: 'Launch App', status: 'todo' }],
    }),
    createGoal: vi.fn().mockResolvedValue({
      id: 'goal_created',
      title: 'Launch App',
      status: 'todo',
    }),
    listWorkspaces: vi.fn().mockResolvedValue({
      items: [{ id: 'ws_1', name: 'Alpha Lab', collaboratorsCount: 3 }],
    }),
    me: vi.fn().mockResolvedValue({
      tier: 'PRO',
      quotas: { isPro: true, maxCollaboratorsPerResource: 100 },
    }),
    getBillingStatus: vi.fn().mockResolvedValue({
      active: true,
      tier: 'PRO',
      balance: { amount: 50, symbol: 'KYL' },
    }),
  },
}));

describe('isValidDiscordWebhookUrl', () => {
  it('should accept valid Discord webhook URLs', () => {
    assert.equal(
      isValidDiscordWebhookUrl('https://discord.com/api/webhooks/1234567890/abcdef'),
      true
    );
    assert.equal(
      isValidDiscordWebhookUrl('https://discordapp.com/api/webhooks/1234567890/abcdef'),
      true
    );
    assert.equal(
      isValidDiscordWebhookUrl('https://canary.discord.com/api/webhooks/1234567890/abcdef'),
      true
    );
  });

  it('should reject non-https protocols', () => {
    assert.equal(
      isValidDiscordWebhookUrl('http://discord.com/api/webhooks/1234567890/abcdef'),
      false
    );
  });

  it('should reject non-Discord domains (SSRF protection)', () => {
    assert.equal(
      isValidDiscordWebhookUrl('https://evil.com/api/webhooks/123'),
      false
    );
  });
});

describe('verifyDiscordSignature', () => {
  it('should correctly verify ed25519 signatures generated with node:crypto', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const rawPub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
    const timestamp = '1720000000';
    const rawBody = JSON.stringify({ type: 1 });
    const data = Buffer.from(timestamp + rawBody);
    const signature = crypto.sign(null, data, privateKey).toString('hex');

    const isValid = verifyDiscordSignature({
      rawBody,
      signature,
      timestamp,
      clientPublicKey: rawPub,
    });

    assert.equal(isValid, true);
  });
});

describe('Discord API Route Handler - Interactive Menus & 1:1 Parity', () => {
  it('should handle Discord PING interaction (type 1)', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 1 }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json, { type: 1 });
  });

  it('should handle slash command /menu with interactive select menu and buttons', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: { name: 'menu' },
        user: { username: 'alice', global_name: 'Alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Dashboard'));
    // Verify select menu component
    assert.equal(json.data.components[0].components[0].type, 3);
    assert.equal(json.data.components[0].components[0].custom_id, 'kylrix_main_select');
  });

  it('should handle message component interaction (type 3) updating message with notes submenu', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 3,
        data: {
          custom_id: 'kylrix_main_select',
          values: ['val_notes'],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 7); // UPDATE_MESSAGE
    assert.ok(json.data.embeds[0].title.includes('Notes'));
    assert.ok(ApiResources.listNotes.mock.calls.length > 0);
  });

  it('should handle slash command /note and create note via ApiResources', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'note',
          options: [
            { name: 'title', value: 'Project Roadmap' },
            { name: 'content', value: 'Ship decentralized sync engine' },
          ],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Project Roadmap'));
    assert.ok(ApiResources.createNote.mock.calls.length > 0);
  });
});
