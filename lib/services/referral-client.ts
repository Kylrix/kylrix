const COOKIE_NAME = 'attribution_payload';

function clearAttributionCookie() {
  if (typeof document === 'undefined') return;
  const secureStr = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'Secure; ' : '';
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${secureStr}SameSite=Lax`;
}

function readAttributionPayload(): { ref: string; src?: string; origin?: string; timestamp?: number } | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)attribution_payload=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    let raw = match[1];
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
    const { claimReferralAction } = await import('@/lib/actions/referrals');
    const res = await claimReferralAction(payload);

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
    return { attempted: true, ok: false, error: err?.message || 'Claim failed' };
  }
}
