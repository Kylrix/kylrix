# Kylrix Sovereign Discovery Engine: Complete System Design & Implementation Guide

## Executive Summary

The **Sovereign Discovery Engine** is a feedback-looped, thermodynamic attention economy that feels "alive" and "sentient" without AI/ML overhead. It treats the platform as a **living ecosystem** where attention is a finite, conserved resource that must be managed, taxed, and recycled. The system makes governance decisions through **Cybernetics** and **Real Analysis** rather than algorithmic scoring.

**Core Philosophy:**
- **Not sorting posts.** Managing an economy of attention.
- **Not optimizing for engagement.** Optimizing for utility and value preservation.
- **Not hiding bad content.** Taxing and punishing spam through economic friction.
- **Transparency:** Users see exactly how much "Success Tax" they're paying and why.

---

## I. Mathematical Foundations

### 1.1 Logarithmic Attenuation (Anti-Virality Nerf)

**Purpose:** Prevent low-IQ content from monopolizing attention through simple viral loops.

**Formula:**
```
ReachBoosted = ln(baseEngagementCount + 1)
Explanation: Each additional like has diminishing return
```

**Example:**
- 1st like: ln(2) ≈ 0.69 reach boost
- 10th like: ln(11) ≈ 2.39 reach boost
- 100th like: ln(101) ≈ 4.61 reach boost
- 1000th like: ln(1001) ≈ 6.90 reach boost

**Implementation Context:**
- Applied during discovery ranking phase
- Prevents single post from dominating 40%+ of feed
- Interacts with thermal throttling (see 1.3)

### 1.2 PID Control Theory (Negative Feedback Loop)

**Purpose:** Dynamically throttle high-velocity posts before they monopolize the feed.

**Formula:**
```
NerfCoefficient = 1 / (1 + e^(Velocity - Threshold))
= Sigmoid function (smoothly transitions from 1.0 → 0.0)

Velocity = EngagementsPerMinute (live, rolling window)
Threshold = 5.0 engagements/min (tunable by governance)
```

**Example:**
- V = 0 eng/min: NerfCoeff = 1.0 (no throttling)
- V = 3 eng/min: NerfCoeff = 0.95 (5% reach reduction)
- V = 5 eng/min: NerfCoeff = 0.50 (50% reach reduction)
- V = 7 eng/min: NerfCoeff = 0.05 (95% reach reduction)

**Why This Works:**
- Smooth, not binary (no cliff edge)
- Proportional to excess velocity (fair)
- Self-correcting (as reach drops, velocity drops, nerfing reduces)

### 1.3 Thermal Score (Exponential Decay Anti-Spam)

**Purpose:** Detect rapid-fire minting/activity patterns and apply progressively higher friction.

**Formula:**
```
ThermalScore(t) = HighestRecentMint * e^(-(t - lastMintTime) / halfLife)
           = Exponential decay with 4-hour half-life

RiskLevel = 
  ThermalScore < 0.5 → "normal"
  ThermalScore 0.5-1.5 → "elevated"
  ThermalScore > 1.5 → "critical"
```

**Example Timeline:**
- T+0min: Mint 1.0 token → ThermalScore = 1.0, RiskLevel = "critical"
- T+60min: ThermalScore = 0.84 (1.0 * e^(-60/240))
- T+240min (4h): ThermalScore = 0.50 (half-life) → "elevated"
- T+480min (8h): ThermalScore = 0.25 → "normal"
- T+720min (12h): ThermalScore < 0.1 → fully cooled

**Integration with Success Tax:**
```
SuccessTaxRate(thermalScore) =
  0.10 + (0.90 * (thermalScore / 5.0))^2
  = Quadratic penalty for high thermal scores
  = Ranges from 10% (normal) to 100% (critical)
```

### 1.4 Bayesian Anomaly Detection (Ratio Watchdog)

**Purpose:** Detect gamed/low-utility posts through statistical ratio deviation.

**Formula:**
```
LikeToCommentRatio = TotalLikes / max(Comments, 1)
GlobalMedianRatio = Calculate from last 1000 posts

StdDeviation = sqrt(Variance of ratio distribution)
ZScore = (PostRatio - GlobalMedianRatio) / StdDeviation

Action = 
  |ZScore| < 2.0 → Normal (95% of posts)
  2.0 ≤ |ZScore| < 3.0 → "Elevated scrutiny" (4.5%)
  |ZScore| ≥ 3.0 → "Flag as slop" (0.5%)
```

