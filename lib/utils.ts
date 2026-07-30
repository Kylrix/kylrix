// Utility helpers

import {
  effectiveTierHasPaidAccess,
  getOpenSuiteEntitlement,
  isSelfHostedDeployment,
  resolveEffectiveBillingTier} from '@/lib/entitlements';
import { maxBillingUiTier, type BillingUiTier } from '@/lib/subscription/tier-resolution';
import { BillingCacheService } from '@/lib/services/billing';

// Safely get a user field preferring top-level value, then legacy prefs
// Example: getUserField(user, 'profilePicId') will return user.profilePicId || user.prefs?.profilePicId
function getUserField<T = any>(user: any, field: string): T | null {
  if (!user) return null;
  if (user && Object.prototype.hasOwnProperty.call(user, field) && user[field] !== undefined && user[field] !== null) {
    return user[field] as T;
  }
  const prefs = user.prefs || {};
  if (prefs && Object.prototype.hasOwnProperty.call(prefs, field) && prefs[field] !== undefined && prefs[field] !== null) {
    return prefs[field] as T;
  }
  return null;
}

export function toLocalDateInputString(date: Date | string | null | undefined): string {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convenience accessor for profile picture id
export function getUserProfilePicId(user: any): string | null {
  return getUserField<string>(user, 'avatar') || getUserField<string>(user, 'profilePicId');
}

// Convenience accessor for auth method

// Convenience accessor for wallet address (checks both walletEth and walletAddress)

/**
 * Client-side tier for paywalls (`subscriptionExpiresAt`-aware; never trusts `tier`/`subscriptionTier`
 * alone for PRO unless expiry is valid).
 */
export function getUserSubscriptionTier(user: any): string {
  if (isSelfHostedDeployment()) {
    return getOpenSuiteEntitlement().uiTier;
  }

  if (!user) return 'FREE';

  let cacheTier: BillingUiTier | null = null;
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(`kylrix_entitlement_${user.$id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.expiresAt) {
          const end = new Date(parsed.expiresAt);
          if (end > new Date()) {
            cacheTier = String(parsed.uiTier || 'FREE').toUpperCase() as BillingUiTier;
          }
        } else if (parsed.active && (parsed.uiTier === 'PRO' || parsed.uiTier === 'TEAMS' || parsed.uiTier === 'LIFETIME' || parsed.uiTier === 'ORG')) {
          cacheTier = parsed.uiTier as BillingUiTier;
        }
      } catch {}
    }
  }

  const prefsTier = user.prefs ? resolveEffectiveBillingTier(user.prefs) : 'FREE';
  return maxBillingUiTier(cacheTier || 'FREE', prefsTier);
}

/** Prefer this over comparing to PRO only — includes ORG/LIFETIME. Self-hosted always true. */
export function hasPaidKylrixPlan(user: any): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  return effectiveTierHasPaidAccess(getUserSubscriptionTier(user));
}

const TEAMS_TIERS = new Set(['TEAMS', 'ORG', 'LIFETIME']);

function cachedEntitlementGrantsTeams(
  ent: { uiTier?: string; active?: boolean; expiresAt?: string | null }): boolean {
  const tier = String(ent.uiTier || 'FREE').trim().toUpperCase();
  if (!TEAMS_TIERS.has(tier)) return false;
  if (ent.expiresAt) {
    const end = new Date(ent.expiresAt);
    return !Number.isNaN(end.getTime()) && end > new Date();
  }
  return ent.active !== false;
}

/** Project collaboration, group channels, and team workspaces require Teams (or higher). */
export function hasTeamsKylrixPlan(
  user: any,
  subscriptionTier?: string | null): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  if (subscriptionTier && TEAMS_TIERS.has(String(subscriptionTier).trim().toUpperCase())) {
    return true;
  }
  if (user?.$id && typeof window !== 'undefined') {
    const peeked = BillingCacheService.peekEntitlement(user.$id);
    if (peeked && cachedEntitlementGrantsTeams(peeked)) {
      return true;
    }
  }
  if (TEAMS_TIERS.has(getUserSubscriptionTier(user))) {
    return true;
  }
  if (user?.prefs) {
    const prefsTier = resolveEffectiveBillingTier(user.prefs);
    if (TEAMS_TIERS.has(prefsTier)) {
      return true;
    }
  }
  return false;
}

/** Paid access from subscription context and/or user prefs/cache. */
export function hasEffectivePaidAccess(user: any, subscriptionTier?: string | null): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  if (subscriptionTier && effectiveTierHasPaidAccess(subscriptionTier)) {
    return true;
  }
  return hasPaidKylrixPlan(user);
}


// Get list of OAuth identity providers connected to the account

// Check if user has a wallet connected

// Format bytes into human readable size (B, KB, MB, GB)

/**
 * Identity helpers for "on-the-fly" username canonization.
 * Prioritizes username, then displayName, then the basic Appwrite account name.
 * Reduces "Unknown" occurrences as the app scales.
 */
export function getEffectiveDisplayName(user: any): string {
  if (!user) return 'Unknown';
  return user.displayName || user.username || user.name || (user.email ? user.email.split('@')[0] : 'Unknown');
}

export function getEffectiveUsername(user: any): string | null {
  if (!user) return null;
  // Prioritize global ecosystem username from preferences
  const raw = user.prefs?.username || user.username || user.displayName || user.name;
  if (!raw) return null;
  // Fast "canonization" into a username-safe string if it's just a name
  return raw.toString().toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
}

// Clear stale session cookies to prevent overlapping session identity bugs
export function clearStatelessSessions() {
  try {
    document.cookie = "kylrix_pulse_v2=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
    document.cookie.split(";").forEach((cookie) => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      if (name.startsWith("a_session_")) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
        const domain = window.location.hostname;
        document.cookie = `${name}=; path=/; domain=${domain}; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
      }
    });
    sessionStorage.clear();
  } catch (e) {
    console.warn("Stateless cleanup warning:", e);
  }
}
