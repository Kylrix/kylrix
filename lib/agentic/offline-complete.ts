/**
 * Offline-first completion + hard AI budget.
 * Prefer LocalEngine / contextual engine; AI is a minority path.
 */

import { predictiveAutocomplete } from '@/lib/contextual-engine/predictive-autocomplete';
import type { ContextualNiche } from '@/lib/contextual-engine/types';

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

  try {
    const pred = predictiveAutocomplete.predict(text, text.length, {
      niche: options.niche || 'productivity',
      minConfidence: options.minConfidence ?? 0.55,
    });
    const inline = String(pred.inlineSuffix || '').trim();
    if (inline.length >= 2) return inline.slice(0, 120);
    const top = pred.suggestions?.[0]?.text;
    if (top && String(top).trim().length >= 2) return String(top).trim().slice(0, 120);
  } catch {}

  const words = text.trim().split(/\s+/);
  const tail = words.slice(-Math.min(4, words.length)).join(' ').toLowerCase();
  if (tail.length >= 3) {
    for (const s of samples) {
      const body = String(s?.text || '');
      const idx = body.toLowerCase().indexOf(tail);
      if (idx >= 0) {
        const rest = body.slice(idx + tail.length).replace(/^\s+/, '');
        if (rest.length >= 4) return rest.slice(0, 100);
      }
    }
  }

  // Weak cold-start: borrow a short fragment from a sample that shares a word
  const lastWord = (words[words.length - 1] || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
  if (lastWord.length >= 4) {
    for (const s of samples) {
      const body = String(s?.text || '');
      if (body.toLowerCase().includes(lastWord)) {
        const parts = body.split(/[.!?\n]/).map((p) => p.trim()).filter((p) => p.length > 12);
        const pick = parts[0];
        if (pick && !text.toLowerCase().includes(pick.toLowerCase().slice(0, 20))) {
          return pick.slice(0, 80);
        }
      }
    }
  }

  return '';
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
    // Even with offline hit, rarely skip to AI only if offline is tiny AND budget — prefer offline
    if (opts.offlineSuffix.trim().length >= 6) return 'offline';
    // Short offline: still prefer offline 70%
    if (Math.random() < 0.7) return 'offline';
  }
  if (!opts.allowAi) return opts.offlineSuffix.trim() ? 'offline' : 'none';
  if (await shouldAllowAiInference(opts.scope)) return 'ai';
  return opts.offlineSuffix.trim() ? 'offline' : 'none';
}
