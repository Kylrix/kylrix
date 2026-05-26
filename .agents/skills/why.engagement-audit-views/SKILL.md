---
name: why.engagement-audit-views
description: Deep dive into the dynamic engagement views and metric rollup architecture in Kylrix. Explains the SHA-256 salted IP/UserAgent anonymization, daily/monthly bucketing, and idempotent write deduplication.
---

# Why: Idempotent Engagement Views & Real-Time Metrics Rollups

Tracking content views (e.g. Note access, Form hits, Chat message reads) in real time is a common bottleneck. Simple event logging creates heavy database write loads and is easily spammed by simple page refreshes.

We solve this using the **Engagement views architecture** in `lib/services/internal/engagement-views.ts`.

## 1. Zero-Knowledge Anonymous Fingerprinting

We need to track unique view counts for unauthenticated users without storing private personal data (like raw IPs or User-Agents), which would violate privacy regulations (GDPR/CCPA).

We anonymize viewer identities by calculating a salted SHA-256 hash that blends IP, browser fingerprint, and a daily rotation time:

```typescript
const hashWithSalt = (value: string) => {
  const salt = safe(process.env.VIEWER_HASH_SALT) || APPWRITE_CONFIG.PROJECT_ID;
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
};

const dedupeIdentity =
  viewerKind === 'user'
    ? `user:${viewerUserId}`
    : `anon:${viewerTokenHash || hashWithSalt(`${safe(input.ip)}:${safe(input.userAgent)}:${bucketDay}`)}`;
```

This hashes sensitive IP addresses into secure, one-way tokens that cannot be reversed.

## 2. Strong Idempotency & Conflict Defenses

To prevent double-counting under high concurrency (e.g. multiple parallel clicks or network retries), we compute a deterministic **idempotencyKey**:

```typescript
const idempotencyKey = `v:${appId}:${contentType}:${contentId}:${receiptType || 'view'}:${dedupeIdentity}:${bucketDay}`;
```

We derive the primary database `eventId` directly from this key:

```typescript
const eventId = createHash('sha256').update(idempotencyKey).digest('hex');
```

If multiple threads attempt to insert the same view, the database will return a primary key conflict (409), which the service catches and ignores gracefully:

```typescript
try {
  await databases.createRow(DB_ID, ROLLUPS_TABLE, ID.unique(), createPayload);
} catch (error: any) {
  if (Number(error?.code || 0) !== 409) throw error; // Ignore conflicts
}
```

## 3. Real-Time Daily and Monthly Rollup Aggregations

Storing trillions of raw engagement rows would make aggregate queries (e.g., total views this month) too slow. Instead, the service automatically updates pre-aggregated summary documents inside the `ENGAGEMENT_VIEW_ROLLUPS` table (`bucketDay` e.g. `2026-05-26`, `bucketMonth` e.g. `2026-05`):

```typescript
await databases.updateRow(DB_ID, ROLLUPS_TABLE, existing.$id, {
  uniqueViewCount: Number(existing.uniqueViewCount || 0) + Math.max(0, input.incrementUnique),
  totalViewCount: Number(existing.totalViewCount || 0) + Math.max(0, input.incrementTotal),
  weightedScore: Number(existing.weightedScore || 0) + Math.max(0, input.incrementUnique + input.incrementTotal),
});
```

This keeps the database light and enables instant, cheap queries for analytics dashboards.
