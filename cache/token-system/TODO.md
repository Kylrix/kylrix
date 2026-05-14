# KYLRIX Token System: Implementation TODO

## Phase 1: Activity Types & Contract Enhancement

### T1-1: Extend `KylrixActivityType` enum
**File:** `lib/sdk/token/contract.ts`

**Change:** Add new activity types to support all reward categories.

```typescript
// Lines 11-17: Replace current enum
export type KylrixActivityType =
  | 'note_view'
  | 'note_create'
  | 'share_public_note_moment'
  | 'chat_message'
  | 'call_initiate'
  | 'call_participate'
  | 'comment_add'
  | 'group_chat_create'
  | 'first_reply_to_stranger'
  | 'referral_signup'
  | 'referral_engagement_30d'
  | 'content_featured'
  | 'daily_login'
  | 'moderation';
```

### T1-2: Update `ACTIVITY_BASE_REWARD_MICRO` with new weights
**File:** `lib/sdk/token/contract.ts`

**Change:** Lines 73-80, expand reward table.

```typescript
const ACTIVITY_BASE_REWARD_MICRO: Record<KylrixActivityType, bigint> = {
  daily_login: 50_000n,          // 0.05
  note_view: 25_000n,            // 0.025
  note_create: 80_000n,          // 0.08
  share_public_note_moment: 650_000n,  // 0.65
  chat_message: 40_000n,         // 0.04
  call_initiate: 200_000n,       // 0.2
  call_participate: 150_000n,    // 0.15
  comment_add: 35_000n,          // 0.035
  group_chat_create: 120_000n,   // 0.12
  first_reply_to_stranger: 100_000n,   // 0.1
  referral_signup: 1_500_000n,   // 1.5
  referral_engagement_30d: 500_000n,   // 0.5
  content_featured: 300_000n,    // 0.3
  moderation: 120_000n,          // 0.12
};
```

### T1-3: Add thermal score calculation helper
**File:** `lib/sdk/token/contract.ts`

**Change:** Add new helper function inside `createKylrixTokenContract()`.

```typescript
  // After normalizeMicro and circulatingMicro helpers, add:
  const computeThermalScore = (recentEvents: any[]): number => {
    // recentEvents = last 5 mints for the user
    if (!recentEvents || recentEvents.length === 0) return 0;
    
    let thermal = 0;
    const now = Date.now();
    for (const evt of recentEvents) {
      const ageMs = now - new Date(evt.createdAt).getTime();
      const ageSecs = Math.max(1, ageMs / 1000);
      // Exponential decay: e^(-t/3600) means 37% remaining after 1h
      thermal += Math.exp(-ageSecs / 3600);
    }
    return thermal; // 0 = cold, 5 = very hot
  };
```

### T1-4: Update `computeTightenBps()` with new factors
**File:** `lib/sdk/token/contract.ts`

**Change:** Lines 118-125, add thermal and activity-type penalties.

```typescript
  const computeTightenBps = (signal: KylrixActivitySignal, thermal: number) => {
    const spikePenalty = Math.min(policy.spikeTightenBps, Math.max(0, signal.recentSpikeFactorBps));
    const lowTrustPenalty = signal.trustScore < policy.reputationFloor ? 1500 : 0;
    const repeatPenalty = Math.min(5500, Math.max(0, (signal.recentActivityCount || 0) * 900));
    const thermalPenalty = Math.min(7000, Math.floor(thermal * 1500)); // New: -70% max if hot
    const ageBoost = signal.accountAgeDays >= 60 ? 800 : signal.accountAgeDays >= 14 ? 300 : 0;
    
    // Activity-specific penalties for low-friction activities (prevent spam)
    const activityPenalty = (
      signal.activityType === 'chat_message' ? 800 :
      signal.activityType === 'note_view' ? 600 :
      signal.activityType === 'daily_login' ? 200 :
      0
    );
    
    const tighten = clampBps(10_000 - spikePenalty - lowTrustPenalty - repeatPenalty - thermalPenalty - activityPenalty + ageBoost);
    return tighten;
  };
```

