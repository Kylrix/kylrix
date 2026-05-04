export interface SubscriptionRow {
  $id: string;
  status?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  plan?: string | null;
  userId?: string | null;
}

function toTime(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function pickLatestSubscription(rows: SubscriptionRow[], preferredStatus = 'active') {
  if (!rows.length) return null;

  return [...rows].sort((a, b) => {
    const aPreferred = String(a.status || '').toLowerCase() === preferredStatus ? 1 : 0;
    const bPreferred = String(b.status || '').toLowerCase() === preferredStatus ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;

    const byPeriodEnd = toTime(b.currentPeriodEnd) - toTime(a.currentPeriodEnd);
    if (byPeriodEnd !== 0) return byPeriodEnd;

    const byUpdatedAt = toTime(b.updatedAt) - toTime(a.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;

    const byCreatedAt = toTime(b.createdAt) - toTime(a.createdAt);
    if (byCreatedAt !== 0) return byCreatedAt;

    return b.$id.localeCompare(a.$id);
  })[0] || null;
}

export function getSubscriptionExpiryHint(rows: SubscriptionRow[]) {
  const latest = pickLatestSubscription(rows);
  return latest?.currentPeriodEnd || null;
}
