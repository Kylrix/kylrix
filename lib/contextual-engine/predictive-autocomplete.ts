import { patternMatcher } from './pattern-matcher';
import { PredictiveSuggestion, ContextualNiche } from './types';
import { localKnowledgeGraph } from './local-graph';

export interface AutocompleteResult {
  inlineSuffix?: string; // Suffix to complete current word/phrase inline (Tab to complete)
  suggestions: PredictiveSuggestion[];
  confidence: number;
}

export class PredictiveAutocompleteEngine {
  /**
   * Predict completions in real-time as the user types (0ms offline).
   */
  public predict(
    currentText: string,
    cursorPosition?: number,
    options: {
      niche?: ContextualNiche;
      activeObjectId?: string;
      tags?: string[];
      minConfidence?: number;
    } = {}
  ): AutocompleteResult {
    if (!currentText || !currentText.trim()) {
      return { suggestions: [], confidence: 0 };
    }

    const pos = cursorPosition ?? currentText.length;
    const textBeforeCursor = currentText.slice(0, pos);
    const minConfidence = options.minConfidence ?? 0.65;

    const matches = patternMatcher.matchCompletions(textBeforeCursor, {
      minConfidence,
      limit: 4,
      niche: options.niche,
    });

    const suggestions: PredictiveSuggestion[] = [];

    // 1. Inline pattern completions
    let inlineSuffix: string | undefined;
    if (matches.length > 0) {
      const top = matches[0];
      inlineSuffix = ` ${top.completion}`;

      for (const m of matches) {
        suggestions.push({
          id: `sug_${Math.random().toString(36).slice(2, 9)}`,
          text: m.completion,
          type: 'inline_completion',
          confidence: m.confidence,
          niche: options.niche,
        });
      }
    }

    // 2. Correlated entities from knowledge graph if active object is set
    if (options.activeObjectId) {
      const related = localKnowledgeGraph.getRelated(options.activeObjectId, {
        maxDistance: 0.5,
        limit: 2,
      });
      for (const r of related) {
        suggestions.push({
          id: `rel_${r.nodeId}`,
          text: `Link ${r.kind}: ${r.nodeId.slice(0, 8)}`,
          type: 'related_object',
          confidence: Math.min(1.0, 1 - r.distance),
          targetObjectId: r.nodeId,
          targetKind: r.kind,
        });
      }
    }

    const highestConfidence = suggestions.length
      ? Math.max(...suggestions.map((s) => s.confidence))
      : 0;

    return {
      inlineSuffix,
      suggestions,
      confidence: highestConfidence,
    };
  }

  /**
   * Feed accepted completion back into the pattern matcher to increase weight.
   */
  public recordAccepted(text: string, niche: ContextualNiche = 'workspace'): void {
    patternMatcher.ingestText(text, { niche, boost: 1.5 });
  }
}

export const predictiveAutocomplete = new PredictiveAutocompleteEngine();
