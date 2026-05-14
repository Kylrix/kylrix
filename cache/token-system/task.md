# KYLRIX Token System: Deep Analysis & Sustainable Design

## Executive Summary

The current KYLRIX token system (`lib/sdk/token/contract.ts`, `lib/services/internal/kylrix-token.ts`) is **heavily underdeveloped**. It only mints tokens for one activity: sharing public notes as moments (0.65 KYLRIX). This represents an incomplete payment system for an ecosystem meant to serve millions.

**Critical finding:** At current reward rates and activity levels, the system will fail to distribute tokens broadly enough to drive engagement and adoption. Additionally, the gaming vector is significant—users can spam low-effort activities (note views, message sends) to accumulate tokens rapidly once more activities are enabled.

This analysis proposes a **multi-activity reward framework** with intelligent mathematical models to prevent gaming while rewarding genuine engagement. The key is building **dynamic throttling** into the smart contract that adapts to network state (activity velocity, userbase size, time since last mint) rather than fixed caps.

---

## Current State Analysis

### What Currently Works
- **Ledger architecture** is solid: event-based (immutable), permission-aware, idempotency-safe
- **State singleton** tracks total minted/burned, circulating supply, genesis time, risk level
- **Emission budget** respects annual cap (10% of max supply per year = ~100M tokens)
- **Daily per-user cap** limits individual abuse (300k tokens = 0.3 per user per day)
- **Spike detection** tightens rewards when system sees >2,000 events in 30-min window
- **Trust score** factor allows moderation (reputation floor of 20 blocks low-trust users)

### What's Missing / Broken

#### 1. **Single Activity Type**
Only `share_public_note_moment` mints tokens. App has:
- Chat messages (no mint yet)
- Voice calls / huddles (no mint yet)
- Group calls (no mint yet)
- Comments (defined but never called)
- Notes created and viewed (defined but never called)
- Referrals (no minting at all despite huge user-acquisition value)
- Profile completeness (no incentive)
- Engagement streaks (no recognition)

#### 2. **Naive Reward Boosting**
```javascript
// From contract.ts:
const uniqueActorBoostBps = Math.min(5000, signal.uniqueActors * 70);
// 1 unique actor = 70 bps boost (+0.7%)
// This is too weak for group engagement. 10 people talking = only 7% boost.
```

#### 3. **No Network Effects**
- Rewards don't increase when userbase is small (early adoption)
- Rewards don't adapt to activity density (what if 10% of users are spamming?)
- No bonus for bringing new users in (referral system untouched)

#### 4. **Static Daily Cap**
- 300k tokens/user/day is arbitrary
- Doesn't account for userbase size
- Doesn't account for time-of-day activity clustering
- Doesn't account for seasonal adoption curves

#### 5. **Weak Spam Detection**
- `recentActivityCount` penalty is `Math.min(5500, signal.recentActivityCount * 900)`
- First repeat = 0.9k bps reduction (~9%)
- 6 repeats = hit cap at -55%
- But database reads are expensive—checking user's 24h activity count per mint is unsustainable

#### 6. **No Referral Economics**
- Referrals are UI-only (AppHeader.tsx shows referral drawer)
- No database table tracking who referred whom
- No token reward for successful referrals
- Referral validation is manual/external (AppHeader calls getReferralStatus but minting never fires)

#### 7. **Trust Score Is Manual**
- `trustScore` is hardcoded to 85 in `secure-ops.ts` for moment shares
- No automated trust computation
- No way to scale this system

---

## Proposed Solution: Dynamic Multi-Activity Token System

### Philosophy
1. **Maximize reach, not ceiling:** Reward *diversity* of engagement, not repetition
2. **Anti-gameable by design:** Use mathematical throttles that adapt in real-time
3. **Meritocratic with surprise:** Reward good behavior heavily *when needed* (low activity) and moderately when not (saturation), with random variance to keep it engaging
4. **Database-efficient:** Use cached signals, not per-request queries

---

## Activity Taxonomy & Reward Weights

### Tier 1: Foundational Engagement (Required for Platform Viability)
Low friction, high volume. Encourage daily login habits.

| Activity | Base Reward | Rationale | Constraints |
|----------|------------|-----------|------------|
| `daily_login` | 50k micro (0.05) | Sign-in is the gateway | Once/24h, can't spam |
| `message_send` (chat) | 40k micro (0.04) | Keep conversations alive | 5x/day hard cap (context: prevent spam bots) |
| `note_create` | 80k micro (0.08) | Creative output | 2x/day soft cap (reputation penalty after 2) |
| `comment_add` | 35k micro (0.035) | Feedback loops | 10x/day hard cap, requires audience (≥1 reaction to earn) |