### T1-5: Add network-aware scaling to `decideMintForActivity()`
**File:** `lib/sdk/token/contract.ts`

**Change:** Lines 140-143, update network scaling logic.

```typescript
    const uniqueActorBoostBps = Math.min(8000, signal.uniqueActors * 120); // Slightly increase base boost
    const userBase = Math.max(1, signal.userBaseCount || 1);
    const networkScaleBps = 
      userBase <= 100 ? 4000 :      // Early: +40% bonus (attract first users)
      userBase <= 500 ? 2500 :      // Growth: +25% bonus
      userBase <= 5000 ? 1000 :     // Established: +10% bonus
      userBase <= 50000 ? -500 :    // Scale: -5% reduction
      -2000;                         // Mature: -20% reduction
```

### T1-6: Wire up thermal score in mint decision
**File:** `lib/sdk/token/contract.ts`

**Change:** Inside `decideMintForActivity()`, add thermal score lookup. Since contract can't query DB directly, accept it as signal input (see T2-2).

```typescript
  // Update KylrixActivitySignal interface (lines 34-42):
  export interface KylrixActivitySignal {
    activityType: KylrixActivityType;
    uniqueActors: number;
    trustScore: number;
    recentSpikeFactorBps: number;
    accountAgeDays: number;
    userBaseCount?: number;
    recentActivityCount?: number;
    thermalScore?: number;  // NEW: 0 to 5 (caller computes this)
  }

  // In decideMintForActivity, use it:
  const tightenBps = computeTightenBps(signal, signal.thermalScore || 0);
```

---

## Phase 2: Service Layer Updates

### T2-1: Add thermal score query to token service
**File:** `lib/services/internal/kylrix-token.ts`

**Change:** Add new helper function after `getUserDailyMinted()` (around line 200).

```typescript
async function getUserThermalScore(userId: string): Promise<number> {
  const recent = await listUserEventsDescending(userId, 5);
  if (!recent || recent.length === 0) return 0;
  
  let thermal = 0;
  const now = Date.now();
  for (const evt of recent) {
    const ageMs = now - new Date(evt.createdAt).getTime();
    const ageSecs = Math.max(1, ageMs / 1000);
    // Exponential decay: half-life = ~3600 seconds (1 hour)
    thermal += Math.exp(-ageSecs / 3600);
  }
  return thermal; // 0 = cold, 5 = very hot
}
```

### T2-2: Update `InternalKylrixTokenService.mintForActivity()` to compute signals
**File:** `lib/services/internal/kylrix-token.ts`

**Change:** Lines 360-376, enhance signal computation before contract call.

```typescript
  async mintForActivity(input: {
    userId: string;
    idempotencyKey: string;
    activityType: KylrixActivityType;
    uniqueActors: number;
    trustScore: number;
    sourceType: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
  }) {
    const state = await requireOrInitializeStateRow();
    const recentVolume = await getRecentSystemVolume(contract.policy.spikeWindowMinutes);
    const userDailyMinted = await getUserDailyMinted(input.userId);
    const [recentActivityCount, userBaseCount, thermalScore] = await Promise.all([
      getRecentUserMintActivityCount(input.userId, 24),
      getTotalUserCount(),
      getUserThermalScore(input.userId),  // NEW: Add thermal score
    ]);
    
    const signal: KylrixActivitySignal = {
      activityType: input.activityType,
      uniqueActors: input.uniqueActors,
      trustScore: input.trustScore,
      recentSpikeFactorBps: recentVolume >= contract.policy.spikeEventThreshold ? contract.policy.spikeTightenBps : 0,
      accountAgeDays: 0,
      recentActivityCount,
      userBaseCount,
      thermalScore,  // NEW: Pass thermal into contract
    };
    // ... rest of method unchanged
  }
```

### T2-3: Add hourly background job for user count caching
**File:** `lib/services/internal/kylrix-token.ts` (or new file `lib/services/internal/token-caching.ts`)

**Change:** Create new export for background jobs.

