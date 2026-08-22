import { KnowledgeGraphEdge, ContextKind } from './types';

const GRAPH_CACHE_KEY = 'kylrix_contextual_graph_v1';
const MAX_EDGES_MEMORY = 10000;

export interface GraphNode {
  id: string;
  kind: ContextKind;
  title?: string;
  tags?: string[];
  tokens?: string[];
  updatedAt?: string;
}

export class LocalKnowledgeGraph {
  private edges: Map<string, KnowledgeGraphEdge> = new Map();
  private nodes: Map<string, GraphNode> = new Map();
  private version = 1;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(GRAPH_CACHE_KEY);
      if (raw) {
        const parsed: KnowledgeGraphEdge[] = JSON.parse(raw);
        for (const e of parsed) {
          this.edges.set(e.id, e);
        }
      }
    } catch {}
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const array = Array.from(this.edges.values())
        .sort((a, b) => b.weight - a.weight)
        .slice(0, MAX_EDGES_MEMORY);
      localStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify(array));
    } catch {}
  }

  public registerNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  public registerNodes(nodes: GraphNode[]): void {
    for (const n of nodes) {
      this.nodes.set(n.id, n);
    }
  }

  /**
   * Calculate distance and connect two objects in the graph.
   * Tags double the closeness (distance is halved).
   */
  public correlate(
    source: GraphNode,
    target: GraphNode,
    options: {
      userId?: string;
      contextId?: string;
      explicitRelation?: KnowledgeGraphEdge['relation'];
      isAnonymized?: boolean;
    } = {}
  ): KnowledgeGraphEdge | null {
    if (source.id === target.id) return null;

    this.registerNode(source);
    this.registerNode(target);

    // 1. Tag overlap (Tags double the connection strength)
    const sourceTags = new Set((source.tags || []).map((t) => t.toLowerCase()));
    const targetTags = new Set((target.tags || []).map((t) => t.toLowerCase()));
    let tagMatches = 0;
    sourceTags.forEach((t) => {
      if (targetTags.has(t)) tagMatches++;
    });

    // 2. Keyword token overlap
    const sTokens = new Set(source.tokens || []);
    const tTokens = new Set(target.tokens || []);
    let tokenMatches = 0;
    sTokens.forEach((tok) => {
      if (tTokens.has(tok)) tokenMatches++;
    });

    const keywordSim = (sTokens.size && tTokens.size)
      ? (2 * tokenMatches) / (sTokens.size + tTokens.size)
      : 0;

    // 3. Recency factor
    let recencyFactor = 0.5;
    if (source.updatedAt && target.updatedAt) {
      const diffMs = Math.abs(
        new Date(source.updatedAt).getTime() - new Date(target.updatedAt).getTime()
      );
      const dayDiff = diffMs / (1000 * 60 * 60 * 24);
      recencyFactor = Math.max(0.1, 1 - dayDiff / 30);
    }

    // Distance calculation: shorter distance = stronger link
    // Tags have double multiplier (tagMatches * 2.0)
    const closenessScore = (tagMatches * 2.0) + (keywordSim * 1.5) + (recencyFactor * 0.5);

    if (closenessScore < 0.3 && !options.explicitRelation) {
      // Noise suppression
      return null;
    }

    const distance = Math.max(0.05, 1 / (1 + closenessScore));
    const confidence = Math.min(1.0, 0.4 + closenessScore * 0.2);
    const edgeId = `edge_${source.id}_${target.id}`;
    const now = new Date().toISOString();

    const edge: KnowledgeGraphEdge = {
      id: edgeId,
      sourceId: source.id,
      sourceKind: source.kind,
      targetId: target.id,
      targetKind: target.kind,
      contextId: options.contextId,
      userId: options.isAnonymized ? undefined : options.userId,
      relation: options.explicitRelation || (tagMatches > 0 ? 'tag_match' : 'semantic_similarity'),
      distance,
      weight: closenessScore,
      confidence,
      version: this.version,
      isAnonymized: !!options.isAnonymized,
      metadata: {
        tagMatches,
        keywordSim,
        recencyFactor,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.edges.set(edgeId, edge);
    this.saveToStorage();
    return edge;
  }

  /**
   * Find all correlated objects linked to an object ID within a distance threshold.
   */
  public getRelated(
    objectId: string,
    options: {
      maxDistance?: number;
      minConfidence?: number;
      limit?: number;
      targetKind?: ContextKind;
    } = {}
  ): Array<{
    nodeId: string;
    kind: ContextKind;
    distance: number;
    weight: number;
    relation: string;
    edge: KnowledgeGraphEdge;
  }> {
    const maxDistance = options.maxDistance ?? 0.85;
    const minConfidence = options.minConfidence ?? 0.5;
    const limit = options.limit ?? 10;

    const results: Array<{
      nodeId: string;
      kind: ContextKind;
      distance: number;
      weight: number;
      relation: string;
      edge: KnowledgeGraphEdge;
    }> = [];

    for (const edge of this.edges.values()) {
      if (edge.confidence < minConfidence || edge.distance > maxDistance) continue;

      let relatedId: string | null = null;
      let relatedKind: ContextKind | null = null;

      if (edge.sourceId === objectId) {
        relatedId = edge.targetId;
        relatedKind = edge.targetKind;
      } else if (edge.targetId === objectId) {
        relatedId = edge.sourceId;
        relatedKind = edge.sourceKind;
      }

      if (relatedId && relatedKind) {
        if (options.targetKind && relatedKind !== options.targetKind) continue;

        results.push({
          nodeId: relatedId,
          kind: relatedKind,
          distance: edge.distance,
          weight: edge.weight,
          relation: edge.relation,
          edge,
        });
      }
    }

    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  public bumpVersion(): void {
    this.version += 1;
  }

  public getAllEdges(): KnowledgeGraphEdge[] {
    return Array.from(this.edges.values());
  }
}

export const localKnowledgeGraph = new LocalKnowledgeGraph();
