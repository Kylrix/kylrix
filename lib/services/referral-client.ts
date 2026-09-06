/**
 * Client-side referral claim from attribution_payload cookie.
 * Works for new and existing accounts; table uniqueness enforces one referral per user.
 */

const COOKIE_NAME = 'attribution_payload';

function clearAttributionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

function readAttributionPayload(): { ref: string; src?: string; origin?: string; timestamp?: number } | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)attribution_payload=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    let raw = match[1];
    // Cookie may be URI-encoded once (middleware) or twice in some browsers
    try {
      raw = decodeURIComponent(raw);
    } catch {}
    try {
      if (raw.includes('%')) raw = decodeURIComponent(raw);
    } catch {}
    const json = atob(raw);
    const payload = JSON.parse(json);
    if (!payload?.ref) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Claim pending referral for the signed-in user.
 * Clears cookie only when claim is terminal (success, already referred, invalid, self).
 */
export async function claimPendingReferralAttribution(): Promise<{
  attempted: boolean;
  ok?: boolean;
  alreadyReferred?: boolean;
  rewarded?: boolean;
  error?: string;
}> {
  const payload = readAttributionPayload();
  if (!payload?.ref) return { attempted: false };

  try {
    const { account } = await import('@/lib/appwrite/client');
    const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
    const { claimReferralAction } = await import('@/lib/actions/referrals');
    const res = await claimReferralAction(payload, jwt);

    const terminal =
      res.ok === true ||
      res.alreadyReferred === true ||
      /self-referral|invalid referrer|missing/i.test(String(res.error || ''));

    if (terminal) clearAttributionCookie();

    return {
      attempted: true,
      ok: res.ok,
      alreadyReferred: res.alreadyReferred,
      rewarded: res.rewarded,
      error: res.error,
    };
  } catch (err: any) {
    // Keep cookie for a later retry (session may still be warming)
    return { attempted: true, ok: false, error: err?.message || 'Claim failed' };
  }
}
