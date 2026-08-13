import { AgenticMarkdown } from './AgenticMarkdown';
import { EcosystemHitCards } from './EcosystemHitCards';
import { JsonRenderer, looksLikeJson } from './JsonRenderer';
import { AgenticWalletCards } from './AgenticWalletCards';
import { AgenticUserCards } from './AgenticUserCards';
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

  // If content is raw JSON envelope (toolCalls or json structure), render via collapsed JsonRenderer, not markdown
  const isJsonEnvelope = looksLikeJson(trimmed);
  const shouldUseJsonRenderer = isJsonEnvelope && !hasBlocks;

  return (
    <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
      {trimmed ? (shouldUseJsonRenderer ? <JsonRenderer raw={trimmed} collapsed /> : <AgenticMarkdown content={trimmed} />) : null}
      {blocks?.map((block, idx) => {
        if (block.type === 'markdown') {
          // If block content itself is JSON, use JsonRenderer
          if (looksLikeJson(block.content)) {
            return <JsonRenderer key={`md-${idx}`} raw={block.content} collapsed />;
          }
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
        if (block.type === 'wallet_balances') {
          return (
            <AgenticWalletCards
              key={`wallet-${idx}`}
              items={block.items}
              totalKylrix={block.totalKylrix}
            />
          );
        }
        if (block.type === 'user_search') {
          return (
            <AgenticUserCards
              key={`users-${idx}`}
              query={block.query}
              users={block.users}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
