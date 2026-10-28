import { describe, it, expect, vi } from 'vitest';
import { KylrixClient } from '@/sdk/api/client';

const BEARER = `kyl_aet_a1b2c3d4_${'A'.repeat(32)}`;
const FULL_AET = `${BEARER}.etk_${'ab'.repeat(32)}`;

describe('KylrixClient authorization header', () => {
  it('never sends the AET unlock part on the wire', async () => {
    const seen: Record<string, string>[] = [];
    const mockFetch = vi.fn(async (_url: any, init: any) => {
      seen.push({ ...(init?.headers || {}) });
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const client = new KylrixClient({
      baseUrl: 'https://unit.test',
      token: FULL_AET,
      fetch: mockFetch,
    });

    await client.auth.me();

    expect(mockFetch).toHaveBeenCalled();
    const auth = seen[0]['Authorization'];
    expect(auth).toBe(`Bearer ${BEARER}`);
    expect(auth).not.toContain('etk_');
  });

  it('passes through ordinary PATs unchanged', async () => {
    const seen: Record<string, string>[] = [];
    const mockFetch = vi.fn(async (_url: any, init: any) => {
      seen.push({ ...(init?.headers || {}) });
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const pat = 'kyl_pat_prefix12_secretsecret';
    const client = new KylrixClient({ baseUrl: 'https://unit.test', token: pat, fetch: mockFetch });
    await client.auth.me();
    expect(seen[0]['Authorization']).toBe(`Bearer ${pat}`);
  });
});
