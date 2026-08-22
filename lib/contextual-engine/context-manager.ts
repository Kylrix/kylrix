import { ContextObject, ContextRanking, ContextKind } from './types';
import { localKnowledgeGraph } from './local-graph';
import { patternMatcher } from './pattern-matcher';

const CONTEXTS_CACHE_KEY = 'kylrix_context_objects_v1';
const OBJECT_CONTEXT_LINKS_KEY = 'kylrix_object_context_links_v1';

export interface ObjectContextLink {
  objectId: string;
  objectKind: ContextKind;
  contextId: string;
  weight: number;
  rank?: number;
  pinned?: boolean;
  createdAt: string;
}

export class ContextManager {
  private contexts: Map<string, ContextObject> = new Map();
  private links: Map<string, ObjectContextLink> = new Map(); // key: `${objectId}:${contextId}`

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const rawContexts = localStorage.getItem(CONTEXTS_CACHE_KEY);
      if (rawContexts) {
        const parsed: ContextObject[] = JSON.parse(rawContexts);
        for (const c of parsed) this.contexts.set(c.id, c);
      }
      const rawLinks = localStorage.getItem(OBJECT_CONTEXT_LINKS_KEY);
      if (rawLinks) {
        const parsedLinks: ObjectContextLink[] = JSON.parse(rawLinks);
        for (const l of parsedLinks) this.links.set(`${l.objectId}:${l.contextId}`, l);
      }
    } catch {}
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CONTEXTS_CACHE_KEY, JSON.stringify(Array.from(this.contexts.values())));
      localStorage.setItem(OBJECT_CONTEXT_LINKS_KEY, JSON.stringify(Array.from(this.links.values())));
    } catch {}
  }

  /**
   * Create or update a Context super-object.
   */
  public upsertContext(
    data: Partial<ContextObject> & { id: string; userId: string }
  ): ContextObject {
    const existing = this.contexts.get(data.id);
    const now = new Date().toISOString();

    const context: ContextObject = {
      id: data.id,
      title: data.title || existing?.title || 'General Context',
      description: data.description ?? existing?.description,
      niche: data.niche || existing?.niche || 'workspace',
      scopeKey: data.scopeKey || existing?.scopeKey,
      workspaceId: data.workspaceId || existing?.workspaceId,
      userId: data.userId,
      confidence: data.confidence ?? existing?.confidence ?? 1.0,
      weight: data.weight ?? existing?.weight ?? 1.0,
      isAnonymized: data.isAnonymized ?? existing?.isAnonymized ?? false,
      clarifications: data.clarifications || existing?.clarifications || [],
      metadata: { ...existing?.metadata, ...data.metadata },
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.contexts.set(context.id, context);
    this.saveToStorage();
    return context;
  }

  /**
   * Link an object to a context (many-to-many relationship with ranking weight).
   */
  public attachObjectToContext(
    objectId: string,
    objectKind: ContextKind,
    contextId: string,
    options: { weight?: number; pinned?: boolean } = {}
  ): ObjectContextLink {
    const linkKey = `${objectId}:${contextId}`;
    const now = new Date().toISOString();
    const existing = this.links.get(linkKey);

    const link: ObjectContextLink = {
      objectId,
      objectKind,
      contextId,
      weight: options.weight ?? existing?.weight ?? 1.0,
      pinned: options.pinned ?? existing?.pinned ?? false,
      createdAt: existing?.createdAt || now,
    };

    this.links.set(linkKey, link);
    this.saveToStorage();
    return link;
  }

  /**
   * Find all contexts associated with a given object, ranked by relevance and weight.
   */
  public findContextsForObject(
    objectId: string,
    options: {
      minScore?: number;
      limit?: number;
    } = {}
  ): ContextRanking[] {
    const minScore = options.minScore ?? 0.1;
    const limit = options.limit ?? 5;

    const matchedContexts: Array<{
      context: ContextObject;
      score: number;
      attachedObjectCount: number;
      matchedKeywords: string[];
    }> = [];

    // 1. Direct explicit links
    for (const link of this.links.values()) {
      if (link.objectId === objectId) {
        const ctx = this.contexts.get(link.contextId);
        if (ctx) {
          const directScore = link.weight * ctx.weight * (link.pinned ? 2.5 : 1.0);
          matchedContexts.push({
            context: ctx,
            score: directScore,
            attachedObjectCount: this.getAttachedObjectCount(ctx.id),
            matchedKeywords: ctx.metadata?.keywords || [],
          });
        }
      }
    }

    // 2. Graph indirect inferred contexts (via knowledge graph correlation)
    const related = localKnowledgeGraph.getRelated(objectId, { maxDistance: 0.6, limit: 10 });
    for (const rel of related) {
      for (const link of this.links.values()) {
        if (link.objectId === rel.nodeId) {
          const ctx = this.contexts.get(link.contextId);
          if (ctx && !matchedContexts.some((m) => m.context.id === ctx.id)) {
            const indirectScore = (1 - rel.distance) * rel.weight * ctx.weight * 0.7;
            if (indirectScore >= minScore) {
              matchedContexts.push({
                context: ctx,
                score: indirectScore,
                attachedObjectCount: this.getAttachedObjectCount(ctx.id),
                matchedKeywords: ctx.metadata?.keywords || [],
              });
            }
          }
        }
      }
    }

    // Sort by composite score descending and assign rank (1 = highest)
    const sorted = matchedContexts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }

  /**
   * Process a user clarification (e.g. "Don't do that, I meant X" in Sidekick or agentic chat).
   * Heavily weights the context and adjusts pattern matching.
   */
  public ingestUserClarification(
    contextId: string,
    correction: {
      originalQueryOrAction: string;
      userClarificationText: string;
      affectedObjectId?: string;
    }
  ): void {
    const ctx = this.contexts.get(contextId);
    if (!ctx) return;

    const now = new Date().toISOString();
    const clarifications = ctx.clarifications || [];
    clarifications.push({
      text: correction.originalQueryOrAction,
      correction: correction.userClarificationText,
      weight: 2.5, // Heavy emphasis on user corrections
      timestamp: now,
    });

    // Boost context weight
    ctx.weight = Math.min(5.0, ctx.weight * 1.3);
    ctx.clarifications = clarifications;
    ctx.updatedAt = now;
    this.contexts.set(ctx.id, ctx);

    // If there is an affected object, heavily strengthen its link to this context
    if (correction.affectedObjectId) {
      this.attachObjectToContext(correction.affectedObjectId, 'note', contextId, {
        weight: 3.0,
        pinned: true,
      });
    }

    // Penalize incorrect patterns in pattern matcher and ingest the correction
    patternMatcher.penalizePattern(
      correction.originalQueryOrAction,
      correction.userClarificationText
    );

    this.saveToStorage();
  }

  public getAttachedObjectCount(contextId: string): number {
    let count = 0;
    for (const l of this.links.values()) {
      if (l.contextId === contextId) count++;
    }
    return count;
  }

  public getContext(id: string): ContextObject | undefined {
    return this.contexts.get(id);
  }

  public getAllContexts(): ContextObject[] {
    return Array.from(this.contexts.values());
  }
}

export const contextManager = new ContextManager();
