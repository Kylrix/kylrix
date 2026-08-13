import { AgenticMarkdown } from './AgenticMarkdown';
import { EcosystemHitCards } from './EcosystemHitCards';
import { JsonRenderer, looksLikeJson } from './JsonRenderer';
import { AgenticWalletCards } from './AgenticWalletCards';
import { AgenticUserCards } from './AgenticUserCards';
import { AgenticChainSelector } from './AgenticChainSelector';
import type { AgenticMessageBlock } from '@/lib/agentic/message-blocks';
import type { HydratedEcosystemHit } from '@/lib/agentic/hydrate-ecosystem-hits';

interface AgenticMessageBodyProps {
  content: string;
  blocks?: AgenticMessageBlock[];
  onPickHit?: (hit: HydratedEcosystemHit) => void;
  onSelectChain?: (chain: string) => void;
}

export function AgenticMessageBody({ content, blocks, onPickHit, onSelectChain }: AgenticMessageBodyProps) {
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
        if (block.type === 'chain_selector') {
          return (
            <AgenticChainSelector
              key={`chain-sel-${idx}`}
              title={block.title}
              selectedChain={block.selectedChain}
              chains={block.chains}
              onSelectChain={onSelectChain}
            />
          );
        }
        if (block.type === 'pending_auth') {
          return (
            <div
              key={`auth-${idx}`}
              className="p-3 rounded-2xl bg-[#161412] border border-[#6366F1]/30 flex items-center justify-between gap-3 text-left my-1"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  block.status === 'authorized'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : block.status === 'rejected'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-[#6366F1]/20 text-[#6366F1] animate-pulse'
                }`}>
                  <span className="text-xs font-bold font-mono">
                    {block.status === 'authorized' ? '✓' : block.status === 'rejected' ? '✕' : '⏳'}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white font-satoshi truncate">
                    {block.name}
                  </div>
                  <div className="text-[10px] text-white/50 font-satoshi">
                    {block.status === 'authorized'
                      ? 'Action authorized & executed'
                      : block.status === 'rejected'
                      ? 'Action authorization denied'
                      : 'Confirmation drawer popped up'}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                block.status === 'authorized'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : block.status === 'rejected'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-[#6366F1]/10 text-[#818cf8] border border-[#6366F1]/20'
              }`}>
                {block.status}
              </span>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
