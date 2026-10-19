import { describe, it, expect, vi } from 'vitest';
import { buildInstantShareUrl } from './instant-share';
import { toggleResourcePublicGuestSecure } from '../actions/secure-ops/misc';

vi.mock('../actions/secure-ops/shared', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getActor: vi.fn(async () => ({ $id: 'test_user_123', email: 'test@kylrix.com' })),
  };
});

vi.mock('../db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('../realtime/partykit', () => ({
  broadcastRealtimeEvent: vi.fn(async () => {}),
}));

describe('Share Context Drawer & Instant Share Operations', () => {
  it('builds instant share URL synchronously for standalone resource', () => {
    const url = buildInstantShareUrl('note', 'note_abc123');
    expect(url).toContain('idea/note_abc123');
  });

  it('builds instant share URL for project resource', () => {
    const url = buildInstantShareUrl('note', 'note_abc123', { projectId: 'project_456' });
    expect(url).toContain('workspace/project_456');
  });

  it('toggleResourcePublicGuestSecure sets isPublic and isGuest to true on publish mode', async () => {
    const res = await toggleResourcePublicGuestSecure({
      resourceType: 'note',
      resourceId: 'note_abc123',
      mode: 'publish',
    });
    expect(res.success).toBe(true);
    expect(res.isPublic).toBe(true);
    expect(res.isGuest).toBe(true);
    expect(res.publicUrl).toContain('idea/note_abc123');
  });
});
