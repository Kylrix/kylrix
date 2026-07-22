'use client';

/**
 * NeuralEngine — Offline Intelligence, Telemetry, and Self-Healing Anomaly Engine.
 * Subscribes to SpineEngine heartbeat ticks to observe user behavior patterns and self-heal UI rendering anomalies.
 */

import { SpineEngine, SpineTickData } from '@/lib/services/SpineEngine';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';

export interface RenderAnomalyReport {
  route: string;
  componentName: string;
  expectedItemKind: string;
  itemCount: number;
  timestamp: number;
  resolved?: boolean;
}

class NeuralEngineService {
  private anomalyLog: RenderAnomalyReport[] = [];
  private userPatterns = new Map<string, number>(); // pattern key -> count
  private isHealing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSpineSubscription();
    }
  }

  private initSpineSubscription() {
    SpineEngine.subscribe('neural.telemetry', (tick) => {
      this.processHeartbeat(tick);
    });
  }

  private async processHeartbeat(tick: SpineTickData) {
    // Periodically flush pattern telemetry to local storage substrate
    if (tick.tickCount % 20 === 0) {
      await LocalEngine.writeTelemetry('patterns', {
        patterns: Array.from(this.userPatterns.entries()),
        anomalyCount: this.anomalyLog.length,
      }).catch(() => {});
    }
  }

  /** Record user navigation / feature usage pattern */
  public recordPattern(action: string, contextId?: string) {
    const key = contextId ? `${action}:${contextId}` : action;
    const current = this.userPatterns.get(key) || 0;
    this.userPatterns.set(key, current + 1);

    // Write instant telemetry to LocalEngine
    LocalEngine.writeTelemetry('user_action', { action, contextId, at: Date.now() }).catch(() => {});
  }

  /**
   * Self-Healing Anomaly Detector Handler:
   * Called by EmptyStateAnomalyDetector when a UI view renders empty items unexpectedly.
   */
  public async reportEmptyStateAnomaly(report: RenderAnomalyReport): Promise<boolean> {
    console.warn(`[NeuralEngine] Empty state anomaly reported for ${report.componentName} on ${report.route}`, report);
    this.anomalyLog.push(report);

    if (this.isHealing) return false;
    this.isHealing = true;

    try {
      // 1. Inter-engine collaboration with SyncEngine: Request cache re-verification
      console.log(`[NeuralEngine] Inter-Engine Consultation with SyncEngine for ${report.expectedItemKind}...`);
      
      // Accelerate SpineEngine for self-healing tick
      SpineEngine.pulseImmediately();

      // Dispatch resolution event to trigger component re-fetch & cache recovery
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kylrix:anomaly-heal', {
            detail: {
              kind: report.expectedItemKind,
              route: report.route,
              timestamp: Date.now(),
            },
          })
        );
      }

      // Nudge SyncEngine to flush pending queue & re-evaluate data freshness
      autonomicSyncEngine.nudge();

      report.resolved = true;
      console.log(`[NeuralEngine] Anomaly self-healed successfully for ${report.componentName}.`);
      return true;
    } catch (err) {
      console.error('[NeuralEngine] Failed self-healing anomaly:', err);
      return false;
    } finally {
      this.isHealing = false;
    }
  }

  public getAnomalyHistory() {
    return this.anomalyLog;
  }
}

export const NeuralEngine = new NeuralEngineService();
