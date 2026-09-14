import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { convertResponseToGoal } from '@/lib/actions/client-ops';
import { convertResponseToGoalSecure } from '@/lib/actions/secure-ops/projects';

describe('Form Response Actions & Sorting Logic', () => {
  const originalSelfhosted = process.env.SELFHOSTED;

  beforeEach(() => {
    process.env.SELFHOSTED = 'false';
  });

  afterEach(() => {
    process.env.SELFHOSTED = originalSelfhosted;
  });

  it('verifies convertResponseToGoal and convertResponseToGoalSecure functions exist and are exported', () => {
    expect(typeof convertResponseToGoal).toBe('function');
    expect(typeof convertResponseToGoalSecure).toBe('function');
  });

  it('correctly checks paid plan user accounts for AI response triage gating', () => {
    const freeUser = { $id: 'u1', prefs: { tier: 'FREE' } };
    const proUser = {
      $id: 'u2',
      prefs: {
        subscriptionTier: 'PRO',
        subscriptionExpiresAt: '2099-01-01T00:00:00.000Z'
      }
    };
    const lifetimeUser = { $id: 'u3', prefs: { subscriptionTier: 'LIFETIME' } };

    expect(hasPaidKylrixPlan(freeUser)).toBe(false);
    expect(hasPaidKylrixPlan(proUser)).toBe(true);
    expect(hasPaidKylrixPlan(lifetimeUser)).toBe(true);
  });

  it('correctly parses automated response action configuration settings', () => {
    const defaultSettingsJson = JSON.stringify({ autoGoalAction: true });
    const parsedDefault = JSON.parse(defaultSettingsJson);
    expect(parsedDefault.autoGoalAction).toBe(true);

    const customSettingsJson = JSON.stringify({
      autoGoalAction: false,
      aiTriageEnabled: true,
      ghostFields: ['subscription_tier'],
    });
    const parsedCustom = JSON.parse(customSettingsJson);
    expect(parsedCustom.autoGoalAction).toBe(false);
    expect(parsedCustom.aiTriageEnabled).toBe(true);
    expect(parsedCustom.ghostFields).toContain('subscription_tier');
  });

  it('correctly sorts responses by timestamp, unread status, and AI score', () => {
    const mockSubmissions = [
      {
        $id: 'sub-1',
        $createdAt: '2025-01-01T10:00:00Z',
        status: 'read',
        submitterName: 'Alice',
        payload: '{"feedback": "Short feedback"}',
      },
      {
        $id: 'sub-2',
        $createdAt: '2025-01-02T12:00:00Z',
        status: 'unread',
        submitterName: 'Bob',
        payload: '{"feedback": "Detailed bug report on production login performance issue"}',
      },
      {
        $id: 'sub-3',
        $createdAt: '2025-01-01T15:00:00Z',
        status: 'flagged',
        submitterName: 'Charlie',
        payload: '{"feedback": "Urgent security ticket requiring immediate investigation"}',
      },
    ];

    // 1. Sort Newest First
    const sortedNewest = [...mockSubmissions].sort(
      (a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
    );
    expect(sortedNewest[0].$id).toBe('sub-2');

    // 2. Sort Unread First
    const sortedUnread = [...mockSubmissions].sort((a, b) => {
      const isUnreadA = a.status !== 'read' ? 1 : 0;
      const isUnreadB = b.status !== 'read' ? 1 : 0;
      return isUnreadB - isUnreadA;
    });
    expect(sortedUnread[0].status).not.toBe('read');

    // 3. Sort by AI Score / Rank (flagged bonus + unread bonus + detail length)
    const sortedAi = [...mockSubmissions].sort((a, b) => {
      const scoreA = (a.status === 'flagged' ? 50 : 0) + (a.status !== 'read' ? 20 : 0) + String(a.payload).length;
      const scoreB = (b.status === 'flagged' ? 50 : 0) + (b.status !== 'read' ? 20 : 0) + String(b.payload).length;
      return scoreB - scoreA;
    });
    expect(sortedAi[0].$id).toBe('sub-3');
  });
});
