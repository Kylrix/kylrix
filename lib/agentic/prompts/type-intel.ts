/**
 * Type-intel prompts — no chat UI; learn from past objects of this type.
 */

import type { TypeIntelKind } from '@/lib/agentic/type-intel-kinds';
import { TYPE_INTEL_KINDS } from '@/lib/agentic/type-intel-kinds';

export type TypeIntelVoiceSample = {
  text: string;
  at?: string;
};

const ROLE_BY_KIND: Record<TypeIntelKind, string> = {
  note: 'ideas and notes — clear titles and useful body text',
  goal: 'goals and tasks — actionable, concrete outcomes',
  event: 'events — clear titles, times, and short descriptions',
  form: 'forms — clear names and short purpose descriptions',
  project: 'workspaces and projects — clear names and short summaries',
};

export function buildTypeIntelSystemInstruction(params: {
  kind: TypeIntelKind;
  displayName?: string;
  hasVoiceSamples: boolean;
}): string {
  const cfg = TYPE_INTEL_KINDS[params.kind];
  const name = (params.displayName || 'the user').trim() || 'the user';
  return [
    `You are ${name}'s private writing twin for ${cfg.label} create flows inside Kylrix.`,
    'You are NOT a chatbot. There is no chat UI. You only finish drafts in their exact writing style.',
    `DOMAIN — ${ROLE_BY_KIND[params.kind]}.`,
    'IDENTITY — copy rhythm, vocabulary, length, and tone from VOICE SAMPLES. Never sound like a corporate assistant.',
    'PRIVACY — samples are already redacted. Never invent emails, phones, keys, wallet addresses, or private facts.',
    'OUTPUT — plain text only. No quotes around the whole answer. No markdown headings. No "here is a draft".',
    params.hasVoiceSamples
      ? 'Use VOICE SAMPLES as ground truth for style. Prefer continuing the draft rather than rewriting unless asked to take over.'
      : 'No history yet — write natural first-person or neutral product copy from HINTS if provided. Stay short and useful.',
  ].join('\n');
}

export function buildTypeIntelCompletePrompt(params: {
  kind: TypeIntelKind;
  draft: string;
  voiceSamples: TypeIntelVoiceSample[];
  coldStartHints?: string[];
}): string {
  const samples = params.voiceSamples
    .slice(0, 24)
    .map((s, i) => `${i + 1}. ${s.text}`)
    .join('\n');
  const hints = (params.coldStartHints || []).filter(Boolean).slice(0, 8).join(' · ');
  return [
    'MODE: live autocomplete. Return ONLY the continuation suffix to append after the draft (not the draft again).',
    'Keep the suffix short (about 4–40 words) unless the draft clearly needs a longer finish.',
    'Match the draft mid-sentence if needed. Do not restart.',
    samples ? `VOICE SAMPLES:\n${samples}` : 'VOICE SAMPLES: (none)',
    hints ? `COLD START HINTS:\n${hints}` : '',
    `DRAFT SO FAR:\n${params.draft || '(empty — write a strong short opening only)'}`,
    'SUFFIX:',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildTypeIntelTakeoverPrompt(params: {
  kind: TypeIntelKind;
  draft: string;
  voiceSamples: TypeIntelVoiceSample[];
  coldStartHints?: string[];
}): string {
  const cfg = TYPE_INTEL_KINDS[params.kind];
  const samples = params.voiceSamples
    .slice(0, 24)
    .map((s, i) => `${i + 1}. ${s.text}`)
    .join('\n');
  const hints = (params.coldStartHints || []).filter(Boolean).slice(0, 8).join(' · ');
  return [
    `MODE: full takeover. Write one complete ${cfg.label} draft in the user voice.`,
    'If a partial draft exists, elevate it — do not ignore their intent.',
    samples ? `VOICE SAMPLES:\n${samples}` : 'VOICE SAMPLES: (none)',
    hints ? `COLD START HINTS:\n${hints}` : '',
    `PARTIAL DRAFT (may be empty):\n${params.draft || '(none)'}`,
    'FULL DRAFT:',
  ]
    .filter(Boolean)
    .join('\n\n');
}
