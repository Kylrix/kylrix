'use client';

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { PredictiveSuggestion } from './types';

interface Props {
  inlineSuffix?: string;
  suggestions: PredictiveSuggestion[];
  onAccept: (s: PredictiveSuggestion) => void;
  className?: string;
}

export function ContextualAutocompleteOverlay({
  inlineSuffix,
  suggestions,
  onAccept,
  className = '',
}: Props) {
  if (!inlineSuffix && (!suggestions || suggestions.length === 0)) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 py-1 px-1.5 animate-fadeIn select-none ${className}`}
    >
      {inlineSuffix && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 text-[10px] font-mono text-[#818cf8]">
          <span className="text-white/40">Tab to complete:</span>
          <span className="font-bold text-white truncate max-w-[150px]">{inlineSuffix}</span>
          <kbd className="px-1 py-0.2 bg-black/40 rounded border border-white/10 text-[8px] text-white/60">
            Tab ⇥
          </kbd>
        </div>
      )}

      {suggestions.slice(0, 3).map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onAccept(s)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#161412] hover:bg-[#1C1A18] border border-white/5 hover:border-white/15 text-[10px] font-mono text-white/70 hover:text-white transition-all cursor-pointer group"
          title={`Confidence: ${Math.round(s.confidence * 100)}%`}
        >
          <Sparkles className="w-2.5 h-2.5 text-[#6366F1] group-hover:scale-110 transition-transform" />
          <span className="truncate max-w-[140px]">{s.text}</span>
          <ArrowRight className="w-2 h-2 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </button>
      ))}
    </div>
  );
}
