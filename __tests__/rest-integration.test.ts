/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

describe('REST-First Resource Discovery & Verification', () => {
  const token = process.env.TEST_KYLRIX_API;
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3005';

  const describeCondition = token ? describe : describe.skip;

  describeCondition('Live REST endpoints verification', () => {
    it('GET /api/v1/workspaces returns all 23 owned workspaces', { timeout: 15000 }, async () => {
    const res = await fetch(`${baseUrl}/api/v1/workspaces?limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);

    const owned = json.data.filter((w: any) => w.role === 'owner');
    expect(owned.length).toBe(23);
  });

  it('GET /api/v1/forms returns all 7 forms', { timeout: 15000 }, async () => {
    const res = await fetch(`${baseUrl}/api/v1/forms?limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(7);
  });

  it('GET /api/v1/events returns all 5 events', { timeout: 15000 }, async () => {
    const res = await fetch(`${baseUrl}/api/v1/events?limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(5);
  });
  });
});