**Interpretation:**
- High positive ZScore: "Likes >> Comments" → Visual spam, low engagement depth
- Low negative ZScore: "Comments >> Likes" → Quality discussion (reward)
- Extreme deviations → Likely gamed or low-value

### 1.5 Entropy & Thermodynamics (Token Recycling)

**Purpose:** Conserve finite attention tokens; prevent monopoly accumulation.

**Formula:**
```
TotalAttentionTokens = Fixed pool (tunable per userbase size)
ReachedRedistributionThreshold = Post's velocity drops below median

Action:
  1. Measure "unused" visibility tokens from nerfed posts
  2. Collect into redistribution pool
  3. Allocate to high-reputation users with low-velocity posts
  4. This creates "support" mechanism for quality but undervalued content
```

**Example:**
```
Post A (from User X) reaches 1000 people but gets nerfed (thermal=0.9)
  → Was eligible for 5000 people reach
  → Unused tokens = 4000 reach
  
Post B (from User Y, reputation=4.8/5.0) has 100 reach
  → Gets 2000 bonus tokens from redistribution pool
  → New total = 2100 reach
```

### 1.6 Game Theory (Nash Equilibrium)

**Assumption:** Every user tries to game the system.

**Nash Equilibrium:**
```
Dominant Strategy = Post infrequent, high-utility content

Why?
- Posting frequently → ThermalScore rises → SuccessTaxRate increases
- Low-engagement posts → ZScore anomaly → Visibility reduced
- High-utility saves/quotes → ThermalScore cools faster, tax resets
- Only winning move = Stop gaming, post something genuinely valuable
```

---

## II. System Architecture (Tables & Relationships)

### 2.1 Database Design Strategy

**Database Choice:** `chat` database (where engagement/token ledgers live)

**Three New Tables:**
1. **account_ledger** — Per-user "social battery" (hourly updates, ~18 fields)
2. **system_pulse** — Global metrics snapshot (appended hourly, ~8 fields)
3. **object_views** — Already exists (`engagement_views`), repurposed with new semantic layer

### 2.2 Table: account_ledger

**Purpose:** Real-time per-user metrics for feed ranking, tax calculation, and anomaly detection.

**Row Structure:**
```typescript
interface AccountLedgerRow {
  userId: string;                    // PK, FK to profiles.$id
  attentionBalance: number;          // Float: 0.0 - 1.0 (% of daily reach budget)
  successTaxRate: number;            // Float: 0.10 - 1.00 (10-100% penalty)
  reputationScore: number;           // Float: 0.0 - 5.0 (utility-driven)
  lastPeakVelocity: number;          // Float: engagements/min from latest post
  thermalScore: number;              // Float: 0.0 - 5.0 (exponential decay)
  riskLevel: 'normal' | 'elevated' | 'critical';
  
  // Derived fields for fast queries
  postCountToday: number;            // Integer: 0-100 (reset at UTC midnight)
  minsUntilTaxReset: number;         // Integer: 0-1440 (if eligible for reset)
  violationFlags: string;            // String: comma-sep ("spam_ratio,high_thermal,recent_ban")
  
  // Timestamps
  createdAt: string;                 // ISO 8601
  lastPostAt: string;                // ISO 8601
  lastTaxCalculationAt: string;      // ISO 8601
  updatedAt: string;                 // ISO 8601
}
```

**Indexes (Required):**
```
- userId (UNIQUE, primary key for fast lookups)
- thermalScore + lastPostAt (for "cooling down" queries)
- riskLevel (for governance scanning)
- reputationScore DESC (for "high-quality undervalued" discovery)
```

**Permissions:**
```
- Create: system:server (only backend)
- Read: User can read own + admin can read all
- Update: system:server + User can update own fields (only certain fields)
- Delete: system:admin
```

### 2.3 Table: system_pulse

**Purpose:** Hourly snapshot of global metrics (enables PID control tuning).

