'use client';

import React, { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { NeuralEngine, RenderAnomalyReport } from '@/lib/services/NeuralEngine';

interface NeuralContextType {
  recordPattern: (action: string, contextId?: string) => void;
  reportAnomaly: (report: RenderAnomalyReport) => Promise<boolean>;
  getAnomalyHistory: () => RenderAnomalyReport[];
}

const NeuralContext = createContext<NeuralContextType | undefined>(undefined);

export function NeuralProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    NeuralEngine.recordPattern('navigate', pathname);
  }, [pathname]);

  const value: NeuralContextType = {
    recordPattern: (action, contextId) => NeuralEngine.recordPattern(action, contextId),
    reportAnomaly: (report) => NeuralEngine.reportEmptyStateAnomaly(report),
    getAnomalyHistory: () => NeuralEngine.getAnomalyHistory(),
  };

  return <NeuralContext.Provider value={value}>{children}</NeuralContext.Provider>;
}

export function useNeural() {
  const ctx = useContext(NeuralContext);
  if (!ctx) {
    throw new Error('useNeural must be used within a NeuralProvider');
  }
  return ctx;
}

interface EmptyStateAnomalyDetectorProps {
  componentName: string;
  expectedItemKind: string;
  itemCount: number;
  isLoading?: boolean;
  onHeal?: () => void;
  children?: ReactNode;
}

/**
 * Reusable Modular Anomaly Detector Component.
 * Monitors view item counts. If 0 items rendered unexpectedly, reports anomaly to NeuralEngine,
 * which collaborates with SyncEngine to auto-repair cache locks and trigger onHeal().
 */
export function EmptyStateAnomalyDetector({
  componentName,
  expectedItemKind,
  itemCount,
  isLoading = false,
  onHeal,
  children,
}: EmptyStateAnomalyDetectorProps) {
  const pathname = usePathname();
  const { reportAnomaly } = useNeural();

  useEffect(() => {
    if (isLoading || itemCount > 0) return;

    // Grace period before flagging as unusual empty render anomaly
    const timer = setTimeout(() => {
      if (itemCount === 0 && !isLoading) {
        reportAnomaly({
          route: pathname || '/',
          componentName,
          expectedItemKind,
          itemCount: 0,
          timestamp: Date.now(),
        });
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [itemCount, isLoading, componentName, expectedItemKind, pathname, reportAnomaly]);

  // Listen for NeuralEngine anomaly-heal dispatch
  useEffect(() => {
    if (typeof window === 'undefined' || !onHeal) return;

    const handleHeal = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail?.kind === expectedItemKind || customEv.detail?.kind === 'all') {
        console.log(`[EmptyStateAnomalyDetector] Auto-healing trigger received for ${componentName}`);
        onHeal();
      }
    };

    window.addEventListener('kylrix:anomaly-heal', handleHeal);
    return () => window.removeEventListener('kylrix:anomaly-heal', handleHeal);
  }, [componentName, expectedItemKind, onHeal]);

  return <>{children}</>;
}
