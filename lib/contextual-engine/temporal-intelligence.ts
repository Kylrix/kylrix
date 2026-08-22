import { TemporalCluster, ContextKind, ContextualNiche } from './types';
import { patternMatcher } from './pattern-matcher';

export interface TimelineActivityItem {
  id: string;
  kind: ContextKind;
  title?: string;
  description?: string;
  tags?: string[];
  timestamp: string;
  niche?: ContextualNiche;
}

export class TemporalIntelligenceEngine {
  /**
   * Scan activity items and cluster into temporal periods (e.g., 1 year ago, 6 months ago, 1 month ago).
   */
  public clusterTimeline(
    items: TimelineActivityItem[],
    options: {
      targetWindowDays?: number; // e.g. 30 days per cluster
    } = {}
  ): TemporalCluster[] {
    if (!items.length) return [];

    const windowDays = options.targetWindowDays ?? 30;
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    // Sort items chronologically
    const sorted = [...items].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const clusters: TemporalCluster[] = [];
    let currentClusterItems: TimelineActivityItem[] = [];
    let clusterStartTime = new Date(sorted[0].timestamp).getTime();

    for (const item of sorted) {
      const itemTime = new Date(item.timestamp).getTime();
      if (itemTime - clusterStartTime > windowMs && currentClusterItems.length > 0) {
        clusters.push(this.buildCluster(currentClusterItems));
        currentClusterItems = [item];
        clusterStartTime = itemTime;
      } else {
        currentClusterItems.push(item);
      }
    }

    if (currentClusterItems.length > 0) {
      clusters.push(this.buildCluster(currentClusterItems));
    }

    return clusters;
  }

  /**
   * Query milestone activity around a specific historical date (e.g., "1 year ago").
   */
  public queryHistoricalFocus(
    items: TimelineActivityItem[],
    targetDate: Date,
    windowDays = 45
  ): TemporalCluster | null {
    const targetMs = targetDate.getTime();
    const halfWindowMs = (windowDays / 2) * 24 * 60 * 60 * 1000;

    const matched = items.filter((it) => {
      const itMs = new Date(it.timestamp).getTime();
      return Math.abs(itMs - targetMs) <= halfWindowMs;
    });

    if (!matched.length) return null;
    return this.buildCluster(matched);
  }

  private buildCluster(items: TimelineActivityItem[]): TemporalCluster {
    const start = items[0].timestamp;
    const end = items[items.length - 1].timestamp;

    // Determine dominant niche
    const nicheCounts: Record<string, number> = {};
    const wordFreq: Record<string, number> = {};

    for (const item of items) {
      const n = item.niche || 'workspace';
      nicheCounts[n] = (nicheCounts[n] || 0) + 1;

      const tokens = patternMatcher.tokenize(`${item.title || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`);
      for (const t of tokens) {
        if (t.length > 3) {
          wordFreq[t] = (wordFreq[t] || 0) + 1;
        }
      }
    }

    let dominantNiche: ContextualNiche = 'workspace';
    let maxNicheCount = 0;
    for (const [n, count] of Object.entries(nicheCounts)) {
      if (count > maxNicheCount) {
        maxNicheCount = count;
        dominantNiche = n as ContextualNiche;
      }
    }

    // Extract top themes
    const topThemes = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    const startDate = new Date(start);
    const label = `${startDate.toLocaleString('default', { month: 'short' })} ${startDate.getFullYear()} Focus`;

    return {
      id: `cluster_${startDate.getTime()}`,
      timeRange: { start, end },
      label,
      dominantNiche,
      objectIds: items.map((it) => ({ id: it.id, kind: it.kind, title: it.title })),
      themes: topThemes,
      intensityScore: items.length,
    };
  }
}

export const temporalIntelligence = new TemporalIntelligenceEngine();