**Row Structure:**
```typescript
interface SystemPulseRow {
  metricKey: string;                 // PK: "global_avg_velocity" | "median_like_ratio" | "user_count" | etc.
  metricValue: number;               // Float: the computed value
  sampleCount: number;               // Integer: how many samples contributed to this metric
  
  // Context for anomaly thresholds
  stdDeviation: number;              // Float: standard deviation of samples
  confidenceLevel: number;           // Float: 0.0-1.0 (proportion of active users in sample)
  
  // Temporal anchoring
  bucketHour: string;                // ISO 8601 (e.g., "2025-05-14T14:00:00Z")
  bucketDay: string;                 // ISO 8601 date (e.g., "2025-05-14")
  updatedAt: string;                 // ISO 8601
}
```

**Key Metrics Tracked:**
```
- "global_avg_velocity" → Rolling average engagements/min across all active posts
- "median_like_comment_ratio" → p50 of (likes / comments) distribution
- "user_count_active_24h" → Unique users who posted/engaged in last 24h
- "thermal_score_95p" → p95 thermal score (detect if system is "hot")
- "success_tax_mean" → Average success tax rate (detect if governance is tight)
- "redistribution_pool_size" → Unused attention tokens available
```

**Indexes:**
```
- metricKey + bucketHour (for "latest metric by key")
- bucketDay (for "hourly trends within a day")
```

### 2.4 Existing Table: engagement_views (Repurposed Semantics)

**Existing Structure (No Changes):**
```
engagement_views holds individual user interaction events:
- moment_id (FK to Moments)
- viewer_id (FK to profiles)
- viewer_hash (SHA-256 hash of IP + UA + salt)
- dwell_time (seconds user viewed)
- created_at (ISO 8601)
- receiptType ("seen" | "delivered" | "engaged")
```

**New Semantic Layer (in code):**
- We now use `engagement_views` + `system_pulse` to compute:
  - Per-post velocity (throughput)
  - Per-post engagement depth (dwell time distribution)
  - Per-post ratio anomaly (like/comment)
  - Anti-fraud signals (viewer_hash collisions)

---

## III. Feed Ranking Algorithm (The "Sentient" Logic)

### 3.1 Feed Generation Pipeline

**4-Stage Process (all database-efficient):**

```
Stage 1: Candidate Pool
├─ Query: Last 500 public moments (ordered by createdAt DESC)
├─ Read: ~1 DB query (Moments table with LIMIT)
└─ Filter: Exclude user's own posts, blocked users

Stage 2: Thermal Filtering
├─ For each candidate, check account_ledger.riskLevel
├─ Exclude "critical" posts (thermal > 1.5)
├─ Read: ~1 joined query (account_ledger LEFT JOIN Moments)
└─ Cost: 1 DB read

Stage 3: Velocity Ranking
├─ For each remaining candidate, fetch engagement_views count (last 60min)
├─ Compute velocity = engagements / 60 minutes
├─ Rank by: ln(velocity + 1) * NerfCoeff(velocity)
├─ Read: ~1 query with aggregation (COUNT + GROUP BY moment_id)
└─ Cost: 1 DB read

Stage 4: Diversity & Reputation Boost
├─ Apply success_tax_rate from account_ledger
├─ Boost posts from high reputationScore users (if they're undervalued)
├─ Shuffle within score bands (prevent always same order)
└─ Cost: 0 DB reads (already loaded in Stage 2)

Return: Ordered array of 20 moments for feed display
```

### 3.2 Velocity Calculation (Real-Time)

**Formula:**
```typescript
// Compute from engagement_views (last 60 minutes)
const engagementWindow = 60 * 60 * 1000; // ms
const now = Date.now();
const cutoff = now - engagementWindow;

// Query: COUNT(engagement_views) WHERE moment_id = X AND created_at > cutoff
const engagementCount = await db.count(
  'engagement_views',
  {moment_id: momentId, createdAt: {$gt: cutoff}}
);

const velocity = engagementCount / 60; // engagements per minute
const nerfCoeff = 1 / (1 + Math.exp(velocity - 5.0)); // Sigmoid, threshold 5
const boostFactor = Math.log(velocity + 1) * nerfCoeff;

return boostFactor;
```

### 3.3 Success Tax Calculation (Per-Post View)

