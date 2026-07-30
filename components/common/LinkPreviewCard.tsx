'use client';

import React, { useMemo } from 'react';
import { ExternalLink, Globe } from 'lucide-react';

interface LinkPreviewCardProps {
  url: string;
}

function truncateMiddle(value: string, max = 64) {
  if (value.length <= max) return value;
  const keep = Math.floor((max - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

/** Sync meta only — no useEffect/setState (avoids feed re-paint storms). */
export function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const meta = useMemo(() => {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.replace(/^www\./, '');
      const pathTitle = parsedUrl.pathname.split('/').filter(Boolean).pop() || domain;
      const formattedTitle = pathTitle.replace(/[-_]/g, ' ');
      return {
        title: formattedTitle.charAt(0).toUpperCase() + formattedTitle.slice(1),
        domain};
    } catch {
      return null;
    }
  }, [url]);

  if (!meta) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-[#F59E0B] hover:underline font-mono min-w-0 max-w-full"
      >
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{truncateMiddle(url, 72)}</span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-xl bg-[#0A0908] border border-[#1C1A18] no-underline text-left w-full max-w-full min-w-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-[#161412] border border-[#1C1A18] text-[#F59E0B] shrink-0">
          <Globe className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#F5F2ED] truncate">{meta.title}</p>
          <p className="text-[11px] text-[#9B9691] font-mono mt-0.5 truncate">{meta.domain}</p>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-[#9B9691] shrink-0 ml-2" />
    </a>
  );
}
