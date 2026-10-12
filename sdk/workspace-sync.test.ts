import { describe, it, expect, vi } from 'vitest';
import { effectiveTierHasPaidAccess } from '@/lib/entitlements';
import { billingTierHasPaidAccess } from '@/lib/subscription/tier-resolution';

describe('Workspace Active State Sync Entitlements', () => {
  it('identifies paid tier accounts as having paid access for active workspace sync', () => {
    expect(billingTierHasPaidAccess('PRO')).toBe(true);
    expect(billingTierHasPaidAccess('TEAMS')).toBe(true);
    expect(billingTierHasPaidAccess('ORG')).toBe(true);
    expect(billingTierHasPaidAccess('LIFETIME')).toBe(true);
  });

  it('identifies free tier accounts on cloud as not having paid sync access', () => {
    expect(billingTierHasPaidAccess('FREE')).toBe(false);
    expect(billingTierHasPaidAccess('')).toBe(false);
  });

  it('correctly conditionally syncs active workspace ID depending on entitlement status', () => {
    const updatePreferencesMock = vi.fn();
    const handleWorkspaceChange = (tier: string | undefined, newWorkspaceId: string) => {
      if (effectiveTierHasPaidAccess(tier)) {
        updatePreferencesMock({ activeWorkspaceId: newWorkspaceId });
      }
    };

    // Free tier: should NOT invoke remote preferences update
    handleWorkspaceChange('FREE', 'ws_123');
    expect(updatePreferencesMock).not.toHaveBeenCalled();

    // Paid tier: SHOULD invoke remote preferences update
    handleWorkspaceChange('PRO', 'ws_123');
    expect(updatePreferencesMock).toHaveBeenCalledWith({ activeWorkspaceId: 'ws_123' });
  });
});