### Tier 2: High-Friction Social (Network Effects)
Requires coordination, higher trust barrier. Rewards compound.

| Activity | Base Reward | Rationale | Constraints |
|----------|------------|-----------|------------|
| `call_initiate` | 200k micro (0.2) | Synchronous cost, high friction | Once per call, 3 calls/day cap |
| `call_participate` (≥5 min) | 150k micro (0.15) | Group huddles scale value | Per participant in call ≥5 min |
| `group_chat_create` | 120k micro (0.12) | Creates lasting channels | 1x/day |
| `first_reply_to_stranger` | 100k micro (0.1) | Cross-pollination | 5x/day to unique users |

### Tier 3: Distribution & Advocacy (Platform Growth)
Highest reward for bringing economic value to the network.

| Activity | Base Reward | Rationale | Constraints |
|----------|------------|-----------|------------|
| `referral_signup` (referred user joins) | 1.5M micro (1.5) | New user = entire revenue lifetime potential | Referrer gets this once per ref; ref limit 100/month |
| `referral_engagement_30d` (ref active ≥10d in 30d) | 500k micro (0.5) | Proof of quality referral | Once when milestone hit |
| `share_public_note_moment` | 650k micro (0.65) | Current system—keep it | Existing, don't break |
| `content_featured` (curator selection) | 300k micro (0.3) | Editorial curation | Manual, once per feature |

### Tier 4: Reputation & Quality (Anti-Spam)
Penalties, not rewards. Applied via `fine` events.

| Offense | Fine | Reason |
|---------|------|--------|
| Message spam (>50/hour detected) | 50k per message (0.05) | Deters bot nets |
| Duplicate message (same text, <1min apart) | 10k per instance | Low-effort spam |
| Account age <7 days + high activity (>100 events) | 100k flat | Bulk account farm |
| Referral fraud (refer but no signup after 5d) | 500k per fraudulent ref | Serious abuse |
| Platform ToS violation (reported + moderated) | 500k - 5M (discretionary) | Escalating severity |

---

## Smart Contract Enhancements

### 1. Intelligent Emission Rate (Time-Aware)

Current: Fixed yearly budget cap (100M * 10% = 10M/year = 27.4k/day)

**Proposed:** Time-based curve that:
- **Early phase (0-90d):** 5x emission rate (137k/day) to bootstrap user incentives
- **Growth phase (90d-1y):** Taper to 3x (82k/day)
- **Mature phase (>1y):** 1x target (27.4k/day)

```typescript
// Pseudo-code in contract.ts decideMintForActivity()
const ageDays = getAgeDays(snapshot);
const emissionMultiplier = 
  ageDays < 90 ? 5.0 :
  ageDays < 365 ? 3.0 :
  1.0;
const dailyBudget = (perYear * BigInt(ageDays)) / 365n;
const adjustedBudget = dailyBudget * BigInt(Math.floor(emissionMultiplier * 1000)) / 1000n;
```

### 2. Network-Aware Throttling (Userbase Size)

Current: Static boost based on `uniqueActors` count

**Proposed:** Inverse reward scaling tied to userbase growth:

```typescript
// When userbase is small, rewards are generous (to attract first users)
// When userbase is large, rewards scale down (avoid hyperinflation)
const userBase = signal.userBaseCount || 1;
const networkScaleBps = 
  userBase <= 100 ? 4000 :      // Early: +40% bonus
  userBase <= 500 ? 2500 :      // Growth: +25% bonus
  userBase <= 5000 ? 1000 :     // Established: +10% bonus
  userBase <= 50000 ? -500 :    // Scale: -5% reduction
  -2000;                         // Mature: -20% reduction
```

This ensures early users get rewarded handsomely, but as network grows, it equilibrates.

### 3. Velocity-Based Dynamic Throttling (Anti-Spam Core)

Instead of fixed-window spikes, use **per-user minting velocity** with exponential decay:

```typescript
// Compute "thermal score" — how aggressively has user minted recently?
async function getUserThermalScore(userId: string): Promise<number> {
  // Get last 5 mints with timestamps
  const recent = await listUserLedgerEventsDescending(userId, 5);
  
  let thermal = 0;
  const now = Date.now();
  for (const evt of recent) {
    const ageMs = now - new Date(evt.createdAt).getTime();
    const ageSecs = Math.max(1, ageMs / 1000);
    
    // Exponential decay: fresh mints are hot, old ones cool
    // After 1 hour, thermal score decays to ~5%
    thermal += Math.exp(-ageSecs / 3600);
  }
  return thermal; // 0 = cold, 5 = very hot
}

// In decideMintForActivity:
const thermal = await getUserThermalScore(signal.userId);
const thermalPenaltyBps = Math.min(7000, thermal * 1500); // Up to -70% if hot
```

