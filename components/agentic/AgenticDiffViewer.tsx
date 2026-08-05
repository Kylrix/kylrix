'use client';

import React from 'react';
import { Sparkles, Plus, Minus } from 'lucide-react';

export interface DiffChange {
  field: string;
  oldValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
}

export interface AgenticDiffViewerProps {
  title?: string;
  changes: DiffChange[];
  className?: string;
}

export function AgenticDiffViewer({ title = 'Agentic Deductions & Additions', changes, className = '' }: AgenticDiffViewerProps) {
  if (!changes || changes.length === 0) return null;

  return (
    <div className={`rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-3.5 my-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2 text-[11px] font-black uppercase tracking-wider text-indigo-400">
        <Sparkles size={13} />
        <span>{title}</span>
      </div>
      <div className="flex flex-col gap-2">
        {changes.map((change, idx) => (
          <div key={`${change.field}-${idx}`} className="text-xs font-mono flex flex-col gap-1 bg-black/30 p-2 rounded-lg border border-white/5">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wide">{change.field}</span>
            {change.oldValue !== undefined && change.oldValue !== null && change.oldValue !== '' ? (
              <div className="flex items-start gap-1.5 text-red-400/90 leading-tight">
                <Minus size={12} className="shrink-0 mt-0.5" />
                <span className="line-through opacity-70 break-all">{String(change.oldValue)}</span>
              </div>
            ) : null}
            {change.newValue !== undefined && change.newValue !== null && change.newValue !== '' ? (
              <div className="flex items-start gap-1.5 text-emerald-400 leading-tight">
                <Plus size={12} className="shrink-0 mt-0.5" />
                <span className="break-all">{String(change.newValue)}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
