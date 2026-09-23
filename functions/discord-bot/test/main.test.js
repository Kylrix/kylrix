import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import handler, { isValidDiscordWebhookUrl } from '../src/main.js';

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
    assert.equal(
      isValidDiscordWebhookUrl('https://discord.com/login'),
      false
    );
    assert.equal(
      isValidDiscordWebhookUrl('https://discord.com/api/v10/users/@me'),
      false
    );
  });

  it('should reject malformed or non-string inputs', () => {
    assert.equal(isValidDiscordWebhookUrl('not-a-url'), false);
    assert.equal(isValidDiscordWebhookUrl(null), false);
    assert.equal(isValidDiscordWebhookUrl(undefined), false);
    assert.equal(isValidDiscordWebhookUrl(12345), false);
  });
});

describe('Discord Bot Function Handler - SSRF Protection', () => {
  it('should return 400 when webhookUrl is disallowed', async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = {
      body: {
        action: 'notify',
        webhookUrl: 'https://internal-service.local/secret-endpoint',
        content: 'Test notification',
      },
      headers: {},
    };

    const mockRes = {
      json: (data, status = 200) => {
        responseBody = data;
        responseStatus = status;
        return data;
      },
    };

    const logs = [];
    const errors = [];

    await handler({
      req: mockReq,
      res: mockRes,
      log: (msg) => logs.push(msg),
      error: (msg) => errors.push(msg),
    });

    assert.equal(responseStatus, 400);
    assert.equal(responseBody.ok, false);
    assert.equal(responseBody.error, 'Invalid or disallowed webhookUrl');
    assert.ok(errors.some((e) => e.includes('Invalid or disallowed Discord webhook URL')));
  });
});
