import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autonomicSyncEngine } from './sync-engine';
import { registerLiveEventGetter, registerLiveGoalGetter, registerLiveNoteGetter } from '../sync/pending-sync-bridge';

vi.mock('../auth/better-auth-client', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({
      data: { user: { id: 'test_user_123' } },
    }),
  },
}));

vi.mock('../actions/client-ops', () => ({
  updateNote: vi.fn().mockResolvedValue({ success: true }),
  createNote: vi.fn().mockResolvedValue({ success: true }),
  updateGoal: vi.fn().mockResolvedValue({ success: true }),
  createGoal: vi.fn().mockResolvedValue({ success: true }),
  updateEvent: vi.fn().mockResolvedValue({ success: true }),
  createEvent: vi.fn().mockResolvedValue({ success: true }),
}));

describe('autonomicSyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly tracks pending items for notes, goals, and events', () => {
    autonomicSyncEngine.markPending('note_1', 'rev_1', { title: 'Note 1' });
    autonomicSyncEngine.markPending('goal:goal_1', 'rev_1', { id: 'goal_1', title: 'Goal 1' });
    autonomicSyncEngine.markPending('event:event_1', 'rev_1', { id: 'event_1', title: 'Event 1' });

    expect(autonomicSyncEngine.isPending('note_1')).toBe(true);
    expect(autonomicSyncEngine.isPending('goal_1')).toBe(true);
    expect(autonomicSyncEngine.isPending('event_1')).toBe(true);

    autonomicSyncEngine.ack('note_1', 'rev_1');
    autonomicSyncEngine.ack('goal:goal_1', 'rev_1');
    autonomicSyncEngine.ack('event:event_1', 'rev_1');

    expect(autonomicSyncEngine.isPending('note_1')).toBe(false);
    expect(autonomicSyncEngine.isPending('goal_1')).toBe(false);
    expect(autonomicSyncEngine.isPending('event_1')).toBe(false);
  });

  it('runs sync cycle and flushes pending event, note, and goal', async () => {
    const mockNote = { $id: 'note_999', title: 'Test Note', content: 'Body' };
    const mockGoal = { id: 'goal_999', title: 'Test Goal', status: 'todo' };
    const mockEvent = { id: 'event_999', title: 'Test Event', startTime: new Date() };

    registerLiveNoteGetter((id) => (id === 'note_999' ? mockNote : null));
    registerLiveGoalGetter((id) => (id === 'goal_999' ? (mockGoal as any) : null));
    registerLiveEventGetter((id) => (id === 'event_999' ? (mockEvent as any) : null));

    autonomicSyncEngine.markPending('note_999', 'rev_n', mockNote);
    autonomicSyncEngine.markPending('goal:goal_999', 'rev_g', mockGoal);
    autonomicSyncEngine.markPending('event:event_999', 'rev_e', mockEvent);

    await autonomicSyncEngine.runCycle();

    const clientOps = await import('../actions/client-ops');
    expect(clientOps.updateNote).toHaveBeenCalledWith('note_999', expect.anything());
    expect(clientOps.updateGoal).toHaveBeenCalledWith('goal_999', expect.anything());
    expect(clientOps.updateEvent).toHaveBeenCalledWith('event_999', expect.anything());

    expect(autonomicSyncEngine.isPending('note_999')).toBe(false);
    expect(autonomicSyncEngine.isPending('goal_999')).toBe(false);
    expect(autonomicSyncEngine.isPending('event_999')).toBe(false);
  });
});
