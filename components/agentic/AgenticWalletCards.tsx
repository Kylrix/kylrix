'use client';

import React from 'react';
import { Wallet, Copy, Check } from 'lucide-react';
import type { WalletBalanceItem } from '@/lib/agentic/message-blocks';
import { toast } from 'react-hot-toast';
import { useWalletOverlay } from '@/context/WalletOverlayContext';

export function AgenticWalletCards({
  items,
  totalKylrix: _totalKylrix,
}: {
  items: WalletBalanceItem[];
  totalKylrix?: string;
}) {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const { openWallet } = useWalletOverlay();

  const handleCopy = (address: string, idx: number) => {
    navigator.clipboard.writeText(address);
    setCopiedIndex(idx);
    toast.success('Address copied');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col gap-2.5 my-2 w-full">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white/70 font-satoshi">
          <Wallet size={14} className="text-[#6366F1]" />
          <span>Wallet Chains & Balances</span>
        </div>
        <button
          type="button"
          onClick={() => openWallet()}
          className="text-[11px] text-[#6366F1] hover:underline font-bold cursor-pointer"
        >
          Open Wallet
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item, idx) => (
          <div
            key={`${item.token}-${idx}`}
            className="p-3 rounded-2xl bg-[#161412] border border-white/[0.08] flex flex-col justify-between gap-2 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg bg-[#0A0908] border border-white/[0.06] flex items-center justify-center font-bold text-xs"
                  style={{ color: item.color || '#6366F1' }}
                >
                  {item.token.slice(0, 3)}
                </div>
                <div>
                  <div className="text-xs font-bold text-white font-satoshi leading-tight">
                    {item.chainName}
                  </div>
                  <div className="text-[10px] text-white/40 font-mono">
                    {item.token}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-xs font-black font-mono"
                  style={{ color: item.color || '#6366F1' }}
                >
                  {item.balance} {item.token}
                </div>
              </div>
            </div>

            {item.address && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
                <span className="text-[10px] font-mono text-white/40 truncate max-w-[150px]">
                  {item.address.slice(0, 8)}...{item.address.slice(-6)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(item.address!, idx)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
                  title="Copy address"
                >
                  {copiedIndex === idx ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
