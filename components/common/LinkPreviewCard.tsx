'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, Globe } from 'lucide-react';

interface LinkPreviewCardProps {
  url: string;
}

interface LinkMeta {
  title: string;
  description?: string;
  domain: string;
  image?: string;
}

export function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);

  useEffect(() => {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.replace(/^www\./, '');
      const pathTitle = parsedUrl.pathname.split('/').filter(Boolean).pop() || domain;
      const formattedTitle = pathTitle.replace(/[-_]/g, ' ');

      setMeta({
        title: formattedTitle.charAt(0).toUpperCase() + formattedTitle.slice(1),
        description: `Link preview for ${domain}`,
        domain,
      });
    } catch {
      setMeta(null);
    }
  }, [url]);

  if (!meta) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-[#A855F7] hover:underline font-mono"
      >
        <Globe className="w-3.5 h-3.5" />
        {url}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-2 flex items-center justify-between p-3 rounded-xl bg-[#161412] border border-[#1C1A18] hover:border-[#34322F] transition-all group no-underline text-left max-w-md"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-[#0A0908] border border-[#1C1A18] text-[#A855F7] shrink-0">
          <Globe className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#F5F2ED] truncate group-hover:text-[#A855F7] transition-colors">
            {meta.title}
          </p>
          <p className="text-[11px] text-[#9B9691] font-mono mt-0.5 truncate">
            {meta.domain}
          </p>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-[#9B9691] group-hover:text-[#F5F2ED] shrink-0 ml-2" />
    </a>
  );
}