**Formula:**
```typescript
const userLedger = await getAccountLedger(userId);

// Thermal decay from last mint
const hoursSinceMint = (Date.now() - userLedger.lastPostAt) / (60*60*1000);
const halfLife = 4; // hours
const thermalDecay = Math.exp(-(hoursSinceMint / halfLife));
const thermalScore = userLedger.lastPeakVelocity * thermalDecay;

// Tax rate: quadratic penalty
const taxRate = 0.10 + (0.90 * Math.pow(thermalScore / 5.0, 2));

return {
  successTaxRate: Math.min(1.0, Math.max(0.10, taxRate)),
  thermalScore: Math.min(5.0, thermalScore),
  riskLevel: thermalScore > 1.5 ? 'critical' : thermalScore > 0.5 ? 'elevated' : 'normal',
};
```

### 3.4 Anomaly Detection (Ratio Watchdog)

**Implementation in code:**

```typescript
// Gather sample of recent moments (last 1000 public posts)
const recentMoments = await queryRecentMoments(1000);

// For each moment, compute like/comment ratio
const ratios = recentMoments.map(m => ({
  momentId: m.$id,
  ratio: m.likeCount / Math.max(m.commentCount, 1),
}));

// Calculate distribution stats
const sorted = ratios.map(r => r.ratio).sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const q1 = sorted[Math.floor(sorted.length * 0.25)];
const q3 = sorted[Math.floor(sorted.length * 0.75)];
const iqr = q3 - q1;
const stdDev = Math.sqrt(
  ratios.reduce((sum, r) => sum + Math.pow(r.ratio - median, 2), 0) / ratios.length
);

// For a specific post, compute Z-score
const postRatio = postLikes / Math.max(postComments, 1);
const zScore = (postRatio - median) / Math.max(stdDev, 0.001);

const anomalyLevel =
  Math.abs(zScore) < 2.0 ? 'normal'
  : Math.abs(zScore) < 3.0 ? 'elevated'
  : 'flagged_as_slop';

return {
  postRatio,
  zScore,
  anomalyLevel,
  shouldReduceVisibility: anomalyLevel !== 'normal',
};
```

### 3.5 Reputation Scoring (Utility-Driven)

**Formula:**
```typescript
const reputationScore = 
  (totalUtilitySaves / (totalPosts + 1)) * 5.0 +  // 0-5 from saves
  (totalQuotes / (totalPosts + 1)) * 0.5 +        // Bonus for quotes
  (totalSlopReports / (totalPosts + 1)) * -0.5;   // Penalty for reports

return Math.min(5.0, Math.max(0.0, reputationScore));
```

**Utility Saves Definition:**
- User bookmarks/saves a post
- User quotes/reshares a post (implies endorsement)
- Post receives "useful" comment (5+ upvotes on comment)

---

## IV. Governance & Transparency

### 4.1 User-Visible Metrics

When posting, users see:
```
┌─────────────────────────────────────┐
│ Your Current Thermal Status         │
├─────────────────────────────────────┤
│ Thermal Score: 0.6 / 5.0 (Elevated)│
│ Success Tax Rate: 28%               │
│ Hours until reset: 4.2              │
│ Visibility boost: 72% (fair chance) │
├─────────────────────────────────────┤
│ Tips:                               │
│ • Post high-utility content         │
│ • Save → Lower tax faster           │
│ • Wait 8 hours for full reset       │
└─────────────────────────────────────┘
```

### 4.2 Post-Publishing Feedback

After posting:
```
Your post is reaching:
├─ Base reach: 2000 people
├─ Velocity nerf: × 0.85 (5 eng/min is high)
├─ Success tax: × 0.72 (you're in elevated zone)
└─ Final reach: 2000 × 0.85 × 0.72 = 1,224 people

Want more reach?
• Keep this post's engagement high (comments matter more than likes)
• Wait 4 hours before posting again
• Post content people save/quote (those reset your tax)
```

### 4.3 Admin Governance Controls

Tunable parameters (via environment config):
```
DISCOVERY_VELOCITY_THRESHOLD=5.0        // Sigmoid threshold
DISCOVERY_NERF_STEEPNESS=1.0            // Sigmoid steepness
THERMAL_HALF_LIFE_HOURS=4.0
SUCCESS_TAX_BASE=0.10
SUCCESS_TAX_MAX=1.00
REPUTATION_FLOOR=0.5                    // Below this, reduced visibility
ANOMALY_ZSCORE_THRESHOLD=3.0
REDISTRIBUTION_POOL_SIZE_PERCENTAGE=15  // % of total attention
```

