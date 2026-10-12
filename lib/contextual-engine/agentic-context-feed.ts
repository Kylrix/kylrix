import { contextManager } from './context-manager';
import { localKnowledgeGraph } from './local-graph';
import { ContextObject, ContextRanking } from './types';

export interface AgenticContextPayload {
  primaryContext?: ContextObject;
  rankedContexts: ContextRanking[];
  correlatedEntities: Array<{
    id: string;
    kind: string;
    distance: number;
    relation: string;
  }>;
  activeClarifications: string[];
  systemContextPrompt: string;
}

export class AgenticContextFeed {
  /**
   * Build comprehensive contextual context for an agentic session or Sidekick drawer.
   */
  public buildContextForSession(options: {
    activeObjectId?: string;
    activeWorkspaceId?: string;
    recentUserQuery?: string;
  }): AgenticContextPayload {
    const { activeObjectId, activeWorkspaceId } = options;

    let rankedContexts: ContextRanking[] = [];
    if (activeObjectId) {
      rankedContexts = contextManager.findContextsForObject(activeObjectId, { limit: 4 });
    }

    // Fallback or augment with workspace contexts
    if (activeWorkspaceId && rankedContexts.length === 0) {
      const all = contextManager.getAllContexts();
      const wsContexts = all.filter((c) => c.workspaceId === activeWorkspaceId);
      rankedContexts = wsContexts.map((ctx, idx) => ({
        context: ctx,
        rank: idx + 1,
        score: ctx.weight,
        attachedObjectCount: contextManager.getAttachedObjectCount(ctx.id),
        matchedKeywords: ctx.metadata?.keywords || [],
      }));
    }

    const primaryContext = rankedContexts[0]?.context;

    // Correlated knowledge graph items
    let correlatedEntities: Array<{
      id: string;
      kind: string;
      distance: number;
      relation: string;
    }> = [];

    if (activeObjectId) {
      const rel = localKnowledgeGraph.getRelated(activeObjectId, {
        maxDistance: 0.7,
        minConfidence: 0.6,
        limit: 6,
      });
      correlatedEntities = rel.map((r) => ({
        id: r.nodeId,
        kind: r.kind,
        distance: r.distance,
        relation: r.relation,
      }));
    }

    // Collect user clarifications from ranked contexts
    const activeClarifications: string[] = [];
    for (const item of rankedContexts) {
      if (item.context.clarifications?.length) {
        for (const cl of item.context.clarifications) {
          activeClarifications.push(
            `User clarified: "${cl.correction}" (overriding: "${cl.text}")`
          );
        }
      }
    }

    // Compile into clean system prompt injection
    const promptSections: string[] = [];

    if (primaryContext) {
      promptSections.push(
        `[Active Context: ${primaryContext.title}] (Confidence: ${Math.round(primaryContext.confidence * 100)}%, Weight: ${primaryContext.weight.toFixed(1)})`
      );
      if (primaryContext.description) {
        promptSections.push(`Context Summary: ${primaryContext.description}`);
      }
    }

    if (activeClarifications.length) {
      promptSections.push(`Crucial User Clarifications:\n- ${activeClarifications.join('\n- ')}`);
    }

    if (correlatedEntities.length) {
      const entityStr = correlatedEntities
        .map((e) => `${e.kind}:${e.id} (${e.relation})`)
        .join(', ');
      promptSections.push(`Correlated Objects in Graph: ${entityStr}`);
    }

    return {
      primaryContext,
      rankedContexts,
      correlatedEntities,
      activeClarifications,
      systemContextPrompt: promptSections.join('\n\n'),
    };
  }
}

export const agenticContextFeed = new AgenticContextFeed();