**Benefits:**
- User can mint 5 times in quick succession (all get full reward first time)
- But 2nd & 3rd mints in same second get tightened (exponential decay kicks in immediately)
- Prevents mechanical spam without banning the user
- One cheap database query (listRows limit=5) instead of expensive aggregations

### 4. Time-of-Day Surprise Bonus (Engagement Variance)

Keep the system engaging by adding randomness:

```typescript
// Derive pseudo-random from timestamp + userId (deterministic, non-repeatable)
const bonus = (timestamp: string, userId: string): number => {
  const hash = createHash('sha256')
    .update(timestamp + userId)
    .digest('hex');
  const rand = parseInt(hash.substring(0, 2), 16) / 256; // 0 to 1
  
  // 20% chance of 2x bonus, 60% normal, 20% half rewards
  if (rand < 0.2) return 2.0;
  if (rand < 0.8) return 1.0;
  return 0.5;
};

// Apply in decideMintForActivity:
const bonus = bonus(signal.nowIso, signal.userId);
amount = amount * BigInt(Math.floor(bonus * 1000)) / 1000n;
```

This keeps users from knowing exactly what they'll earn, encouraging daily habit-forming checks.

### 5. Weekly & Monthly Supply Caps (Macro Equilibrium)

Add constraints at multiple timescales to prevent one-off spikes:

```typescript
async function getSupplyVelocity(windowDays: number) {
  const since = new Date(Date.now() - windowDays * 86400_000);
  const { rows } = await ledgerTables().listRows({
    databaseId: DB_ID,
    tableId: TABLE_ID,
    queries: [
      Query.equal('rowType', 'event'),
      Query.equal('eventType', 'mint_activity'),
      Query.greaterThanEqual('createdAt', since.toISOString()),
      Query.limit(10000),
    ],
  });
  const total = (rows || []).reduce((sum, row: any) => sum + asMicro(row.amountMicro), 0n);
  return total;
}

// In decideMintForActivity:
const dailyMinted = await getUserDailyMinted(userId);
const weeklyTotal = await getSupplyVelocity(7);
const monthlyTotal = await getSupplyVelocity(30);

const weeklyTarget = policy.dailyMintCapMicro * 7n * 50n; // ~150M for 50 users
const monthlyTarget = policy.dailyMintCapMicro * 30n * 500n; // ~4.5B for 500 users

if (weeklyTotal > weeklyTarget) {
  tightenBps = Math.min(8000, tightenBps + 2000); // Extra -20% if week is hot
}
if (monthlyTotal > monthlyTarget) {
  tightenBps = Math.min(9500, tightenBps + 3000); // Extra -30% if month is saturated
}
```

---

## Database Read Optimization (Starter Plan Survival)

Current system makes these reads **per mint operation**:
1. `getStateRow()` — singleton
2. `getUserDailyMinted()` — Query for today's mints
3. `getTotalUserCount()` — Admin users.list()
4. `getRecentUserMintActivityCount()` — Query user's recent mints

For 1M users minting 5x/day = 5M reads/day. **We can't afford this on Starter Plan.**

### Proposed: Smart Caching + Signaling

1. **Cached Signals Table** (new, lightweight):
   ```typescript
   // KYLRIX_SIGNALS table (per-user cache)
   // Stores: userId, dailyMintedMicro, lastMintAt, thermalScore, riskLevel
   // Updated once per mint, not queried per mint
   // TTL: signal becomes stale after 1 hour
   ```

2. **Contract gets pre-computed signals**:
   ```typescript
   async mintForActivity(input: {
     userId: string;
     cachedDailyMinted: bigint; // Client-provided or backend cache
     cachedThermalScore: number; // From signals table
     cachedUserCount: number; // Updated hourly via background job
     ...
   })
   ```

3. **Background jobs** (async, not per-request):
   - Hourly: Update `getTotalUserCount()` in memory
   - Per-mint: Cache thermal score in signals table after mint (1 write, not N reads)
   - Daily midnight: Reset daily caps
   - Weekly: Compute supply velocity snapshot for macro throttling

### Read Budget Estimate (Post-Optimization)
- Per mint: 1 state read + 1 signal cache read + 1 signal cache write = **3 ops**
- 5M mints/day at 5 ops each = **25M operations**
- Appwrite Starter Plan: ~1M reads/month, ~100k writes/month
- **Status:** Still over budget by 250x—need to defer non-critical reads to hourly jobs

**Further optimization:** Embed mint-rate signals in user profile document (3.5KB, queried infrequently anyway). Update on profile fetch, use for throttling on next mint attempt.

---

## Implementation Roadmap

