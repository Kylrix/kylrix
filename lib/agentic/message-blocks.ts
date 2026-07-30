/**
 * Structured agentic chat blocks — UI hydrates titles/previews from local copy by id.
 */

import type { SearchDomain, SearchPlan } from './search-engine';

export type EcosystemHitRef = {
  domain: SearchDomain;
  id: string;
};

export type AgenticMessageBlock =
  | { type: 'markdown'; content: string }
  | {
      type: 'ecosystem_hits';
      query: string;
      plan?: Pick<SearchPlan, 'reasoning' | 'temporal' | 'domains'>;
      hits: EcosystemHitRef[];
    };

const KYLIX_BLOCKS_PREFIX = '__KYLIX_BLOCKS__:';

export function serializeBlocksForToolSummary(blocks: AgenticMessageBlock[]): string {
  return `${KYLIX_BLOCKS_PREFIX}${JSON.stringify(blocks)}`;
}

export function parseBlocksFromToolSummary(summary?: string | null): AgenticMessageBlock[] | null {
  if (!summary?.startsWith(KYLIX_BLOCKS_PREFIX)) return null;
  try {
    const parsed = JSON.parse(summary.slice(KYLIX_BLOCKS_PREFIX.length));
    return Array.isArray(parsed) ? (parsed as AgenticMessageBlock[]) : null;
  } catch {
    return null;
  }
}

export function hitsToRefs(hits: Array<{ domain: SearchDomain; id: string }>): EcosystemHitRef[] {
  return hits.map((h: any) => ({ domain: h.domain, id: h.id }));
}
