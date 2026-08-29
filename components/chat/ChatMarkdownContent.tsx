'use client';

import React, { useMemo } from 'react';
import {
  defaultMathModeContext,
  isMathModeFlowInstalled,
  renderMarkdownHtml,
} from '@/lib/markdown';
import { parseObjectBlocks, type SecondaryObjectPayload } from '@/lib/note-object-secondary';
import { FormattedText } from '@/components/common/FormattedText';
import { ChatObjectPreview } from '@/components/chat/ChatObjectPreview';

type ContentNode =
  | { type: 'text'; content: string }
  | { type: 'object'; payload: SecondaryObjectPayload };

function splitChatContent(content: string): ContentNode[] {
  const blocks = parseObjectBlocks(content || '');
  if (!blocks.length) return [{ type: 'text', content: content || '' }];

  const nodes: ContentNode[] = [];
  let cursor = 0;
  for (const block of blocks) {
    if (cursor < block.start) {
      nodes.push({ type: 'text', content: content.slice(cursor, block.start) });
    }
    nodes.push({ type: 'object', payload: block.payload });
    cursor = block.end;
  }
  if (cursor < content.length) {
    nodes.push({ type: 'text', content: content.slice(cursor) });
  }
  return nodes;
}

function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /(\*\*|__|\*|_|`|\[.+\]\(|^#{1,6}\s|^[-*]\s|^\d+\.\s)/m.test(t);
}

export function ChatMarkdownContent({
  content,
  linkPreviewsEnabled = true,
}: {
  content: string;
  linkPreviewsEnabled?: boolean;
}) {
  const nodes = useMemo(() => splitChatContent(content), [content]);
  const mathOn = isMathModeFlowInstalled();

  return (
    <div className="space-y-2 min-w-0 [overflow-wrap:anywhere]">
      {nodes.map((node, index) => {
        if (node.type === 'object') {
          return <ChatObjectPreview key={`obj-${index}-${node.payload.childId}`} payload={node.payload} />;
        }

        const trimmed = node.content.trim();
        if (!trimmed) return null;

        if (!looksLikeMarkdown(trimmed)) {
          return (
            <FormattedText
              key={`txt-${index}`}
              text={trimmed}
              linkPreviewsEnabled={linkPreviewsEnabled}
            />
          );
        }

        const html = renderMarkdownHtml(trimmed, defaultMathModeContext(mathOn));
        return (
          <div
            key={`md-${index}`}
            className="chat-markdown kylrix-math-mode text-[13px] leading-relaxed text-white/90 font-satoshi break-words [word-break:break-word] [&_h1]:text-sm [&_h1]:font-extrabold [&_h1]:my-1 [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:my-1 [&_h3]:text-xs [&_h3]:font-bold [&_p]:my-1 [&_p]:text-[13px] [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4 [&_li]:text-[13px] [&_strong]:font-bold [&_strong]:text-white [&_em]:text-white/85 [&_code]:text-[11px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-white/5 [&_a]:text-[#818CF8] [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
