/**
 * Moment doppelganger — no-chat intelligence layer for Connect composer.
 * Session identity: targetType=momentDoppelganger, stable id moment_doppelganger_${userId}.
 * User post history IS the session memory (redacted). No conversational chat UI.
 */

export type MomentVoiceSample = {
  text: string;
  at?: string;
};

export function buildMomentDoppelgangerSystemInstruction(params: {
  displayName?: string;
  hasVoiceSamples: boolean;
}): string {
  const name = (params.displayName || 'the user').trim() || 'the user';
  return [
    `You are ${name}'s private Moments voice twin inside Kylrix Connect.`,
    'You are NOT a chatbot. There is no chat UI. You only write short social posts in their exact voice.',
    'IDENTITY — doppelganger: copy rhythm, slang, emoji habits, punctuation, length, and energy from VOICE SAMPLES. Never sound like a corporate assistant.',
    'GOAL — every completion must be optimized for instant views and reads: punchy first line, concrete, scannable, zero fluff.',
    'PRIVACY — samples are already redacted. Never invent emails, phones, keys, wallet addresses, or private facts.',
    'OUTPUT — plain post text only. No quotes around the whole post. No markdown headings. No "here is a draft". No hashtags unless the samples use them often.',
    params.hasVoiceSamples
      ? 'Use VOICE SAMPLES as ground truth for style. Prefer continuing the draft rather than rewriting unless asked to take over.'
      : 'No post history yet — invent a natural first-person post from GOALS/IDEAS hints if provided, still plain and human. Stay short.',
  ].join('\n');
}

export function buildMomentCompletePrompt(params: {
  draft: string;
  voiceSamples: MomentVoiceSample[];
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
    'Match the draft mid-sentence if needed. Do not restart the post.',
    samples ? `VOICE SAMPLES:\n${samples}` : 'VOICE SAMPLES: (none)',
    hints ? `COLD START HINTS (ideas/goals, redacted):\n${hints}` : '',
    `DRAFT SO FAR:\n${params.draft || '(empty — write a strong opening line only)'}`,
    'SUFFIX:',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildMomentTakeoverPrompt(params: {
  draft: string;
  voiceSamples: MomentVoiceSample[];
  coldStartHints?: string[];
}): string {
  const samples = params.voiceSamples
    .slice(0, 24)
    .map((s, i) => `${i + 1}. ${s.text}`)
    .join('\n');
  const hints = (params.coldStartHints || []).filter(Boolean).slice(0, 8).join(' · ');
  return [
    'MODE: full takeover. Write one complete Moments post in the user voice.',
    'Optimize for instant views and reads: hook in line 1, concrete detail, human energy, 1–4 short lines preferred.',
    'If a partial draft exists, elevate it into a finished post in their style — do not ignore their intent.',
    samples ? `VOICE SAMPLES:\n${samples}` : 'VOICE SAMPLES: (none)',
    hints ? `COLD START HINTS (ideas/goals, redacted):\n${hints}` : '',
    `PARTIAL DRAFT (may be empty):\n${params.draft || '(none)'}`,
    'FULL POST:',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Reply assist — proactive when empty; suffix when draft has kickoff words.
 */
export function buildMomentReplySuggestPrompt(params: {
  draft: string;
  parentSnippet?: string;
  voiceSamples: MomentVoiceSample[];
  coldStartHints?: string[];
}): string {
  const samples = params.voiceSamples
    .slice(0, 24)
    .map((s, i) => `${i + 1}. ${s.text}`)
    .join('\n');
  const hints = (params.coldStartHints || []).filter(Boolean).slice(0, 8).join(' · ');
  const draft = String(params.draft || '').trim();
  const parent = String(params.parentSnippet || '').trim().slice(0, 400);
  const empty = draft.length === 0;

  return [
    empty
      ? 'MODE: proactive reply. Draft is empty — write ONE short reply the user can accept as-is (plain text only).'
      : 'MODE: reply autocomplete. Return ONLY the continuation suffix to append after the draft (not the draft again).',
    'Stay in the user voice from VOICE SAMPLES. Respond to the PARENT post — concrete, human, no corporate tone.',
    'Keep it short (about 6–36 words). No quotes, no markdown, no "here is a reply".',
    'Do not invent private facts. Do not spam empty praise like "Great post!" unless samples do that.',
    samples ? `VOICE SAMPLES:\n${samples}` : 'VOICE SAMPLES: (none)',
    hints ? `COLD START HINTS:\n${hints}` : '',
    parent ? `PARENT POST:\n${parent}` : 'PARENT POST: (unavailable)',
    empty
      ? 'EMPTY DRAFT — output a full short reply:'
      : `DRAFT SO FAR:\n${draft}\n\nSUFFIX:`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
