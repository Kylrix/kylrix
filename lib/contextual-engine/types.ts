export type ContextualNiche =
  | 'workspace'
  | 'productivity'
  | 'connect'
  | 'security'
  | 'intelligence'
  | 'billing'
  | 'system';

export type ContextKind =
  | 'note'
  | 'goal'
  | 'task'
  | 'event'
  | 'form'
  | 'flow'
  | 'secret'
  | 'credential'
  | 'tag'
  | 'chat'
  | 'message'
  | 'context'
  | 'project'
  | 'workspace'
  | string;

export interface ContextObject {
  id: string;
  title: string;
  description?: string;
  niche: ContextualNiche;
  scopeKey?: string; // e.g. 'workspace:id', 'session:id', 'topic:hash'
  workspaceId?: string;
  userId: string;
  confidence: number; // 0.0 to 1.0
  weight: number; // multiplier e.g. 1.0, 2.5
  isAnonymized: boolean;
  clarifications?: Array<{
    text: string;
    correction: string;
    weight: number;
    timestamp: string;
  }>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  sourceId: string;
  sourceKind: ContextKind;
  targetId: string;
  targetKind: ContextKind;
  contextId?: string;
  userId?: string;
  relation:
    | 'co_occurs'
    | 'references'
    | 'semantic_similarity'
    | 'tag_match'
    | 'temporal_sequence'
    | 'clarified_intent';
  distance: number; // 0 (identical) to 1.0+ (distant)
  weight: number;
  confidence: number; // 0.0 to 1.0
  version: number;
  isAnonymized: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PatternMatch {
  id: string;
  patternKey: string; // Token sequence / n-gram hash
  patternType: 'autocomplete' | 'action_intent' | 'tag_suggestion' | 'entity_link';
  ngram?: string;
  completion: string;
  niche?: ContextualNiche;
  userId?: string;
  frequency: number;
  confidence: number; // 0.0 to 1.0 (threshold >= 0.65)
  weight: number;
  isAnonymized: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PredictiveSuggestion {
  id: string;
  text: string;
  type: 'inline_completion' | 'intent_action' | 'tag' | 'related_object';
  confidence: number;
  sourceContextId?: string;
  targetObjectId?: string;
  targetKind?: ContextKind;
  niche?: ContextualNiche;
  metadata?: Record<string, any>;
}

export interface ContextRanking {
  context: ContextObject;
  rank: number; // 1 = highest relevance
  score: number; // composite weighted score
  attachedObjectCount: number;
  matchedKeywords: string[];
}

export interface TemporalCluster {
  id: string;
  timeRange: { start: string; end: string };
  label: string;
  dominantNiche: ContextualNiche;
  objectIds: Array<{ id: string; kind: ContextKind; title?: string }>;
  themes: string[];
  intensityScore: number;
}
