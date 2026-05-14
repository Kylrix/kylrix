import { databases } from '../appwrite/client';

export async function aggregateSystemPulse(): Promise<void> {
  const oneHourAgo = Date.now() - 3600000;
  const engagements = await databases.listDocuments(
    'chat',
    'engagement_views',
    [`greaterThan(createdAt, ${oneHourAgo})`]
  );

  const velocities = engagements.documents.map(e => (e as any).velocity);
  const ratios = engagements.documents.map(e => (e as any).likeCommentRatio);

  const globalAvgVelocity = velocities.reduce((a, b) => a + b, 0) / Math.max(velocities.length, 1);
  const medianRatio = ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)];

  const updates = [
    { metricKey: 'global_avg_velocity', metricValue: globalAvgVelocity, sampleCount: velocities.length },
    { metricKey: 'median_interaction_ratio', metricValue: medianRatio, sampleCount: ratios.length },
  ];

  for (const update of updates) {
    await databases.updateDocument(
        'chat',
        'system_pulse',
        update.metricKey,
        {
          ...update,
          updatedAt: Date.now(),
        }
    );
  }
}