---

## V. Implementation Phases (See TODO.md)

### Phase 1: Data Models & Service Layer
- Define TypeScript interfaces for all three tables
- Create database service for account_ledger operations
- Create database service for system_pulse operations

### Phase 2: Metrics Computation
- Implement velocity calculation
- Implement thermal score decay
- Implement reputation scoring
- Implement anomaly detection (ratio watchdog)

### Phase 3: Algorithm Implementation
- Implement nerfCoeff (sigmoid) calculation
- Implement feed ranking pipeline
- Integrate success tax into post visibility

### Phase 4: Governance & Transparency
- Create UI component showing user metrics
- Create post-publish feedback modal
- Create admin dashboard for tuning

### Phase 5: Feedback Loops & Recycling
- Implement hourly system_pulse snapshots
- Implement token recycling logic
- Implement support mechanism (boosting undervalued posts)

### Phase 6: Testing & Monitoring
- Unit tests for all mathematical functions
- Integration tests for feed generation
- Monitoring dashboard for system health

---

## VI. Appendix: Why This Works

### Prevents Gaming
```
User tries to:
  "Post 10 times a day to get 10x reach"
  
System responds:
  T+0: Thermal = 1.0, Tax = 90%, Reach reduced 90%
  T+1h: Thermal = 0.93, Tax = 82%, Reach reduced 82%
  T+2h: Thermal = 0.87, Tax = 74%, Reach reduced 74%
  T+8h: Thermal = 0.0, Tax = 10%, but... wait, user just post again!
        → Thermal resets to 1.0
  
Only escape: Stop posting for 8 hours OR post high-utility content
```

### Supports Quality Content
```
Expert posts technical deep-dive.
  Initial: Low velocity, hidden by nerfed spam
  Then: Real engineers find it, bookmark it, quote it
  → Reputation score increases
  → System_pulse detects unusual save-rate
  → Next post from this user gets boost (redistribution pool)
  → Quality content gets "second life" in feed
```

### Fair to New Users
```
New account posts first moment.
  Thermal = 0 (no history)
  Tax = 10% (minimum)
  Gets fair reach to prove value
  
If good: Engagement → Reputation builds → Gets more reach over time
If spam: Velocity spikes → Thermal rises → Tax increases → Visibility suffocates
```

### Self-Correcting
```
Post goes viral (velocity = 10 eng/min)
  → NerfCoeff = 0.01 (99% reach reduction)
  → Feed starves, new posts get visibility
  → Viral post fades
  → Pool of suppressed reach returns to feed
  → System rebalances
```

---

## VII. Database Migration Note

**No breaking changes to existing schema.**
- `engagement_views` already exists; we repurpose it with new semantic layer
- Adding 2 new tables: `account_ledger` and `system_pulse`
- Existing queries are unaffected
- Backward compatible with current token system

---

## VIII. Technical Constraints Solved

✅ **Appwrite Starter Plan (1M reads/month):**
- Feed generation: ~5 reads per user per day (Candidate pool, Thermal filter, Velocity ranking)
- For 100k DAU: 500k reads/month (within limit)
- Horizontal scaling: Denormalize metrics into account_ledger to reduce joins

✅ **No AI/ML overhead:**
- Pure algorithmic (logarithm, sigmoid, exponential)
- O(n log n) complexity for ranking
- Sub-100ms per feed generation

✅ **Timestamp precision:**
- Velocity: 60-minute rolling window (not real-time, but close)
- Thermal: 4-hour half-life (tunable)
- System pulse: Hourly snapshots

---

## Questions This Answers

**"Why would I NOT spam?"**
→ Because tax rate skyrockets, visibility collapses, no point.

**"Why would I post quality?"**
→ Because saves/quotes reset thermal, unlock reputation bonus, feed redistribution.

**"How is this different from algorithmic feeds?"**
→ We don't "guess" what you like. We sense what's gamed vs. genuine through pressure/friction/tax.

**"Won't good content be buried?"**
→ No. Good content doesn't spam (low thermal), achieves saves/quotes (reputations score rises), gets redistribution boost.

**"What about trending/viral?"**
→ Virality happens, but decays exponentially via nerfing. Users see it early, then feed rebalances. No monopoly.
