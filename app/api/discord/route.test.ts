import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  isValidDiscordWebhookUrl,
  verifyDiscordSignature,
  POST,
  GET,
  DISCORD_SLASH_COMMANDS,
  extractTitleSnippet,
  computeFuzzyMatchScore,
  searchAndRankWorkspaceItems,
} from './route';
import { ApiResources } from '@/lib/api/resources';
import { PairingService } from '@/lib/services/pairing';

vi.mock('@/lib/appwrite-admin', () => ({
  createSystemTablesDB: vi.fn().mockReturnValue({
    listRows: vi.fn().mockResolvedValue({ rows: [] }),
    createRow: vi.fn().mockResolvedValue({ $id: 'row_created' }),
    updateRow: vi.fn().mockResolvedValue({ $id: 'row_updated' }),
  }),
}));

vi.mock('@/lib/services/pairing', () => ({
  PairingService: {
    requestPairing: vi.fn().mockResolvedValue({
      id: 'req_123',
      deviceCode: 'dev_abc123',
      userCode: '7K9M-4W2P',
      verificationUri: 'https://www.kylrix.space/pair',
      verificationUriComplete: 'https://www.kylrix.space/pair?code=7K9M-4W2P',
    }),
    exchangeDeviceCode: vi.fn().mockImplementation(async (code: string) => {
      if (code === 'dev_granted') {
        return { status: 'granted', token: 'kyl_punch_123_456', userId: 'user_paired_99' };
      }
      return { status: 'authorization_pending' };
    }),
  },
}));

vi.mock('@/lib/services/pats', () => ({
  PatService: {
    verifyBearer: vi.fn().mockImplementation(async (token: string) => {
      if (token === 'kyl_pat_valid_token') {
        return {
          userId: 'user_pat_42',
          scopes: ['*'],
          pat: { tokenPrefix: 'pat_test', id: 'pat_1' },
        };
      }
      return null;
    }),
  },
}));