```typescript
// New helper to cache user count (call this via cron/scheduled task)
export async function refreshGlobalUserCountCache(): Promise<number> {
  const { users } = createAdminClient();
  try {
    const response = await users.list([Query.limit(1)]);
    const count = Math.max(1, Number(response.total || 1));
    // Store in memory or Redis-like cache
    globalUserCountCache = { value: count, expiresAt: Date.now() + 3600_000 }; // 1h TTL
    return count;
  } catch {
    return globalUserCountCache?.value || 1;
  }
}

// Update getTotalUserCount to use cache first
async function getTotalUserCount() {
  const cached = globalUserCountCache;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  return refreshGlobalUserCountCache();
}

// Define cache at module level
let globalUserCountCache: { value: number; expiresAt: number } | null = null;
```

---

## Phase 3: Activity Hooks

### T3-1: Hook `message_send` minting into chat creation
**File:** `lib/services/chat.ts`

**Change:** At message creation point (find `createMessage()` or equivalent), add call after message is saved.

```typescript
  // After successfully creating message in DB, add:
  if (message && message.$id) {
    try {
      await executeSecureAction('mint_activity', {
        userId: message.userId,
        idempotencyKey: `mint:message_send:${message.$id}`,
        activityType: 'chat_message',
        uniqueActors: 1,  // Can enhance with actual unique people in conversation
        trustScore: 75,   // Default for chat participants
        sourceType: 'message_send',
        sourceId: message.$id,
        metadata: { conversationId: message.conversationId },
      }).catch(err => console.warn('[Token] Message mint failed:', err));
    } catch {}
  }
```

### T3-2: Hook `call_participate` minting into call service
**File:** `lib/services/call.ts` (or `lib/services/internal/calls.ts`)

**Change:** After call duration is verified (≥5 min), mint for each participant.

```typescript
  // After call ends, iterate participants:
  async function processCallParticipants(callId: string, participants: string[], durationSecs: number) {
    if (durationSecs < 300) return; // <5 min, no reward
    
    for (const userId of participants) {
      try {
        await executeSecureAction('mint_activity', {
          userId,
          idempotencyKey: `mint:call_participate:${callId}:${userId}`,
          activityType: 'call_participate',
          uniqueActors: Math.max(1, participants.length - 1), // Exclude self
          trustScore: 80,
          sourceType: 'call_participate',
          sourceId: callId,
          metadata: { durationSecs, participantCount: participants.length },
        }).catch(err => console.warn('[Token] Call mint failed:', err));
      } catch {}
    }
  }
```

### T3-3: Hook `referral_signup` minting into user signup
**File:** `app/(auth)/signup/page.tsx` or signup action handler

**Change:** After user account created, check for pending referral and mint if valid.

```typescript
  // In signup completion handler (after user.create succeeds):
  if (referrerId && newUserId) {
    try {
      // Verify referrer exists and is trusted
      const referrer = await appwrite.users.get(referrerId).catch(() => null);
      if (referrer && (referrer.prefs?.['trust_score'] || 0) >= 20) {
        await executeSecureAction('mint_activity', {
          userId: referrerId,
          idempotencyKey: `mint:referral_signup:${referrerId}:${newUserId}:${Date.now()}`,
          activityType: 'referral_signup',
          uniqueActors: 1,
          trustScore: 85,
          sourceType: 'referral_signup',
          sourceId: newUserId,
          metadata: { newUserId, referrerId },
        }).catch(err => console.warn('[Token] Referral mint failed:', err));
      }
    } catch {}
  }
```

### T3-4: Hook `note_create` minting into note save
**File:** `lib/services/internal/notes.ts` (or wherever notes are created)

**Change:** After note is saved, mint if it's public or later made public.

```typescript
  // After successful note.create():
  if (note.$id && note.isPublic) {
    try {
      await executeSecureAction('mint_activity', {
        userId: note.userId,
        idempotencyKey: `mint:note_create:${note.$id}`,
        activityType: 'note_create',
        uniqueActors: 1,
        trustScore: 75,
        sourceType: 'note_create',
        sourceId: note.$id,
        metadata: { noteTitle: note.title },
      }).catch(err => console.warn('[Token] Note create mint failed:', err));
    } catch {}
  }
```

