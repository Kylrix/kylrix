'use client';

import React from 'react';
import { useWebMcpContext } from '@/context/WebMcpContext';
import { Terminal } from 'lucide-react';

export function WebMcpStatusBadge({ className = '' }: { className?: string }) {
  const { isInitialized, tools, toggleInspector } = useWebMcpContext();

  if (!isInitialized) return null;

  return (
    <button
      onClick={toggleInspector}
      type="button"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md bg-[#121212] border border-[#262626] hover:border-[#404040] hover:bg-[#1a1a1a] transition-all text-neutral-300 ${className}`}
      title="WebMCP is active in this browser. Click to inspect tools and logs."
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <Terminal className="w-3.5 h-3.5 text-neutral-400" />
      <span className="font-medium tracking-tight">WebMCP</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#222] text-neutral-400">
        {tools.length}
      </span>
    </button>
  );
}