vi.mock('@/lib/api/resources', () => ({
  ApiResources: {
    listNotes: vi.fn().mockResolvedValue({
      items: [{ id: 'note_123', title: 'Roadmap', content: 'Decentralized sync' }],
    }),
    getNote: vi.fn().mockResolvedValue({
      id: 'note_123',
      title: 'Roadmap',
      content: 'Decentralized sync in depth',
    }),
    createNote: vi.fn().mockResolvedValue({
      id: 'note_created',
      title: 'Project Roadmap',
      content: 'Ship decentralized sync engine',
    }),
    deleteNote: vi.fn().mockResolvedValue({ success: true }),
    listGoals: vi.fn().mockResolvedValue({
      items: [{ id: 'goal_123', title: 'Launch App', status: 'todo' }],
    }),
    getGoal: vi.fn().mockResolvedValue({
      id: 'goal_123',
      title: 'Launch App',
      status: 'todo',
    }),
    createGoal: vi.fn().mockResolvedValue({
      id: 'goal_created',
      title: 'Launch App',
      status: 'todo',
    }),
    updateGoal: vi.fn().mockResolvedValue({
      id: 'goal_123',
      title: 'Launch App',
      status: 'completed',
    }),
    deleteGoal: vi.fn().mockResolvedValue({ success: true }),
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
  it('should export all 1:1 slash commands specification', () => {
    const commandNames = DISCORD_SLASH_COMMANDS.map((c) => c.name);
    assert.ok(commandNames.includes('menu'));
    assert.ok(commandNames.includes('ideas'));
    assert.ok(commandNames.includes('idea'));
    assert.ok(commandNames.includes('idea_read'));
    assert.ok(commandNames.includes('idea_delete'));
    assert.ok(commandNames.includes('goals'));
    assert.ok(commandNames.includes('goal'));
    assert.ok(commandNames.includes('goal_done'));
    assert.ok(commandNames.includes('goal_delete'));
    assert.ok(commandNames.includes('workspaces'));
    assert.ok(commandNames.includes('pair'));
    assert.ok(commandNames.includes('link'));
    assert.ok(commandNames.includes('unlink'));
    assert.ok(commandNames.includes('whoami'));
    assert.ok(commandNames.includes('settings'));
    assert.ok(commandNames.includes('agent'));
  });

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
    assert.equal(json.data.components[0].components[0].type, 3);
    assert.equal(json.data.components[0].components[0].custom_id, 'kylrix_main_select');
  });

  it('should handle message component interaction (type 3) updating message with ideas submenu', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 3,
        data: {
          custom_id: 'kylrix_main_select',
          values: ['val_ideas'],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 7); // UPDATE_MESSAGE
    assert.ok(json.data.embeds[0].title.includes('Ideas'));
    assert.ok(ApiResources.listNotes.mock.calls.length > 0);
  });

  it('should handle slash command /idea and create idea via ApiResources', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'idea',
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

  it('should handle slash command /idea_read to fetch and read an idea', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'idea_read',
          options: [{ name: 'id', value: 'note_123' }],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Roadmap'));
    assert.ok(json.data.embeds[0].description.includes('Decentralized sync'));
  });

  it('should handle slash command /idea_delete to delete an idea', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'idea_delete',
          options: [{ name: 'id', value: 'note_123' }],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Deleted'));
  });

  it('should handle slash command /goal_done to complete a goal', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'goal_done',
          options: [{ name: 'id', value: 'goal_123' }],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Completed'));
  });

  it('should handle slash command /pair for 1-click device pairing', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: { name: 'pair' },
        user: { id: 'discord_user_88', username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Pair Kylrix Account'));
    assert.ok(json.data.embeds[0].description.includes('7K9M-4W2P'));
    assert.equal(PairingService.requestPairing.mock.calls.length > 0, true);
  });

  it('should handle slash command /link with a Personal Access Token', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'link',
          options: [{ name: 'token', value: 'kyl_pat_valid_token' }],
        },
        user: { id: 'discord_user_88', username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Linked'));
    assert.ok(json.data.embeds[0].description.includes('user_pat_42'));
  });

  it('should handle slash command /whoami', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: { name: 'whoami' },
        user: { id: 'discord_user_88', username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Identity'));
  });

  it('should handle message component check_pair when granted', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 3,
        data: { custom_id: 'check_pair:dev_granted' },
        user: { id: 'discord_user_88', username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 7); // UPDATE_MESSAGE
    assert.ok(json.data.embeds[0].title.includes('Successfully Paired'));
    assert.ok(json.data.embeds[0].description.includes('user_paired_99'));
  });

  it('should handle GET /api/discord and return online status with all commands', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord');
    const res = await GET(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.service, 'kylrix-discord-bot');
    assert.ok(json.commands.includes('/ideas'));
    assert.ok(json.commands.includes('/save'));
    assert.ok(json.commands.includes('/share'));
    assert.ok(json.commands.includes('/pair'));
    assert.ok(json.commands.includes('/goals'));
  });

  describe('extractTitleSnippet helper', () => {
    it('should extract clean title from markdown first line', () => {
      const title = extractTitleSnippet('# Migration notes for SQLite\nDetailed body here');
      assert.equal(title, 'Migration notes for SQLite');
    });

    it('should truncate titles longer than maxLen with ellipsis', () => {
      const longText = 'This is an exceedingly long sentence that definitely exceeds sixty characters in total length';
      const title = extractTitleSnippet(longText, 40);
      assert.ok(title.endsWith('...'));
      assert.ok(title.length <= 43);
    });

    it('should fallback to Quick Idea for empty input', () => {
      assert.equal(extractTitleSnippet(''), 'Quick Idea');
      assert.equal(extractTitleSnippet('   '), 'Quick Idea');
    });
  });

  describe('computeFuzzyMatchScore helper', () => {
    it('should give highest score to exact ID match', () => {
      const score = computeFuzzyMatchScore('Some Title', 'Some Body', 'note_123', 'note_123');
      assert.equal(score, 1000);
    });

    it('should give high score to exact title match', () => {
      const score = computeFuzzyMatchScore('Migration logs', 'Some Body', 'migration logs', 'note_99');
      assert.ok(score >= 600);
    });

    it('should match multi-word tokens in title', () => {
      const score = computeFuzzyMatchScore('Project Migration Logs 2026', 'Body', 'migration logs', 'note_99');
      assert.ok(score > 100);
    });
  });

  it('should handle slash command /save and auto-generate title snippet', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'save',
          options: [
            { name: 'content', value: 'We need to migrate Turso SQLite replica to production this weekend.' },
          ],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Idea Saved'));
    assert.ok(ApiResources.createNote.mock.calls.length > 0);
  });

  it('should handle message context menu action "Save as Idea"', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          type: 3,
          name: 'Save as Idea',
          target_id: 'msg_999',
          resolved: {
            messages: {
              msg_999: {
                content: 'Important meeting notes: launch zero-knowledge secrets gateway on Monday',
                author: { username: 'bob' },
              },
            },
          },
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Idea Saved from Message'));
    assert.ok(ApiResources.createNote.mock.calls.length > 0);
  });

  it('should handle slash command /share with exact object ID and give share link instantly', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'share',
          options: [{ name: 'item', value: 'note_123' }],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Share Link'));
    assert.ok(json.data.embeds[0].description.includes('/idea/note_123'));
  });

  it('should handle slash command /share with title query and return close matches with buttons', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: {
          name: 'share',
          options: [{ name: 'item', value: 'Roadmap' }],
        },
        user: { username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    // Either exact single match found or close matches returned
    assert.ok(
      json.data.embeds[0].title.includes('Share Link') ||
      json.data.embeds[0].title.includes('Close Matches')
    );
  });

  it('should handle message component share_pick button callback', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 3,
        data: { custom_id: 'share_pick:idea:note_123' },
        user: { id: 'discord_user_88', username: 'alice' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 7); // UPDATE_MESSAGE
    assert.ok(json.data.embeds[0].title.includes('Share Link: Idea'));
    assert.ok(json.data.embeds[0].description.includes('/idea/note_123'));
  });
});