### T3-5: Hook `daily_login` minting on app load
**File:** `components/GlobalShell.tsx` or auth context initialization

**Change:** Check if user has already minted today, if not, mint once per 24h.

```typescript
  // On app load or auth refresh:
  async function ensureDailyLoginMint() {
    if (!user?.user_id) return;
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayKey = today.toISOString();
    
    const lastLogin = localStorage.getItem('kylrix_last_login_mint');
    if (lastLogin === todayKey) return; // Already minted today
    
    try {
      await executeSecureAction('mint_activity', {
        userId: user.user_id,
        idempotencyKey: `mint:daily_login:${todayKey}:${user.user_id}`,
        activityType: 'daily_login',
        uniqueActors: 1,
        trustScore: 70,
        sourceType: 'daily_login',
        sourceId: todayKey,
      }).catch(err => console.warn('[Token] Daily login mint failed:', err));
      
      localStorage.setItem('kylrix_last_login_mint', todayKey);
    } catch {}
  }
```

---

## Phase 4: Activity Rate Limiting & Anti-Spam

### T4-1: Add rate limit checks in `executeSecureAction()`
**File:** `lib/actions/secure-ops.ts`

**Change:** Before minting, check activity-specific hard caps.

```typescript
  // New helper at top of file:
  async function checkActivityRateLimit(userId: string, activityType: string): Promise<boolean> {
    const key = `activity_limit:${userId}:${activityType}`;
    const now = Date.now();
    
    // Store in-memory rate limit tracking (replace with Redis for production)
    const limits: Record<string, { count: number; resetAt: number }> = {};
    let tracker = limits[key];
    if (!tracker || tracker.resetAt < now) {
      tracker = limits[key] = { count: 0, resetAt: now + 3600_000 }; // 1h window
    }
    
    const maxPerHour = {
      'chat_message': 100,
      'note_create': 10,
      'call_initiate': 5,
      'comment_add': 50,
      'daily_login': 2,  // Allow retries
      'referral_signup': 100, // Per month (relax per-hour check)
    }[activityType] || 50;
    
    if (tracker.count >= maxPerHour) {
      return false; // Exceeded rate limit
    }
    
    tracker.count++;
    return true;
  }

  // In 'mint_activity' case:
  if (action === 'mint_activity') {
    const allowed = await checkActivityRateLimit(request.userId, request.activityType);
    if (!allowed) {
      return { accepted: false, reason: 'RATE_LIMIT_EXCEEDED' };
    }
    return InternalKylrixTokenService.mintForActivity({...});
  }
```

### T4-2: Implement fraud detection for referrals
**File:** `lib/services/internal/kylrix-token.ts`

**Change:** Add validation before referral minting.

```typescript
  // New helper to validate referral quality:
  async function validateReferralMint(referrerId: string, newUserId: string): Promise<{ valid: boolean; reason?: string }> {
    // Check 1: Referrer doesn't have >100 successful referrals in 30d
    const lastMonth = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { rows: recent } = await ledgerTables().listRows({
      databaseId: DB_ID,
      tableId: TABLE_ID,
      queries: [
        Query.equal('userId', referrerId),
        Query.equal('eventType', 'mint_activity'),
        Query.equal('sourceType', 'referral_signup'),
        Query.greaterThanEqual('createdAt', lastMonth),
        Query.limit(100),
      ],
    });
    
    if ((recent?.length || 0) >= 100) {
      return { valid: false, reason: 'REFERRER_MONTHLY_LIMIT_REACHED' };
    }
    
    // Check 2: New user account age >10 min (prevent insta-fraud)
    const newUser = await createAdminClient().users.get(newUserId).catch(() => null);
    if (!newUser) {
      return { valid: false, reason: 'NEW_USER_NOT_FOUND' };
    }
    const accountAgeSecs = (Date.now() - new Date(newUser.$createdAt).getTime()) / 1000;
    if (accountAgeSecs < 600) {
      return { valid: false, reason: 'NEW_ACCOUNT_TOO_YOUNG' };
    }
    
    return { valid: true };
  }

  // Call before minting:
  const validation = await validateReferralMint(input.userId, input.metadata?.newUserId);
  if (!validation.valid) {
    return { accepted: false, reason: validation.reason };
  }
```

