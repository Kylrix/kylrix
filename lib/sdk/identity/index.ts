/**
 * Shared identity helpers.
 * Normalizes profile data and avatar source resolution across apps.
 */

export interface IdentitySignals {
  createdAt?: string | null;
  lastUsernameEdit?: string | null;
  profilePicId?: string | null;
  username?: string | null;
  bio?: string | null;
  tier?: string | null;
  publicKey?: string | null;
  emailVerified?: boolean | null;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function normalizeUsername(value?: string | null) {
  return String(value || '').replace(/^@+/, '').trim().toLowerCase() || null;
}

export function getUserProfilePicId(user: any): string | null {
  return (
    user?.avatarFileId ||
    user?.avatarUrl ||
    user?.profilePicId ||
    user?.avatar ||
    user?.prefs?.profilePicId ||
    user?.preferences?.profilePicId ||
    null
  );
}

export function computeIdentityFlags(signals: IdentitySignals) {
  const createdAt = signals.createdAt ? new Date(signals.createdAt).getTime() : NaN;
  const lastUsernameEdit = signals.lastUsernameEdit ? new Date(signals.lastUsernameEdit).getTime() : NaN;
  const hasAge = Number.isFinite(createdAt) ? Date.now() - createdAt >= THIRTY_DAYS : false;
  const hasStableUsername = !Number.isFinite(lastUsernameEdit) || Date.now() - lastUsernameEdit >= THIRTY_DAYS;
  const hasCoreProfile = Boolean(signals.username?.trim() && signals.bio?.trim() && signals.profilePicId);
  const verified = hasAge && hasStableUsername && hasCoreProfile;
  const pro = String(signals.tier || '').toUpperCase() === 'PRO';
  return { verified, pro };
}

export function shortenUserId(userId?: string | null) {
  if (!userId) return 'local';
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 6)}…${userId.slice(-4)}`;
}

export function buildDisplayName(user: any) {
  return user?.displayName || user?.name || user?.username || user?.email || 'Profile';
}
