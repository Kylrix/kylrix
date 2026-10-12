import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { POST, GET } from './route';

describe('GitHub Webhook Route Verification', () => {
  const originalEnv = process.env.GITHUB_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GITHUB_WEBHOOK_SECRET = originalEnv;
    } else {
      delete process.env.GITHUB_WEBHOOK_SECRET;
    }
  });

  it('GET should return active status endpoint info', async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('active');
    expect(data.endpoint).toBe('/api/github/webhook');
  });

  it('should return 500 when GITHUB_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      body: JSON.stringify({ zen: 'Non-blocking is better than blocking.' }),
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('Webhook secret not configured');
  });

  it('should return 401 when x-hub-signature-256 header is missing', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test_secret';
    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      body: JSON.stringify({ zen: 'Non-blocking is better than blocking.' }),
      headers: {
        'x-github-event': 'ping',
      },
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Missing x-hub-signature-256');
  });

  it('should return 403 when signature is invalid', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test_secret';
    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      body: JSON.stringify({ zen: 'Non-blocking is better than blocking.' }),
      headers: {
        'x-github-event': 'ping',
        'x-hub-signature-256': 'sha256=invalid_signature_hash',
      },
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toBe('Invalid webhook signature');
  });

  it('should return 200 with valid signature for ping event', async () => {
    const secret = 'test_secret';
    process.env.GITHUB_WEBHOOK_SECRET = secret;

    const payload = JSON.stringify({ zen: 'Mind your words.', hook_id: 12345 });
    const hmac = crypto.createHmac('sha256', secret);
    const signature = `sha256=${hmac.update(payload).digest('hex')}`;

    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      body: payload,
      headers: {
        'x-github-event': 'ping',
        'x-github-delivery': 'delivery-uuid-1234',
        'x-hub-signature-256': signature,
      },
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toContain('Pong!');
    expect(data.zen).toBe('Mind your words.');
  });

  it('should return 200 with valid signature for push event', async () => {
    const secret = 'super_secret_key';
    process.env.GITHUB_WEBHOOK_SECRET = secret;

    const payload = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'kylrix/core' },
      sender: { login: 'octocat' },
    });
    const hmac = crypto.createHmac('sha256', secret);
    const signature = `sha256=${hmac.update(payload).digest('hex')}`;

    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      body: payload,
      headers: {
        'x-github-event': 'issues',
        'x-github-delivery': 'deliv-5678',
        'x-hub-signature-256': signature,
      },
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.event).toBe('issues');
    expect(data.repo).toBe('kylrix/core');
  });
});
