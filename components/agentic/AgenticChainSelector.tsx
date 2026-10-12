'use client';

import React from 'react';
import { Layers } from 'lucide-react';

interface ChainItem {
  symbol: string;
  name: string;
  color: string;
  supported: boolean;
}

interface AgenticChainSelectorProps {
  title?: string;
  selectedChain?: string;
  chains: ChainItem[];
  onSelectChain?: (chainSymbol: string) => void;
}

export function AgenticChainSelector({
  title = 'Select Network / Token Chain',
  selectedChain,
  chains,
  onSelectChain,
}: AgenticChainSelectorProps) {
  return (
    <div className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] shadow-sm flex flex-col gap-2.5 my-2 w-full text-left">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white/75 font-satoshi">
          <Layers size={14} className="text-[#6366F1]" />
          <span>{title}</span>
        </div>
        <span className="text-[10px] text-white/40 font-mono">Interactive</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {chains.map((c) => {
          const isSelected = selectedChain?.toUpperCase() === c.symbol.toUpperCase();
          return (
            <button
              key={c.symbol}
              type="button"
              onClick={() => onSelectChain?.(c.symbol)}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer select-none ${
                isSelected
                  ? 'bg-[#6366F1]/15 border-[#6366F1]/40 text-white ring-1 ring-[#6366F1]/30'
                  : 'bg-[#0A0908] border-white/[0.05] hover:bg-white/[0.04] text-white/80 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg bg-black/40 border border-white/[0.08] flex items-center justify-center text-[10px] font-black font-mono shrink-0"
                  style={{ color: c.color }}
                >
                  {c.symbol.slice(0, 3)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold font-satoshi truncate leading-tight">
                    {c.name}
                  </div>
                  <div className="text-[9px] text-white/40 font-mono truncate">
                    {c.symbol}
                  </div>
                </div>
              </div>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
