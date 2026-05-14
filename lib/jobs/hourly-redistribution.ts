import { databases } from '../appwrite/client';

export async function redistributeAttention(): Promise<void> {
  const oneHourAgo = Date.now() - 3600000;
  const nerfedMoments = await databases.listDocuments(
    'chat',
    'engagement_views',
    [
      'lessThan(nerfCoefficient, 0.3)',
      `greaterThan(createdAt, ${oneHourAgo})`
    ]
  );

  const unusedTokens = nerfedMoments.documents.length * 100;

  const lowVelocityMoments = await databases.listDocuments(
    'chat',
    'moments',
    [
      'lessThan(velocity, 1.0)',
      `greaterThan(createdAt, ${Date.now() - 86400000})`
    ]
  );

  for (const moment of lowVelocityMoments.documents) {
    const boost = (unusedTokens / Math.max(lowVelocityMoments.documents.length, 1)) * 0.5;
    await databases.updateDocument(
        'chat',
        'moments',
        moment.$id,
        {
          visibilityBoost: ((moment.visibilityBoost as number) || 0) + boost,
        }
    );
  }
}
