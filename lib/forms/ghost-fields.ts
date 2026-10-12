/**
 * Modular Ghost Fields Registry & Telemetry Resolver
 *
 * Ghost fields allow a form creator to collect account/system telemetry automatically
 * when a user submits a form (e.g., account subscription status, 2FA status, client info)
 * without requiring the user to manually enter them.
 */

export interface GhostFieldDefinition {
  id: string;
  label: string;
  description: string;
  category: 'account' | 'security' | 'environment';
  resolve: (user: any) => Promise<any> | any;
}

/**
 * Modular Registry of Ghost Fields available to all forms.
 * New ghost fields can be added or removed modularly here.
 */
export const GHOST_FIELDS_REGISTRY: Record<string, GhostFieldDefinition> = {
  subscription_tier: {
    id: 'subscription_tier',
    label: 'Account Subscription Status',
    description: 'Current subscription plan tier (e.g. Free, Contributor, Pro, Team, Lifetime) to help prioritize support/bug triage.',
    category: 'account',
    resolve: async (user: any) => {
      if (!user) return 'Anonymous / Guest';
      const prefs = user.prefs || {};
      const directTier = prefs.currentTier || prefs.tier;
      if (directTier && String(directTier).toUpperCase() === 'CONTRIBUTOR') {
        return 'CONTRIBUTOR';
      }

      if (user.isContributor || user.contributorStatus) {
        return 'CONTRIBUTOR';
      }

      // Dynamically resolve rolling contributor status if free or unspecified
      if (!directTier || String(directTier).toUpperCase() === 'FREE') {
        try {
          const uid = user.$id || user.id;
          if (uid) {
            const { verifyAndApplyContributorStatus } = await import('@/lib/actions/contributor-ops');
            const contrib = await verifyAndApplyContributorStatus(uid).catch(() => null);
            if (contrib?.isContributor) {
              return 'CONTRIBUTOR';
            }
          }
          const username = user.name || user.username || prefs.username;
          if (username) {
            const { getContributorStatusByUsernameAction } = await import('@/lib/actions/contributor-ops');
            const res = await getContributorStatusByUsernameAction(username).catch(() => null);
            if (res?.isContributor) {
              return 'CONTRIBUTOR';
            }
          }
        } catch {}
      }

      const tier = directTier || (user.isPro ? 'Pro' : 'Free');
      return String(tier).toUpperCase();
    },
  },
  contributor_status: {
    id: 'contributor_status',
    label: 'Contributor Tier & Priority',
    description: 'Dynamic detection of active contributor tier (merged PR in last 30 days) to escalate issues to high priority and consider for roadmap/todo.',
    category: 'account',
    resolve: async (user: any) => {
      if (!user) return 'Not a contributor';
      const prefs = user.prefs || {};
      if (prefs.currentTier === 'CONTRIBUTOR' || prefs.tier === 'CONTRIBUTOR' || user.isContributor) {
        return 'Active Contributor (High Priority)';
      }
      try {
        const uid = user.$id || user.id;
        if (uid) {
          const { verifyAndApplyContributorStatus } = await import('@/lib/actions/contributor-ops');
          const contrib = await verifyAndApplyContributorStatus(uid).catch(() => null);
          if (contrib?.isContributor) {
            return `Active Contributor (${contrib.prCount} merged PRs · High Priority)`;
          }
        }
        const username = user.name || user.username || prefs.username;
        if (username) {
          const { getContributorStatusByUsernameAction } = await import('@/lib/actions/contributor-ops');
          const res = await getContributorStatusByUsernameAction(username).catch(() => null);
          if (res?.isContributor) {
            return `Active Contributor (${res.prCount || 1} merged PRs · High Priority)`;
          }
        }
      } catch {}
      return 'Regular User';
    },
  },
  mfa_status: {
    id: 'mfa_status',
    label: 'Account Security (2FA) Status',
    description: 'Indicates whether Two-Factor Authentication (MFA/2FA) or Passkeys are enabled on your account.',
    category: 'security',
    resolve: (user: any) => {
      if (!user) return 'N/A (Guest)';
      const mfaEnabled = Boolean(user.mfa || user.prefs?.mfaEnabled || user.mfaEnabled);
      return mfaEnabled ? 'Enabled' : 'Disabled';
    },
  },
  client_environment: {
    id: 'client_environment',
    label: 'Device & Browser Environment',
    description: 'Operating system and browser version details useful for reproducing reported bugs.',
    category: 'environment',
    resolve: () => {
      if (typeof window === 'undefined') return 'Server-Side Context';
      const ua = navigator.userAgent || '';
      const platform = (navigator as any).userAgentData?.platform || navigator.platform || 'Unknown OS';
      return {
        platform,
        userAgent: ua,
        screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      };
    },
  },
  user_locale: {
    id: 'user_locale',
    label: 'Timezone & Regional Locale',
    description: 'System timezone and preferred language settings.',
    category: 'environment',
    resolve: () => {
      if (typeof window === 'undefined') return 'UTC';
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const language = navigator.language || 'en';
      return { timeZone, language };
    },
  },
  identity_id: {
    id: 'identity_id',
    label: 'Account Reference Identifier',
    description: 'Unique account identifier to link bug reports directly to your account session.',
    category: 'account',
    resolve: (user: any) => {
      if (!user) return 'Anonymous';
      return user.$id || user.id || 'Unknown';
    },
  },
};

/**
 * Extract list of enabled ghost field IDs from form settings safely.
 */
export function getEnabledGhostFields(formSettings: string | Record<string, any> | null | undefined): string[] {
  if (!formSettings) return [];
  let parsed: Record<string, any> = {};
  if (typeof formSettings === 'string') {
    try {
      parsed = JSON.parse(formSettings);
    } catch (_e) {
      return [];
    }
  } else if (typeof formSettings === 'object') {
    parsed = formSettings;
  }
  return Array.isArray(parsed.ghostFields) ? parsed.ghostFields.filter((id) => typeof id === 'string' && id in GHOST_FIELDS_REGISTRY) : [];
}

/**
 * Resolve telemetry data for enabled ghost fields during form submission.
 */
export async function resolveGhostFields(
  enabledKeys: string[],
  user: any
): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  for (const key of enabledKeys) {
    const fieldDef = GHOST_FIELDS_REGISTRY[key];
    if (fieldDef) {
      try {
        result[key] = await fieldDef.resolve(user);
      } catch (err) {
        console.warn(`[GhostFields] Failed to resolve telemetry for ${key}:`, err);
        result[key] = 'Error resolving telemetry';
      }
    }
  }
  return result;
}
