'use client';

import { useMemo } from 'react';
import {
  defaultMathModeContext,
  isMathModeFlowInstalled,
  renderMarkdownHtml,
} from '@/lib/markdown';

interface AgenticMarkdownProps {
  content: string;
  className?: string;
}

export function AgenticMarkdown({ content, className = '' }: AgenticMarkdownProps) {
  const html = useMemo(() => {
    const trimmed = String(content || '').trim();
    if (!trimmed) return '';
    const mathOn = isMathModeFlowInstalled();
    return renderMarkdownHtml(trimmed, defaultMathModeContext(mathOn));
  }, [content]);

  if (!html) return null;

  return (
    <div
      className={`agentic-markdown kylrix-math-mode prose prose-invert prose-sm max-w-none text-white/90 leading-relaxed font-satoshi [&_h1]:text-base [&_h1]:font-black [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-extrabold [&_h2]:mb-1.5 [&_h3]:text-[13px] [&_h3]:font-bold [&_p]:my-1.5 [&_p]:text-[13px] [&_ul]:my-1.5 [&_ul]:pl-4 [&_ol]:my-1.5 [&_ol]:pl-4 [&_li]:text-[13px] [&_li]:my-0.5 [&_strong]:text-white [&_em]:text-white/80 [&_code]:text-[11px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-white/5 [&_a]:text-[#818CF8] [&_a]:underline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
