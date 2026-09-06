/**
 * Suggest-reinforce curator — NOT the Sidekick / Kylie chat JSON template.
 * Quiet background judge: decide whether edit signals deserve session memory.
 * Output is tiny structured JSON for session chatHistory + style notes only.
 */

export type SuggestEditKind =
  | 'accepted_verbatim'
  | 'accepted_then_extended'
  | 'accepted_then_trimmed'
  | 'accepted_then_rewrote'
  | 'ignored_suggestion'
  | 'deleted_hint';

export type SuggestReinforceSignal = {
  kind: SuggestEditKind;
  mode: 'create' | 'reply';
  draftBefore: string;
  suggestion: string;
  draftAfter: string;
  parentSnippet?: string;
  at: string;
};

export function buildSuggestReinforceSystemInstruction(): string {
  return [
    'You are the Moments voice-curator for Kylrix Connect — a silent background learner.',
    'You are NOT Sidekick, NOT a chatbot, and NOT writing social posts.',
    'Job: read edit signals (what the user kept, cut, rewrote, or ignored) and decide what is worth remembering.',
    'Be extremely selective. Most signals are noise. Prefer zero writes over weak notes.',
    'PRIVACY: signals are already lightly redacted. Never invent private facts, emails, phones, keys, or wallet addresses.',
    'OUTPUT — return ONLY compact JSON (no markdown fences, no prose outside JSON):',
    '{',
    '  "worthRecording": boolean,',
    '  "styleNotes": string[],',
    '  "conversationBit": string | null,',
    '  "voiceSample": string | null,',
    '  "sessionInfoLine": string | null',
    '}',
    'styleNotes — 0–3 ultra-short bullets about HOW they write (rhythm, length, slang, emoji, punchiness). Not quotes of the post.',
    'conversationBit — optional one-line memory for session chatHistory, first-person about preference (e.g. "Keeps openers under 8 words."). null if not worth it.',
    'voiceSample — only if a distinctive finished phrase (≤120 chars) should join voice samples. Prefer null.',
    'sessionInfoLine — rare durable trait for session info (≤80 chars). Prefer null unless clearly recurring.',
    'If worthRecording is false, all other fields must be empty/null.',
  ].join('\n');
}

export function buildSuggestReinforceUserPrompt(params: {
  signals: SuggestReinforceSignal[];
  existingStyleNotes?: string[];
}): string {
  const packed = params.signals.slice(0, 8).map((s, i) => ({
    i: i + 1,
    kind: s.kind,
    mode: s.mode,
    draftBefore: String(s.draftBefore || '').slice(0, 220),
    suggestion: String(s.suggestion || '').slice(0, 180),
    draftAfter: String(s.draftAfter || '').slice(0, 280),
    parent: s.parentSnippet ? String(s.parentSnippet).slice(0, 120) : undefined,
  }));
  const notes = (params.existingStyleNotes || []).filter(Boolean).slice(0, 8);
  return [
    'Curate these Moments assist edit signals. Remember only durable writing preferences.',
    notes.length ? `EXISTING STYLE NOTES (do not duplicate):\n${notes.map((n) => `- ${n}`).join('\n')}` : 'EXISTING STYLE NOTES: (none)',
    `SIGNALS:\n${JSON.stringify(packed, null, 2)}`,
    'Return ONLY the JSON object.',
  ].join('\n\n');
}