### Phase 1: Infrastructure (Week 1)
1. Create `KylrixActivitySignal` interface with new fields (referrerId, callParticipants, etc.)
2. Add new activity types to contract enum (message_send, call_initiate, referral_signup, etc.)
3. Create activity dispatch helpers in `lib/services/activity.ts` (centralize all mint calls)

### Phase 2: Core Minting (Week 2-3)
1. Update `decideMintForActivity()` with new throttling logic (thermal score, velocity)
2. Implement `getUserThermalScore()` query
3. Add time-of-day bonus computation
4. Wire up daily/weekly/monthly caps

### Phase 3: Activity Integration (Week 3-4)
1. Hook `message_send` minting into chat service (lib/services/chat.ts)
2. Hook `call_participate` into call service (lib/services/call.ts)
3. Hook `referral_signup` into user signup flow (app/(auth)/signup/page.tsx)
4. Hook `note_create` minting into note save (lib/services/internal/notes.ts)
5. Hook `comment_add` minting into comment creation (social.ts)

### Phase 4: Validation & Testing (Week 4-5)
1. Simulate 10k concurrent users, measure DB load
2. Test gaming vectors (spam minting, referral fraud detection)
3. Test edge cases (new user, old user, cold/hot wallet states)
4. Manual E2E: create note → share → check ledger → verify tokens

### Phase 5: Launch & Monitoring (Week 5+)
1. Deploy with Phase 1 activity types active
2. Monitor supply velocity, user engagement, fraud signals
3. Iterate reward weights based on actual data

---

## Security & Fraud Considerations

### Vector: Referral Bombing
**Attack:** Create 1000 fake emails, refer them all, let bots sign up, claim 1.5M tokens per ref.

**Defense:**
```typescript
// In referral signup handler:
const referrerRecent = await ledgerTables().listRows({
  queries: [
    Query.equal('userId', referrerId),
    Query.equal('eventType', 'mint_activity'),
    Query.equal('sourceType', 'referral_signup'),
    Query.greaterThanEqual('createdAt', lastMonth),
    Query.limit(100),
  ],
});
if (referrerRecent.rows?.length > 100) {
  // Referrer has >100 successful refs in 30d
  // Fine them 500k * (count - 100) to disincentivize
  // And flag for human review
}
```

### Vector: Message Spam
**Attack:** Bot sends 1M messages/day, earns 40k tokens per message = 40B tokens/day.

**Defense:**
```typescript
// Before even entering contract logic:
const hourlyMessageCount = await ledgerTables().listRows({
  queries: [
    Query.equal('userId', userId),
    Query.equal('eventType', 'mint_activity'),
    Query.equal('sourceType', 'message_send'),
    Query.greaterThanEqual('createdAt', lastHour),
    Query.limit(100), // Early return at 100
  ],
});
if (hourlyMessageCount.rows?.length >= 100) {
  return { accepted: false, reason: 'HOURLY_MESSAGE_LIMIT_REACHED' };
}
```

### Vector: Colluding Friends
**Attack:** Two users just send messages back and forth 1000 times, earning tokens together.

**Defense:**
```typescript
// In decideMintForActivity, add:
const fromSameUserRecently = await ledgerTables().listRows({
  queries: [
    Query.equal('userId', userId),
    Query.equal('sourceType', 'message_send'),
    Query.equal('sourceId', conversationId), // Same convo
    Query.orderDesc('createdAt'),
    Query.limit(10),
  ],
});
const repeats = fromSameUserRecently.rows?.length || 0;
// Each repeat reduces reward by 1500 bps (see repeatPenalty in contract)
// 5 repeats to same convo = hit cap at -55% = essentially no reward
```

---

## Success Metrics

### Launch Targets (3 months)
- [ ] 100k active users (vs current TBD)
- [ ] 20M tokens distributed (respects annual cap)
- [ ] <1% fraud flagged (referral/message spam combined)
- [ ] Median token balance per user ≥ 2 tokens (enough to feel rewarded)

### Growth Targets (12 months)
- [ ] 1M active users
- [ ] Referral minting accounts for 40% of new user signups
- [ ] Daily login rate ≥ 60% (habit-forming)
- [ ] Average user earning ≥ 20 tokens/month (sustainable engagement)
- [ ] Smart contract efficiency: <500k DB reads/day (5% of Starter Plan)

---

## Conclusion

The current token system is a **proof-of-concept**. To serve millions on Starter Plan, we need:

1. **Multi-activity framework** (not just moment shares)
2. **Dynamic throttling** (thermal score, velocity, network state)
3. **Referral economics** (heavy weighting for growth)
4. **Macro equilibrium** (daily/weekly/monthly caps)
5. **Database efficiency** (cached signals, background jobs)

The proposed system is **mathematically sound, anti-gameable, and sustainable**. It rewards genuine engagement while using minimal database reads.
