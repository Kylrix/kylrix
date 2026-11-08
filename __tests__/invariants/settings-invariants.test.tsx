import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ConnectedIdentities from '@/components/ConnectedIdentities';

let mockIdentitiesList: any[] = [];
let mockExternalsList: any[] = [];

vi.mock('@/lib/actions/user-settings', () => ({
  listUserIdentitiesAction: vi.fn(async () => ({
    success: true,
    identities: mockIdentitiesList,
    externals: mockExternalsList,
  })),
  unlinkUserIdentityAction: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/auth/better-auth-client', () => ({
  authClient: {
    signIn: {
      social: vi.fn(async () => {}),
    },
  },
}));

vi.mock('@/components/settings/CloudSyncSection', () => ({
  CloudSyncSection: () => <div data-testid="cloud-sync-mock">CloudSyncSection</div>,
}));

describe('Settings & Connected Apps Invariants (settings-invariants.test.tsx)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    mockIdentitiesList = [];
    mockExternalsList = [];
    vi.clearAllMocks();
  });

  describe('OAuth Identity Invariant: identityFor', () => {
    it('renders "Connected" or provider UID when provider row exists without email attribute, never falling back to "Not connected"', async () => {
      // Scenario: GitHub account linked via OAuth provider where provider_id = 'github'
      // but providerEmail is null or undefined (e.g. user has private GitHub email or only providerUid)
      mockIdentitiesList = [
        {
          $id: 'ident_gh_123',
          $createdAt: new Date().toISOString(),
          provider: 'github',
          providerUid: 'octocat_gh_id_9999',
          providerEmail: undefined, // Intentionally missing email
        },
      ];

      const root = createRoot(container);
      await act(async () => {
        root.render(<ConnectedIdentities />);
      });

      // Wait a tick for useEffect / refresh
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      const text = container.textContent || '';

      // Invariant: GitHub must show as connected (with UID or Connected label)
      expect(text).toContain('GitHub');
      expect(text).toContain('ID: octocat_gh_id_9999');
      // Invariant: GitHub button must render "Disconnect", NOT "Connect"
      const allDivs = Array.from(container.querySelectorAll('div'));
      const ghRow = allDivs.find((el) =>
        el.textContent?.includes('GitHub') &&
        el.textContent?.includes('octocat_gh_id_9999') &&
        !el.textContent?.includes('Google')
      );
      expect(ghRow).toBeDefined();
      expect(ghRow?.textContent).toContain('Disconnect');
      expect(ghRow?.textContent).not.toContain('Not connected');

      // Google was not linked, so it should show "Not connected" and "Connect"
      expect(text).toContain('Google');
      expect(text).toContain('Not connected');

      root.unmount();
      container.remove();
    });

    it('renders "Connected" fallback when neither providerEmail nor providerUid are present on identity', async () => {
      mockIdentitiesList = [
        {
          $id: 'ident_goog_456',
          $createdAt: new Date().toISOString(),
          provider: 'google',
          providerUid: undefined,
          providerEmail: undefined,
        },
      ];

      const root = createRoot(container);
      await act(async () => {
        root.render(<ConnectedIdentities />);
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      const text = container.textContent || '';
      expect(text).toContain('Google');
      expect(text).toContain('Connected');

      const googRow = Array.from(container.querySelectorAll('div')).find((el) =>
        el.textContent?.includes('Google') && el.textContent?.includes('Connected')
      );
      expect(googRow).toBeDefined();
      expect(googRow?.textContent).toContain('Disconnect');

      root.unmount();
      container.remove();
    });
  });
});
