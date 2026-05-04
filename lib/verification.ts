import { KeychainService } from '@/lib/appwrite/keychain';
import { UsersService } from '@/lib/services/users';
import { seedIdentityCache } from '@/lib/identity-cache';

export type VerificationState = {
  verified: boolean;
  verifiedOn: string | null;
  checkedAt: string | null;
  method: string | null;
  source: string | null;
};

type PreferencesLike = string | Record<string, any> | null | undefined;

function parsePreferences(preferences: PreferencesLike): Record<string, any> {
  if (!preferences) return {};
  if (typeof preferences === 'object') return preferences;
  try {
    return JSON.parse(preferences);
  } catch {
    return {};
  }
}

function toVerificationState(input: any): VerificationState {
  if (!input || typeof input !== 'object') {
    return {
      verified: false,
      verifiedOn: null,
      checkedAt: null,
      method: null,
      source: null,
    };
  }

  return {
    verified: Boolean(input.verified),
    verifiedOn: typeof input.verifiedOn === 'string' && input.verifiedOn ? input.verifiedOn : null,
    checkedAt: typeof input.checkedAt === 'string' && input.checkedAt ? input.checkedAt : null,
    method: typeof input.method === 'string' && input.method ? input.method : null,
    source: typeof input.source === 'string' && input.source ? input.source : null,
  };
}

export function getVerificationState(preferences: PreferencesLike): VerificationState {
  const parsed = parsePreferences(preferences);
  return toVerificationState(parsed.verification);
}

export function formatVerificationTooltip(verification: VerificationState): string {
  if (verification.verified) {
    const verifiedOn = verification.verifiedOn || verification.checkedAt;
    return verifiedOn ? `Verified on ${new Date(verifiedOn).toLocaleString()}` : 'Verified';
  }

  return verification.checkedAt
    ? `Last checked ${new Date(verification.checkedAt).toLocaleString()}`
    : 'Verification not available';
}

export function mergeVerificationPreferences(
  preferences: PreferencesLike,
  verification: Partial<VerificationState>,
) {
  const parsed = parsePreferences(preferences);
  const existing = toVerificationState(parsed.verification);
  const checkedAt = verification.checkedAt || new Date().toISOString();
  const verified = Boolean(verification.verified);

  parsed.verification = {
    ...existing,
    ...verification,
    verified,
    checkedAt,
    verifiedOn: verified ? (verification.verifiedOn || existing.verifiedOn || checkedAt) : (existing.verifiedOn || null),
    method: verification.method || existing.method || 'masterpass',
    source: verification.source || existing.source || 'connect',
  };

  return parsed;
}

export function buildSafetyWarning(senderName: string) {
  return `First message from ${senderName}. Kylrix will never ask for passwords, codes, or private details.`;
}

export async function syncCurrentUserVerification(userId: string) {
  if (!userId) return null;

  try {
    const [profile, hasMasterpass] = await Promise.all([
      UsersService.getProfileById(userId),
      KeychainService.hasMasterpass(userId).catch(() => false),
    ]);

    const nextPrefs = mergeVerificationPreferences(profile?.preferences || null, {
      verified: hasMasterpass,
      checkedAt: new Date().toISOString(),
      method: 'masterpass',
      source: 'connect',
    });

    const updated = await UsersService.updateProfile(userId, {
      preferences: JSON.stringify(nextPrefs),
    });

    if (updated) {
      seedIdentityCache(updated);
    }

    return updated || null;
  } catch (error) {
    console.warn('[Verification] Failed to sync current user verification:', error);
    return null;
  }
}