---

## Phase 5: Testing & Validation

### T5-1: Create unit test for contract logic
**File:** `lib/sdk/token/__tests__/contract.test.ts` (new file)

```typescript
import { createKylrixTokenContract } from '../contract';

describe('KylrixTokenContract', () => {
  const contract = createKylrixTokenContract();
  
  test('thermal score reduces reward correctly', () => {
    const signal = {
      activityType: 'chat_message' as const,
      uniqueActors: 1,
      trustScore: 75,
      recentSpikeFactorBps: 0,
      accountAgeDays: 30,
      thermalScore: 3, // Half-hot
    };
    
    const snapshot = {
      mintedMicro: 0n,
      burnedMicro: 0n,
      genesisAt: null,
      nowIso: new Date().toISOString(),
    };
    
    const decision = contract.decideMintForActivity(snapshot, signal, 0n);
    
    // With thermal=3, expect ~45% reduction (3 * 1500 bps)
    expect(decision.allowed).toBe(true);
    expect(decision.tightenBps).toBeGreaterThan(5500); // 55%+ reduction
  });

  test('network scale applies bonus for small userbase', () => {
    const signal = {
      activityType: 'chat_message' as const,
      uniqueActors: 1,
      trustScore: 75,
      recentSpikeFactorBps: 0,
      accountAgeDays: 30,
      userBaseCount: 50, // Very small
      thermalScore: 0,
    };

    const snapshot = {
      mintedMicro: 0n,
      burnedMicro: 0n,
      genesisAt: null,
      nowIso: new Date().toISOString(),
    };

    const decision = contract.decideMintForActivity(snapshot, signal, 0n);
    expect(decision.amount).toBeGreaterThan(40_000n); // Base + boost
  });
});
```

### T5-2: Create integration test for minting flow
**File:** `lib/services/__tests__/kylrix-token.integration.test.ts` (new file)

```typescript
import { InternalKylrixTokenService } from '../internal/kylrix-token';
import { KylrixTokenService } from '../token';

describe('Token Minting Integration', () => {
  const testUserId = 'test-user-' + Date.now();
  
  beforeAll(async () => {
    // Initialize token state
    await InternalKylrixTokenService.initializeState();
  });

  test('mint reduces daily cap correctly', async () => {
    const result1 = await InternalKylrixTokenService.mintForActivity({
      userId: testUserId,
      idempotencyKey: `test:1:${Date.now()}`,
      activityType: 'note_create',
      uniqueActors: 1,
      trustScore: 75,
      sourceType: 'test',
      sourceId: 'test-1',
    });

    expect(result1.accepted).toBe(true);

    // Second mint same user same day should still succeed but apply tightening
    const result2 = await InternalKylrixTokenService.mintForActivity({
      userId: testUserId,
      idempotencyKey: `test:2:${Date.now() + 1000}`,
      activityType: 'note_create',
      uniqueActors: 1,
      trustScore: 75,
      sourceType: 'test',
      sourceId: 'test-2',
    });

    expect(result2.accepted).toBe(true);
    // result2.amount should be < result1.amount due to thermal penalty
    const amt1 = BigInt(result1.amountMicro);
    const amt2 = BigInt(result2.amountMicro);
    expect(amt2).toBeLessThan(amt1);
  });

  test('referral_signup is blocked if limit exceeded', async () => {
    // Simulate 100 successful referrals
    for (let i = 0; i < 100; i++) {
      const newUserId = `referred-${i}-${Date.now()}`;
      // Manually create ledger entry for each (in real test, would do via API)
      await InternalKylrixTokenService.mintForActivity({
        userId: testUserId,
        idempotencyKey: `referral:${i}:${Date.now()}`,
        activityType: 'referral_signup',
        uniqueActors: 1,
        trustScore: 85,
        sourceType: 'referral_signup',
        sourceId: newUserId,
      });
    }

    // 101st should fail
    const result = await InternalKylrixTokenService.mintForActivity({
      userId: testUserId,
      idempotencyKey: `referral:101:${Date.now()}`,
      activityType: 'referral_signup',
      uniqueActors: 1,
      trustScore: 85,
      sourceType: 'referral_signup',
      sourceId: 'referred-101',
    });

    expect(result.accepted).toBe(false);
  });
});
```

