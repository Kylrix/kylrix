import { PatternMatch, ContextualNiche } from './types';

const CONFIDENCE_THRESHOLD = 0.65;
const MAX_PATTERNS_MEMORY = 5000;
const CACHE_KEY = 'kylrix_contextual_patterns_v1';

export class PatternMatcher {
  private patterns: Map<string, PatternMatch> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed: PatternMatch[] = JSON.parse(raw);
        for (const p of parsed) {
          this.patterns.set(p.patternKey, p);
        }
      }
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const array = Array.from(this.patterns.values())
        .sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence))
        .slice(0, MAX_PATTERNS_MEMORY);
      localStorage.setItem(CACHE_KEY, JSON.stringify(array));
    } catch {}
  }

  /**
   * Tokenize text into normalized lowercase tokens.
   */
  public tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /**
   * Extract n-grams (1-gram to 4-gram) for pattern matching.
   */
  public extractNgrams(tokens: string[], maxN = 3): string[] {
    const ngrams: string[] = [];
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join(' '));
      }
    }
    return ngrams;
  }

  /**
   * Record a user phrase or completion into the pattern table.
   */
  public ingestText(
    text: string,
    options: {
      userId?: string;
      niche?: ContextualNiche;
      isAnonymized?: boolean;
      boost?: number;
    } = {}
  ): void {
    const tokens = this.tokenize(text);
    if (tokens.length < 2) return;

    const { userId, niche = 'workspace', isAnonymized = false, boost = 1.0 } = options;
    const now = new Date().toISOString();

    for (let i = 0; i < tokens.length - 1; i++) {
      const prefix = tokens.slice(Math.max(0, i - 2), i + 1).join(' ');
      const completion = tokens.slice(i + 1, Math.min(tokens.length, i + 4)).join(' ');

      if (!prefix || !completion) continue;

      const key = `${prefix}::${completion}`;
      const existing = this.patterns.get(key);

      if (existing) {
        const newFreq = existing.frequency + 1;
        const newConfidence = Math.min(1.0, existing.confidence + 0.05 * boost);
        this.patterns.set(key, {
          ...existing,
          frequency: newFreq,
          confidence: newConfidence,
          weight: existing.weight * 1.05 * boost,
          updatedAt: now,
        });
      } else {
        const baseConfidence = 0.65 * boost;
        this.patterns.set(key, {
          id: `pat_${Math.random().toString(36).slice(2, 10)}`,
          patternKey: key,
          patternType: 'autocomplete',
          ngram: prefix,
          completion,
          niche,
          userId: isAnonymized ? undefined : userId,
          frequency: 1,
          confidence: baseConfidence,
          weight: 1.0 * boost,
          isAnonymized,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    this.saveToStorage();
  }

  /**
   * Match prefix for predictive completions with strict confidence gating.
   */
  public matchCompletions(
    prefixText: string,
    options: {
      minConfidence?: number;
      limit?: number;
      niche?: ContextualNiche;
    } = {}
  ): Array<{ completion: string; confidence: number; weight: number }> {
    const tokens = this.tokenize(prefixText);
    if (!tokens.length) return [];

    const minConfidence = options.minConfidence ?? CONFIDENCE_THRESHOLD;
    const limit = options.limit ?? 5;
    const candidatePrefixes = [
      tokens.slice(-3).join(' '),
      tokens.slice(-2).join(' '),
      tokens.slice(-1).join(' '),
    ].filter(Boolean);

    const matches: Array<{ completion: string; confidence: number; weight: number }> = [];

    for (const [key, p] of this.patterns.entries()) {
      if (p.confidence < minConfidence) continue;
      if (options.niche && p.niche && p.niche !== options.niche && p.confidence < 0.8) {
        continue;
      }

      for (const prefix of candidatePrefixes) {
        if (p.ngram === prefix || key.startsWith(`${prefix}::`)) {
          matches.push({
            completion: p.completion,
            confidence: p.confidence,
            weight: p.weight,
          });
          break;
        }
      }
    }

    return matches
      .sort((a, b) => (b.confidence * b.weight) - (a.confidence * a.weight))
      .slice(0, limit);
  }

  /**
   * Learn from user clarification or correction (e.g. "don't do that, I meant X").
   */
  public penalizePattern(badNgram: string, goodNgram?: string): void {
    for (const [key, p] of this.patterns.entries()) {
      if (key.includes(badNgram.toLowerCase())) {
        p.confidence = Math.max(0.1, p.confidence - 0.4);
        p.weight = Math.max(0.1, p.weight * 0.5);
      }
    }
    if (goodNgram) {
      this.ingestText(goodNgram, { boost: 2.0 });
    }
    this.saveToStorage();
  }

  public getAllPatterns(): PatternMatch[] {
    return Array.from(this.patterns.values());
  }
}

export const patternMatcher = new PatternMatcher();
