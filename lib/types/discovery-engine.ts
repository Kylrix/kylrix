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
