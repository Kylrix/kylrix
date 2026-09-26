import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { isValidDiscordWebhookUrl, verifyDiscordSignature, POST } from './route';

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
    assert.equal(
      isValidDiscordWebhookUrl('gopher://discord.com/api/webhooks/1234567890/abcdef'),
      false
    );
  });

  it('should reject non-Discord domains (SSRF protection)', () => {
    assert.equal(
      isValidDiscordWebhookUrl('https://evil.com/api/webhooks/123'),
      false
    );
    assert.equal(
      isValidDiscordWebhookUrl('https://discord.com.attacker.com/api/webhooks/123'),
      false
    );
    assert.equal(
      isValidDiscordWebhookUrl('https://169.254.169.254/latest/meta-data/'),
      false
    );
    assert.equal(
      isValidDiscordWebhookUrl('https://localhost:8080/api/webhooks/123'),
      false
    );
  });

  it('should reject Discord URLs without /api/webhooks/ path', () => {
    assert.equal(isValidDiscordWebhookUrl('https://discord.com/login'), false);
    assert.equal(isValidDiscordWebhookUrl('https://discord.com/api/v10/users/@me'), false);
  });

  it('should reject malformed or non-string inputs', () => {
    assert.equal(isValidDiscordWebhookUrl('not-a-url'), false);
    assert.equal(isValidDiscordWebhookUrl(null as any), false);
    assert.equal(isValidDiscordWebhookUrl(undefined as any), false);
    assert.equal(isValidDiscordWebhookUrl(12345 as any), false);
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

  it('should reject forged or mismatched signatures', () => {
    const { publicKey } = crypto.generateKeyPairSync('ed25519');
    const rawPub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');

    const isValid = verifyDiscordSignature({
      rawBody: '{"type": 1}',
      signature: 'deadbeef1234',
      timestamp: '1720000000',
      clientPublicKey: rawPub,
    });

    assert.equal(isValid, false);
  });
});

describe('Discord API Route Handler', () => {
  it('should return 400 when outbound notification webhookUrl is disallowed', async () => {
    const req = new NextRequest('http://localhost:3005/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'notify',
        webhookUrl: 'https://internal-service.local/secret-endpoint',
        content: 'Test notification',
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.error, 'Invalid or disallowed webhookUrl');
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

  it('should handle slash command /note', async () => {
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
        user: { username: 'testuser' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.type, 4);
    assert.ok(json.data.embeds[0].title.includes('Project Roadmap'));
    assert.ok(json.data.embeds[0].description.includes('Ship decentralized sync engine'));
  });
});
