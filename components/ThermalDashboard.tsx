'use client';

import { useEffect, useState } from 'react';
import { ThermalScoreService } from '@/lib/services/internal/thermal-score-service';
import { AccountLedger } from '@/lib/types/discovery-engine';
import { databases } from '@/lib/appwrite/client';

export function ThermalDashboard({ userId }: { userId: string }) {
  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [riskLevel, setRiskLevel] = useState<string>('normal');

  useEffect(() => {
    async function load() {
      const score = await ThermalScoreService.getThermalScore(userId);
      const risk = await ThermalScoreService.getRiskLevel(score);
      setRiskLevel(risk);

      try {
        const doc = await databases.getDocument('chat', 'account_ledger', userId);
        setLedger(doc as unknown as AccountLedger);
      } catch (e) {
        console.error('Failed to load ledger', e);
      }
    }
    load();
  }, [userId]);

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'normal': return 'text-green-600';
      case 'elevated': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold">Thermal Status</h3>
      <div className={`mt-2 text-2xl font-bold ${getRiskColor()}`}>
        {riskLevel.toUpperCase()}
      </div>
      {ledger && (
        <div className="mt-4 text-sm space-y-1">
          <p>Success Tax Rate: {(ledger.successTaxRate * 100).toFixed(1)}%</p>
          <p>Reputation Score: {ledger.reputationScore.toFixed(2)}</p>
          <p>Attention Balance: {ledger.attentionBalance.toFixed(2)} tokens</p>
        </div>
      )}
    </div>
  );
}
