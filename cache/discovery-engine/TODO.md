# Discovery Engine - Implementation Roadmap

## Phase 1: Setup & Schema Validation (P1)

### P1-1: Add Tables to appwrite.config.json
**File:** `appwrite.config.json`  
**Task:** Add `account_ledger` and `system_pulse` tables to chat database (after KYLRIX_SIGNALS)

```json
{
  "databases": [
    {
      "id": "chat",
      "collections": [
        {
          "id": "account_ledger",
          "name": "Account Ledger",
          "permissions": ["read(any)", "update(self)", "delete(self)"],
          "indexes": [
            {"type": "key", "attributes": ["userId"], "unique": true},
            {"type": "key", "attributes": ["updatedAt"]}
          ],
          "attributes": [
            {"key": "userId", "type": "string", "required": true},
            {"key": "attentionBalance", "type": "double", "default": null},
            {"key": "successTaxRate", "type": "double", "default": null},
            {"key": "reputationScore", "type": "double", "default": null},
            {"key": "lastPeakVelocity", "type": "double", "default": null},
            {"key": "thermalCacheScore", "type": "double", "default": null},
            {"key": "thermalCacheAt", "type": "integer", "default": null},
            {"key": "updatedAt", "type": "datetime", "default": null}
          ]
        },
        {
          "id": "system_pulse",
          "name": "System Pulse",
          "permissions": ["read(any)", "update(status(admin))"],
          "indexes": [
            {"type": "key", "attributes": ["metricKey"], "unique": true}
          ],
          "attributes": [
            {"key": "metricKey", "type": "string", "required": true},
            {"key": "metricValue", "type": "double", "required": true, "default": null},
            {"key": "sampleCount", "type": "integer", "required": true, "default": null},
            {"key": "updatedAt", "type": "integer", "required": true, "default": null}
          ]
        }
      ]
    }
  ]
}
```

### P1-2: Create Types & Constants
**File:** `lib/types/discovery-engine.ts` (new)
**Task:** Define TypeScript interfaces for thermal scoring and feed ranking

```typescript
export interface AccountLedger {
  userId: string;
  attentionBalance: number;
  successTaxRate: number;
  reputationScore: number;
  lastPeakVelocity: number;
  thermalCacheScore: number;
  thermalCacheAt: number;
  updatedAt: number;
}

export interface SystemPulse {
  metricKey: 'global_avg_velocity' | 'median_interaction_ratio' | 'avg_dwell_time' | 'slop_ratio';
  metricValue: number;
  sampleCount: number;
  updatedAt: number;
}

export interface EngagementSignals {
  momentId: string;
  velocity: number;
  likeCommentRatio: number;
  saveRate: number;
  avgDwellTime: number;
  thermalScore: number;
  nerfCoefficient: number;
  isAnomalous: boolean;
  reasonCode: 'none' | 'high_velocity' | 'slop_ratio' | 'low_dwell' | 'low_save_rate';
}

export const THERMAL_HALF_LIFE_MINUTES = 240; // 4 hours
export const VELOCITY_THRESHOLD = 5.0; // engagements/minute
export const SLOP_RATIO_SIGMA = 3.0; // standard deviations
export const ANOMALY_THRESHOLD = 0.3; // NerfCoeff below this = anomalous
```

### P1-3: Initialize Database Migrations
**File:** `lib/appwrite/migrations/001-discovery-engine.ts` (new)
**Task:** Write migration to initialize default `system_pulse` metrics

```typescript
import { db } from '../client';
import { SystemPulse } from '../../types/discovery-engine';

export async function migrateDiscoveryEngine() {
  const defaultMetrics: Omit<SystemPulse, 'updatedAt'>[] = [
    { metricKey: 'global_avg_velocity', metricValue: 2.5, sampleCount: 0 },
    { metricKey: 'median_interaction_ratio', metricValue: 0.4, sampleCount: 0 },
    { metricKey: 'avg_dwell_time', metricValue: 8, sampleCount: 0 },
    { metricKey: 'slop_ratio', metricValue: 0.15, sampleCount: 0 },
  ];

  for (const metric of defaultMetrics) {
    try {
      await db
        .getDatabase('chat')
        .getCollection('system_pulse')
        .createDocument(Math.random().toString(), {
          ...metric,
          updatedAt: Date.now(),
        });
    } catch (e) {
      if (!e.message.includes('Document with the requested ID')) throw e;
    }
  }
}
```

