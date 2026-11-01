/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';

describe('REST-First Resource Discovery & Verification', () => {
  const token = process.env.TEST_KYLRIX_API || process.env.KYLRIX_PAT;
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3005';

  let isServerReachable = false;

  beforeAll(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${baseUrl}/api/v1/auth/status`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
      if (res) isServerReachable = true;
    } catch {
      isServerReachable = false;
    }
  });

  const describeCondition = token ? describe : describe.skip;

  describeCondition('Live REST endpoints verification', () => {
    it('GET /api/v1/workspaces satisfies unified workspace shape contract', { timeout: 15000 }, async (ctx) => {
      if (!isServerReachable) {
        ctx.skip();
        return;
      }

      const res = await fetch(`${baseUrl}/api/v1/workspaces?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      for (const ws of json.data) {
        expect(typeof ws.id).toBe('string');
        expect(ws.id.length).toBeGreaterThan(0);

        // Fallback between title and name must resolve to non-empty string
        const resolvedTitle = ws.title || ws.name;
        expect(typeof resolvedTitle).toBe('string');
        expect(resolvedTitle.trim().length).toBeGreaterThan(0);

        // Valid role property ('owner', 'editor', or 'viewer')
        expect(['owner', 'editor', 'viewer']).toContain(ws.role);
      }
    });

    it('GET /api/v1/forms satisfies forms contract structure', { timeout: 15000 }, async (ctx) => {
      if (!isServerReachable) {
        ctx.skip();
        return;
      }

      const res = await fetch(`${baseUrl}/api/v1/forms?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      for (const form of json.data) {
        expect(typeof form.id).toBe('string');
        expect(form.id.length).toBeGreaterThan(0);

        const resolvedTitle = form.title || form.name;
        expect(typeof resolvedTitle).toBe('string');
        expect(resolvedTitle.trim().length).toBeGreaterThan(0);

        // Schema structure must be defined (string or parsed object/array)
        expect(form.schema !== undefined && form.schema !== null).toBe(true);
      }
    });

    it('GET /api/v1/events satisfies events contract structure with ISO timestamps', { timeout: 15000 }, async (ctx) => {
      if (!isServerReachable) {
        ctx.skip();
        return;
      }

      const res = await fetch(`${baseUrl}/api/v1/events?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      for (const evt of json.data) {
        expect(typeof evt.id).toBe('string');
        expect(evt.id.length).toBeGreaterThan(0);

        const resolvedTitle = evt.title || evt.name;
        expect(typeof resolvedTitle).toBe('string');
        expect(resolvedTitle.trim().length).toBeGreaterThan(0);

        // Verify valid ISO timestamp strings for startTime and endTime
        expect(typeof evt.startTime).toBe('string');
        expect(Number.isNaN(Date.parse(evt.startTime))).toBe(false);
        expect(typeof evt.endTime).toBe('string');
        expect(Number.isNaN(Date.parse(evt.endTime))).toBe(false);
      }
    });
  });
});
