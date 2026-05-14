import { databases } from '../../appwrite/client';
import { EngagementAnalyzer } from './engagement-analyzer';

export class FeedRanker {
  static async rankMomentsForUser(userId: string, limit: number = 20): Promise<string[]> {
    const moments = await databases.listDocuments(
      'chat',
      'moments',
      [`limit(${limit * 3})`, 'orderDesc($createdAt)']
    );

    const rankedMoments = await Promise.all(
      moments.documents.map(async (m: any) => {
        const engagement = {
          momentId: m.$id,
          likes: m.likeCount || 0,
          comments: m.commentCount || 0,
          saves: m.saveCount || 0,
          views: m.viewCount || 0,
          totalDwellTime: m.totalDwellTime || 0,
          viewCount: m.viewCount || 1,
        };

        const ageMinutes = (Date.now() - new Date(m.$createdAt).getTime()) / 60000;
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