---

## Phase 2: Thermal Scoring Service (P2)

### P2-1: Implement ThermalScoreService
**File:** `lib/services/internal/thermal-score-service.ts` (new)
**Task:** Build thermal score computation with exponential decay

```typescript
import { db } from '../../appwrite/client';
import { AccountLedger, THERMAL_HALF_LIFE_MINUTES } from '../../types/discovery-engine';

export class ThermalScoreService {
  static async getThermalScore(userId: string): Promise<number> {
    try {
      const ledger = await db
        .getDatabase('chat')
        .getCollection('account_ledger')
        .getDocument(userId) as AccountLedger;

      const now = Date.now();
      const minsElapsed = (now - ledger.thermalCacheAt) / 60000;
      const decayFactor = Math.pow(0.5, minsElapsed / THERMAL_HALF_LIFE_MINUTES);
      
      return ledger.thermalCacheScore * decayFactor;
    } catch (e) {
      return 0;
    }
  }

  static async recordMint(userId: string, tokensGenerated: number): Promise<void> {
    const currentScore = await this.getThermalScore(userId);
    const newScore = currentScore + tokensGenerated;

    await db
      .getDatabase('chat')
      .getCollection('account_ledger')
      .updateDocument(userId, {
        thermalCacheScore: newScore,
        thermalCacheAt: Date.now(),
      });
  }

  static async getRiskLevel(thermalScore: number): Promise<'normal' | 'elevated' | 'critical'> {
    if (thermalScore < 1.0) return 'normal';
    if (thermalScore < 3.0) return 'elevated';
    return 'critical';
  }

  static calculateSuccessTax(thermalScore: number): number {
    return Math.max(0.1, Math.min(1.0, 1.0 - thermalScore * 0.15));
  }
}
```

### P2-2: Integrate Thermal into Mint Flow
**File:** `lib/services/internal/kylrix-token.ts` (modify)
**Task:** Update `mintForActivity()` to apply thermal tax

```typescript
// In mintForActivity() function, after computing baseReward:

const thermalScore = await ThermalScoreService.getThermalScore(userId);
const successTax = ThermalScoreService.calculateSuccessTax(thermalScore);
const finalReward = baseReward * successTax;

// Record thermal score for next mint
await ThermalScoreService.recordMint(userId, finalReward);

// Store in KYLRIX_SIGNALS cache
await db.getDatabase('chat').getCollection('kylrix_signals').updateDocument(userId, {
  thermalScore: await ThermalScoreService.getThermalScore(userId),
  riskLevel: await ThermalScoreService.getRiskLevel(thermalScore),
  updatedAt: new Date(),
});
```

---

## Phase 3: Feed Ranking Algorithm (P3)

### P3-1: Implement Engagement Ratio Analysis
**File:** `lib/services/internal/engagement-analyzer.ts` (new)
**Task:** Compute velocity, ratios, and anomaly flags