---

## Phase 6: Monitoring & Alerts

### T6-1: Add token metrics to analytics
**File:** `lib/services/internal/analytics.ts` (new or existing)

```typescript
export async function logTokenEvent(event: {
  eventType: string; // 'mint', 'transfer', 'fine'
  userId: string;
  activityType?: string;
  amountMicro: string;
  accepted: boolean;
  reason?: string;
  thermalScore?: number;
}) {
  // Send to analytics backend (DataDog, Sentry, custom)
  try {
    await fetch('/api/analytics/token-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch {
    // Silent fail, don't block minting
  }
}
```

### T6-2: Create dashboard queries for monitoring
**File:** Documentation only (create in Appwrite dashboard or external BI tool)

```sql
-- Query 1: Daily mint volume trend
SELECT
  DATE(createdAt) as date,
  COUNT(*) as mint_count,
  SUM(CAST(amountMicro as DECIMAL)) as total_minted
FROM KYLRIX_TOKEN_LEDGER
WHERE rowType = 'event' AND eventType = 'mint_activity'
GROUP BY DATE(createdAt)
ORDER BY date DESC
LIMIT 30;

-- Query 2: Activity type distribution
SELECT
  JSON_EXTRACT(metadata, '$.activityType') as activity_type,
  COUNT(*) as count,
  AVG(CAST(amountMicro as DECIMAL)) as avg_reward
FROM KYLRIX_TOKEN_LEDGER
WHERE rowType = 'event' AND eventType = 'mint_activity'
  AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY activity_type
ORDER BY count DESC;

-- Query 3: Top spenders (thermal flagging)
SELECT
  userId,
  COUNT(*) as mint_count_24h,
  SUM(CAST(amountMicro as DECIMAL)) as total_minted_24h
FROM KYLRIX_TOKEN_LEDGER
WHERE rowType = 'event' AND eventType = 'mint_activity'
  AND createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY userId
HAVING mint_count_24h > 50
ORDER BY mint_count_24h DESC
LIMIT 20;
```

---

## Success Criteria Checklist

- [ ] All new activity types defined in contract
- [ ] Thermal score calculation working correctly
- [ ] Network-aware scaling applies correct bonuses/reductions
- [ ] Chat messages earn tokens (capped at 5/day hard limit)
- [ ] Calls earn tokens for ≥5 min participants
- [ ] Referrals earn 1.5 tokens per signup, capped at 100/month
- [ ] Notes earn 0.08 tokens per create
- [ ] Daily login earns 0.05 tokens (once per 24h)
- [ ] Rate limiting prevents >100 messages/hour per user
- [ ] Referral fraud detection flags >100 referrals/month
- [ ] Integration tests pass (no actual transactions, mocks only)
- [ ] Token minting logs go to analytics backend
- [ ] Dashboard queries show supply velocity trends
- [ ] No regression: moment share minting still works (0.65 token baseline)

---

## Deployment Checklist

- [ ] Code review: contract logic + thermal score math
- [ ] Code review: activity hooks + rate limiting
- [ ] Security review: fraud vectors in referral, message spam
- [ ] Database: confirm KYLRIX_TOKEN_LEDGER indices are optimal (userId, eventType, createdAt)
- [ ] Background jobs: set up hourly user count refresh
- [ ] Monitoring: alerts for > 2x expected daily supply velocity
- [ ] Documentation: update user-facing token docs with new activities
- [ ] Soft launch: enable chat/call minting to 1% users first, monitor 24h
- [ ] Full launch: enable all activity types
- [ ] Post-launch: monitor thermal scores, fraud flags, adjust weights if needed
