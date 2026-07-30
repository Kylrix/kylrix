'use client';

import { AgenticMarkdown } from './AgenticMarkdown';
import { EcosystemHitCards } from './EcosystemHitCards';
import type { AgenticMessageBlock } from '@/lib/agentic/message-blocks';
import type { HydratedEcosystemHit } from '@/lib/agentic/hydrate-ecosystem-hits';

interface AgenticMessageBodyProps {
  content: string;
  blocks?: AgenticMessageBlock[];
  onPickHit?: (hit: HydratedEcosystemHit) => void;
}

export function AgenticMessageBody({ content, blocks, onPickHit }: AgenticMessageBodyProps) {
  const hasBlocks = Boolean(blocks?.length);
  let trimmed = String(content || '').trim();
  if (hasBlocks && trimmed.startsWith('### Search:')) {
    trimmed = '';
  }

  if (!hasBlocks && !trimmed) return null;

  return (
    <div className="flex flex-col gap-3">
      {trimmed ? <AgenticMarkdown content={trimmed} /> : null}
      {blocks?.map((block, idx) => {
        if (block.type === 'markdown') {
          return <AgenticMarkdown key={`md-${idx}`} content={block.content} />;
        }
        if (block.type === 'ecosystem_hits') {
          return (
            <EcosystemHitCards
              key={`hits-${idx}`}
              query={block.query}
              plan={block.plan}
              hits={block.hits}
              onPick={onPickHit}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