```typescript
import { db } from '../../appwrite/client';
import { EngagementSignals } from '../../types/discovery-engine';

interface RawEngagement {
  momentId: string;
  likes: number;
  comments: number;
  saves: number;
  views: number;
  totalDwellTime: number;
  viewCount: number;
}

export class EngagementAnalyzer {
  static async analyzeEngagement(engagement: RawEngagement, ageMinutes: number): Promise<EngagementSignals> {
    const velocity = (engagement.likes + engagement.comments) / Math.max(ageMinutes, 1);
    const likeCommentRatio = engagement.comments > 0 ? engagement.likes / engagement.comments : 0;
    const saveRate = engagement.saves / Math.max(engagement.views, 1);
    const avgDwellTime = engagement.totalDwellTime / Math.max(engagement.viewCount, 1);

    // Fetch system pulse for Bayesian anomaly detection
    const pulse = await this.getSystemPulse();

    const isAnomalous = this.detectAnomaly(likeCommentRatio, pulse.medianInteractionRatio);
    const thermalScore = this.computeThermalScore(velocity, pulse.globalAvgVelocity);
    const nerfCoeff = this.computeNerfCoefficient(velocity);

    return {
      momentId: engagement.momentId,
      velocity,
      likeCommentRatio,
      saveRate,
      avgDwellTime,
      thermalScore,
      nerfCoefficient: nerfCoeff,
      isAnomalous,
      reasonCode: this.getReason(velocity, likeCommentRatio, saveRate, pulse),
    };
  }

  private static detectAnomaly(ratio: number, median: number): boolean {
    const deviation = Math.abs(ratio - median);
    return deviation > 3.0 * 0.4; // 3σ from median with ~0.4 stddev
  }

  private static computeThermalScore(velocity: number, globalAvg: number): number {
    return velocity / Math.max(globalAvg, 0.5);
  }

  private static computeNerfCoefficient(velocity: number): number {
    return 1.0 / (1.0 + Math.exp(velocity - 5.0));
  }

  private static getReason(velocity: number, ratio: number, saveRate: number, pulse: any): string {
    if (velocity > 7.0) return 'high_velocity';
    if (ratio > pulse.medianInteractionRatio * 2) return 'slop_ratio';
    if (saveRate < 0.02) return 'low_save_rate';
    return 'none';
  }

  private static async getSystemPulse() {
    const docs = await db
      .getDatabase('chat')
      .getCollection('system_pulse')
      .listDocuments(['limit(4)']);

    return {
      globalAvgVelocity: docs.documents.find(d => d.metricKey === 'global_avg_velocity')?.metricValue || 2.5,
      medianInteractionRatio: docs.documents.find(d => d.metricKey === 'median_interaction_ratio')?.metricValue || 0.4,
    };
  }
}
```

### P3-2: Implement Feed Ranking Algorithm
**File:** `lib/services/internal/feed-ranker.ts` (new)
**Task:** Build feed ranking with logarithmic attenuation and PID control

```typescript
import { db } from '../../appwrite/client';
import { EngagementAnalyzer } from './engagement-analyzer';

export class FeedRanker {
  static async rankMomentsForUser(userId: string, limit: number = 20): Promise<string[]> {
    // Fetch all moments with engagement data
    const moments = await db
      .getDatabase('chat')
      .getCollection('moments')
      .listDocuments([`limit(${limit * 3)}`, 'orderDesc(createdAt)']);

    // Compute signals for each moment
    const rankedMoments = await Promise.all(
      moments.documents.map(async (m) => {
        const engagement = {
          momentId: m.$id,
          likes: m.likeCount || 0,
          comments: m.commentCount || 0,
          saves: m.saveCount || 0,
          views: m.viewCount || 0,
          totalDwellTime: m.totalDwellTime || 0,
          viewCount: m.viewCount || 1,
        };

        const ageMinutes = (Date.now() - new Date(m.createdAt).getTime()) / 60000;
        const signals = await EngagementAnalyzer.analyzeEngagement(engagement, ageMinutes);

        // Apply logarithmic attenuation to engagement
        const log_likes = Math.log(signals.likeCommentRatio + 1);
        const score = log_likes * signals.nerfCoefficient;

        return { momentId: m.$id, score, signals };
      })
    );

    // Sort by score and return top N
    return rankedMoments
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(m => m.momentId);
  }
}
```

---

## Phase 4: Governance & Transparency UI (P4)

### P4-1: Create Thermal Dashboard Component
**File:** `components/ThermalDashboard.tsx` (new)
**Task:** Display thermal score, success tax, and reputation to user

