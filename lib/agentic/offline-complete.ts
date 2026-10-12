/**
 * Offline-first completion + hard AI budget.
 * Prefer LocalEngine / contextual engine; AI is a minority path.
 */

import { predictiveAutocomplete } from '@/lib/contextual-engine/predictive-autocomplete';
import type { ContextualNiche } from '@/lib/contextual-engine/types';
import { asSuggestionSuffix } from '@/lib/agentic/suggestion-suffix';

const AI_ALLOW_RATIO = 0.4; // at most ~40% of fallbacks may hit AI
const MIN_AI_GAP_MS = 14_000;
const MAX_AI_PER_DAY = 48;

function dayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${d.getUTCMonth()}${d.getUTCDate()}`;
}

function budgetKey(scope: string): string {
  return `f_ai_budget_${scope}_${dayKey()}`;
}

function lastAiKey(scope: string): string {
  return `f_ai_last_${scope}`;
}

type VoiceSample = { text: string };

/**
 * Pure offline suffix from pattern matcher + voice samples (0 network / 0 AI).
 */
export function completeOfflineSuffix(
  draft: string,
  samples: VoiceSample[],
  options: { niche?: ContextualNiche; minConfidence?: number } = {},
): string {
  const text = String(draft || '');
  if (text.trim().length < 2) return '';

  const finish = (raw: string) => asSuggestionSuffix(text, raw);

  try {
    const pred = predictiveAutocomplete.predict(text, text.length, {
      niche: options.niche || 'productivity',
      minConfidence: options.minConfidence ?? 0.55,
    });
    const inline = finish(String(pred.inlineSuffix || ''));
    if (inline.length >= 2) return inline.slice(0, 120);
    const top = finish(String(pred.suggestions?.[0]?.text || ''));
    if (top.length >= 2) return top.slice(0, 120);
  } catch {}

  const words = text.trim().split(/\s+/);
  const tail = words.slice(-Math.min(4, words.length)).join(' ').toLowerCase();
  if (tail.length >= 3) {
    for (const s of samples) {
      const body = String(s?.text || '');
      const idx = body.toLowerCase().indexOf(tail);
      if (idx >= 0) {
        const rest = finish(body.slice(idx + tail.length));
        if (rest.length >= 4) return rest.slice(0, 100);
      }
    }
  }

  // Weak cold-start: only remainder after shared opening with draft (never restate draft)
  const lastWord = (words[words.length - 1] || '').toLowerCase().replace(/[^a-z0-9']/gi, '');
  if (lastWord.length >= 4) {
    for (const s of samples) {
      const body = String(s?.text || '').trim();
      if (!body.toLowerCase().includes(lastWord)) continue;
      const parts = body.split(/[.!?\n]/).map((p) => p.trim()).filter((p) => p.length > 12);
      for (const pick of parts) {
        const suffix = finish(pick);
        if (suffix.length >= 4) return suffix.slice(0, 80);
      }
    }
  }

  return '';
}

/**
 * Offline reply assist — empty drafts get a short voice-sample reply;
 * partial drafts reuse normal suffix matching (looser confidence for Connect).
 */
export function suggestOfflineReply(
  draft: string,
  parentSnippet: string,
  samples: VoiceSample[],
): string {
  const text = String(draft || '').trim();
  if (text.length >= 2) {
    return completeOfflineSuffix(draft, samples, {
      niche: 'connect',
      minConfidence: 0.42,
    });
  }

  const parent = String(parentSnippet || '').trim();
  const pool = (samples || [])
    .map((s) => String(s?.text || '').trim())
    .filter((s) => s.length >= 8 && s.length <= 160);

  for (const s of pool) {
    if (parent && parent.slice(0, 40).toLowerCase() === s.slice(0, 40).toLowerCase()) continue;
    if (/^(just shared|shared an update)/i.test(s)) continue;
    return s.slice(0, 140);
  }

  if (!parent) return '';

  const topic = parent
    .replace(/\s+/g, ' ')
    .slice(0, 48)
    .replace(/[.!?].*$/, '')
    .trim();
  if (topic.length < 8) return '';
  return `On that — ${topic}${topic.length >= 48 ? '…' : ''}`;
}

type BudgetState = { count: number; day: string };

/**
 * Hard gate: AI only when offline cannot serve AND budget allows (≤40% of AI attempts, gaps, daily cap).
 */
export async function shouldAllowAiInference(scope: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (Math.random() > AI_ALLOW_RATIO) return false;

  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const now = Date.now();
  const last = Number((await LocalEngine.cacheGet<number>(lastAiKey(scope))) || 0);
  if (last && now - last < MIN_AI_GAP_MS) return false;

  const day = dayKey();
  const state = (await LocalEngine.cacheGet<BudgetState>(budgetKey(scope))) || { count: 0, day };
  const count = state.day === day ? state.count : 0;
  if (count >= MAX_AI_PER_DAY) return false;
  return true;
}

export async function recordAiInference(scope: string): Promise<void> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const now = Date.now();
  const day = dayKey();
  await LocalEngine.cacheSet(lastAiKey(scope), now);
  const state = (await LocalEngine.cacheGet<BudgetState>(budgetKey(scope))) || { count: 0, day };
  const count = state.day === day ? state.count + 1 : 1;
  await LocalEngine.cacheSet(budgetKey(scope), { count, day });
}

/**
 * Decide source for a live complete. Offline wins whenever it has a suffix.
 * AI is minority fallback under budget.
 */
export async function pickCompletionSource(opts: {
  scope: string;
  offlineSuffix: string;
  allowAi: boolean;
}): Promise<'offline' | 'ai' | 'none'> {
  if (opts.offlineSuffix.trim().length >= 2) {
    if (opts.offlineSuffix.trim().length >= 6) return 'offline';
    if (Math.random() < 0.7) return 'offline';
  }
  if (!opts.allowAi) return opts.offlineSuffix.trim() ? 'offline' : 'none';
  if (await shouldAllowAiInference(opts.scope)) return 'ai';
  return opts.offlineSuffix.trim() ? 'offline' : 'none';
}
