import { databases } from '../appwrite/client';
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
      await databases.createDocument(
        'chat',
        'system_pulse',
        metric.metricKey,
        {
          ...metric,
          updatedAt: Date.now(),
        }
      );
    } catch (e: any) {
      if (!e.message.includes('Document with the requested ID')) throw e;
    }
  }
}