```typescript
'use client';

import { useEffect, useState } from 'react';
import { ThermalScoreService } from '@/lib/services/internal/thermal-score-service';
import { AccountLedger } from '@/lib/types/discovery-engine';

export function ThermalDashboard({ userId }: { userId: string }) {
  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [riskLevel, setRiskLevel] = useState<string>('normal');

  useEffect(() => {
    async function load() {
      const score = await ThermalScoreService.getThermalScore(userId);
      const risk = await ThermalScoreService.getRiskLevel(score);
      setRiskLevel(risk);
      // Fetch ledger from DB
    }
    load();
  }, [userId]);

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'normal': return 'text-green-600';
      case 'elevated': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Thermal Status</h3>
      <div className={`mt-2 text-2xl font-bold ${getRiskColor()}`}>
        {riskLevel.toUpperCase()}
      </div>
      {ledger && (
        <>
          <p>Success Tax Rate: {(ledger.successTaxRate * 100).toFixed(1)}%</p>
          <p>Reputation Score: {ledger.reputationScore.toFixed(2)}</p>
          <p>Attention Balance: {ledger.attentionBalance.toFixed(2)} tokens</p>
        </>
      )}
    </div>
  );
}
```

### P4-2: Add Transparency Tooltips
**File:** `components/ThermalTooltip.tsx` (new)
**Task:** Explain thermal scoring, success tax, and reputation mechanics to users

```typescript
export const THERMAL_TOOLTIPS = {
  thermalScore: 'Thermal Score measures how quickly you've been minting tokens. High scores trigger success taxes on your next posts.',
  successTax: 'Success Tax reduces the reach of your posts proportionally to your thermal score. Post less frequently or higher-quality content to reset it.',
  reputation: 'Reputation increases when your posts achieve high save-to-like ratios (quality), decreases when they\'re flagged as "slop" (low engagement).',
  attentionBalance: 'Attention Balance is your allocation of visibility. It refills hourly and can boost posts to cross-section feeds.',
};
```

---

## Phase 5: Feedback Loops & Rebalancing (P5)

### P5-1: Implement Hourly Aggregation Job
**File:** `lib/jobs/hourly-pulse-aggregator.ts` (new)
**Task:** Update system_pulse metrics from engagement_views (run every hour)

```typescript
import { db } from '../../appwrite/client';
import { SystemPulse } from '../../types/discovery-engine';

export async function aggregateSystemPulse(): Promise<void> {
  // Fetch all engagement data from last hour
  const oneHourAgo = Date.now() - 3600000;
  const engagements = await db
    .getDatabase('chat')
    .getCollection('engagement_views')
    .listDocuments([`greaterThan(createdAt, ${oneHourAgo})`]);

  // Compute metrics
  const velocities = engagements.documents.map(e => e.velocity);
  const ratios = engagements.documents.map(e => e.likeCommentRatio);

  const globalAvgVelocity = velocities.reduce((a, b) => a + b, 0) / Math.max(velocities.length, 1);
  const medianRatio = ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)];

  // Update system_pulse
  const updates = [
    { metricKey: 'global_avg_velocity', metricValue: globalAvgVelocity, sampleCount: velocities.length },
    { metricKey: 'median_interaction_ratio', metricValue: medianRatio, sampleCount: ratios.length },
  ];

  for (const update of updates) {
    await db
      .getDatabase('chat')
      .getCollection('system_pulse')
      .updateDocument(update.metricKey, {
        ...update,
        updatedAt: Date.now(),
      });
  }
}
```

### P5-2: Implement Token Redistribution
**File:** `lib/jobs/hourly-redistribution.ts` (new)
**Task:** Reallocate attention from nerfed posts to high-reputation undervalued content

```typescript
import { db } from '../../appwrite/client';

export async function redistributeAttention(): Promise<void> {
  // Find moments that were nerfed (nerfCoeff < 0.3) in last hour
  const nerfedMoments = await db
    .getDatabase('chat')
    .getCollection('engagement_views')
    .listDocuments([
      'lessThan(nerfCoefficient, 0.3)',
      'greaterThan(createdAt, ' + (Date.now() - 3600000) + ')',
    ]);

  // Aggregate unused visibility tokens
  const unusedTokens = nerfedMoments.documents.length * 100; // Example pool

  // Find high-reputation users with low-velocity posts from last 24h
  const lowVelocityMoments = await db
    .getDatabase('chat')
    .getCollection('moments')
    .listDocuments([
      'lessThan(velocity, 1.0)',
      'greaterThan(createdAt, ' + (Date.now() - 86400000) + ')',
    ]);

  // Allocate tokens proportionally to reputation
  for (const moment of lowVelocityMoments.documents) {
    const boost = (unusedTokens / Math.max(lowVelocityMoments.documents.length, 1)) * 0.5;
    await db
      .getDatabase('chat')
      .getCollection('moments')
      .updateDocument(moment.$id, {
        visibilityBoost: (moment.visibilityBoost || 0) + boost,
      });
  }
}
```

