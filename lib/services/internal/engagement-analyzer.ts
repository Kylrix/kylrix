import { databases } from '../../appwrite/client';
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
    return deviation > 3.0 * 0.4;
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
    try {
        const docs = await databases.listDocuments(
            'chat',
            'system_pulse',
            []
        );

        return {
          globalAvgVelocity: docs.documents.find(d => d.metricKey === 'global_avg_velocity')?.metricValue || 2.5,
          medianInteractionRatio: docs.documents.find(d => d.metricKey === 'median_interaction_ratio')?.metricValue || 0.4,
        };
    } catch {
        return { globalAvgVelocity: 2.5, medianInteractionRatio: 0.4 };
    }
  }
}
