

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

