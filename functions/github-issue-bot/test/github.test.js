import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { sign } from '@octokit/webhooks-methods';
import GithubService from '../src/github.js';

describe('GithubService - verifyWebhook', () => {
  let originalSecret;

  beforeEach(() => {
    originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.GITHUB_WEBHOOK_SECRET;
    }
  });

  it('should return false when GITHUB_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const github = new GithubService();
    const req = {
      headers: {
        'x-hub-signature-256': 'sha256=1234567890abcdef',
      },
    };
    const result = await github.verifyWebhook(req, '{"action":"opened"}');
    assert.equal(result, false);
  });

  it('should return false when signature header is missing', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'my_test_secret';
    const github = new GithubService();
    const req = {
      headers: {},
    };
    const result = await github.verifyWebhook(req, '{"action":"opened"}');
    assert.equal(result, false);
  });

  it('should return false when signature is invalid', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'my_test_secret';
    const github = new GithubService();
    const req = {
      headers: {
        'x-hub-signature-256': 'sha256=invalid_signature_hash',
      },
    };
    const result = await github.verifyWebhook(req, '{"action":"opened"}');
    assert.equal(result, false);
  });

  it('should return true when signature is valid', async () => {
    const secret = 'my_test_secret';
    process.env.GITHUB_WEBHOOK_SECRET = secret;
    const rawBody = '{"action":"opened"}';
    const validSignature = await sign(secret, rawBody);

    const github = new GithubService();
    const req = {
      headers: {
        'x-hub-signature-256': validSignature,
      },
    };
    const result = await github.verifyWebhook(req, rawBody);
    assert.equal(result, true);
  });
});