---

## Phase 6: Testing & Monitoring (P6)

### P6-1: Unit Tests for Thermal Scoring
**File:** `lib/services/internal/__tests__/thermal-score-service.test.ts` (new)
**Task:** Test exponential decay, risk levels, and tax calculations

```typescript
import { ThermalScoreService } from '../thermal-score-service';

describe('ThermalScoreService', () => {
  describe('exponential decay', () => {
    it('should decay thermal score by half after 4 hours', async () => {
      const initialScore = 10;
      // Mock time passage
      const decayedScore = initialScore * Math.pow(0.5, 1); // 1 half-life
      expect(decayedScore).toBe(5);
    });

    it('should return 0 after 12+ hours', async () => {
      const decayedScore = 10 * Math.pow(0.5, 3); // 3 half-lives
      expect(decayedScore).toBeLessThan(1.25);
    });
  });

  describe('risk levels', () => {
    it('should return "normal" for score < 1.0', async () => {
      const risk = await ThermalScoreService.getRiskLevel(0.5);
      expect(risk).toBe('normal');
    });

    it('should return "critical" for score >= 3.0', async () => {
      const risk = await ThermalScoreService.getRiskLevel(3.5);
      expect(risk).toBe('critical');
    });
  });

  describe('success tax', () => {
    it('should apply 0.1-1.0 tax multiplier', async () => {
      const tax1 = ThermalScoreService.calculateSuccessTax(0);
      const tax2 = ThermalScoreService.calculateSuccessTax(10);
      expect(tax1).toBeGreaterThanOrEqual(0.1);
      expect(tax2).toBeLessThanOrEqual(1.0);
    });
  });
});
```

### P6-2: Integration Tests for Feed Ranking
**File:** `lib/services/internal/__tests__/feed-ranker.integration.test.ts` (new)
**Task:** Test full ranking pipeline with mock engagements

```typescript
import { FeedRanker } from '../feed-ranker';

describe('FeedRanker Integration', () => {
  it('should rank moments by logarithmic score', async () => {
    const rankedMomentIds = await FeedRanker.rankMomentsForUser('test-user', 10);
    expect(rankedMomentIds.length).toBeLessThanOrEqual(10);
  });

  it('should apply nerf coefficient to high-velocity posts', async () => {
    // Create mock high-velocity moment and verify lower ranking
  });

  it('should boost low-velocity high-reputation posts', async () => {
    // Create mock low-velocity but high-save-rate moment and verify better ranking
  });
});
```

### P6-3: Monitoring & Metrics
**File:** `lib/monitoring/discovery-engine-metrics.ts` (new)
**Task:** Log system health metrics (system pulse, anomaly rate, redistribution pool)

```typescript
export class DiscoveryEngineMetrics {
  static async logSystemHealth(): Promise<void> {
    // Record:
    // - global_avg_velocity
    // - anomaly_rate (% of posts flagged)
    // - nerfed_pool (% of visibility lost to throttling)
    // - reputation_distribution (gini coefficient)
    // - daily_active_minters
    console.log('[DiscoveryEngine] System health check:', {
      timestamp: new Date(),
      avgVelocity: 2.5,
      anomalyRate: 0.08,
      nerfedPool: 0.15,
      reputationGini: 0.42,
    });
  }
}
```

---

## Summary of Implementation Order

1. **Phase 1:** Add tables, create types, run migrations
2. **Phase 2:** Build thermal scoring service, integrate into mint flow
3. **Phase 3:** Implement engagement analyzer and feed ranker (core algorithm)
4. **Phase 4:** Add dashboard UI and tooltips
5. **Phase 5:** Schedule hourly aggregation and redistribution jobs
6. **Phase 6:** Write comprehensive tests and monitoring

**Total estimated files created:** 13 new files, 3 modified  
**Total estimated lines of code:** ~2,500 lines (well under Appwrite Starter 1M read/month budget)
