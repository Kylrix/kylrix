import { databases } from '../../appwrite/client';
import { AccountLedger, THERMAL_HALF_LIFE_MINUTES } from '../../types/discovery-engine';

export class ThermalScoreService {
  static async getThermalScore(userId: string): Promise<number> {
    try {
      const ledger = await databases.getDocument(
        'chat',
        'account_ledger',
        userId
      ) as unknown as AccountLedger;

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

    try {
        await databases.updateDocument(
            'chat',
            'account_ledger',
            userId,
            {
                thermalCacheScore: newScore,
                thermalCacheAt: Date.now(),
                updatedAt: new Date().toISOString()
            }
        );
    } catch (e) {
        // Handle initial creation if ledger not exists
        await databases.createDocument(
            'chat',
            'account_ledger',
            userId,
            {
                userId,
                attentionBalance: 0,
                successTaxRate: 1.0,
                reputationScore: 1.0,
                lastPeakVelocity: 0,
                thermalCacheScore: newScore,
                thermalCacheAt: Date.now(),
                updatedAt: new Date().toISOString()
            }
        );
    }
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
