/**
 * Summarize prompt template — dedicated to Kylie Assist > Summarize flow.
 * Separate from standard assembleSystemInstructionBlocks; has extra hooks for
 * one-liners, sections, and object mind-map.
 */
export type SummarizeTarget = {
  id: string;
  type: 'note' | 'idea' | 'goal' | 'event' | 'form' | 'vault' | 'totp' | 'credential';
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt?: string;
};

export function buildSummarizeSystemInstruction(target: SummarizeTarget): string {
  return [
    'You are Kylie — summarizing for the Kylrix workspace. You speak as Kylie, concise and friendly.',
    'TASK: Summarize the provided object. Never mutate it. Use ONLY the object content given in the context block.',
    'OUTPUT CONTRACT — return strict JSON (no prose outside JSON) with shape:',
    '{',
    '  "oneLiner": "≤22 words, plain English, no jargon",',
    '  "sections": [{ "heading": string, "bullets": string[] /* 2-4 bullets per section, each ≤18 words */ }],',
    '  "mindMap": { "nodes": [{ "id": string, "label": string, "kind": "central|branch|leaf" }], "edges": [{ "from": string, "to": string, "label"?: string }] }',
    '}',
    'SECTIONS GUIDE — pick 2-4 most relevant from: Overview, Key Points, Action Items, Risks, Next Steps, Context, Decisions. Keep bullets tight.',
    'MIND MAP — central node = object title; branch nodes = major themes; leaf nodes = supporting details. 5-10 nodes, 4-9 edges. Labels ≤ 14 chars.',
    'STYLE — layman English, no E2EE/crypto jargon, no markdown, no code fences inside JSON strings.',
    'HOOKS — if note has tags/attachments/createdAt, weave them into Context/Overview but do not invent data.',
    `[TARGET] type=${target.type} id=${target.id} title=${JSON.stringify(target.title || 'Untitled')}`,
  ].join('\n');
}

export function buildSummarizeUserPrompt(target: SummarizeTarget): string {
  const body = (target.content || '').slice(0, 12000);
  return [
    `Summarize this ${target.type} (id ${target.id}):`,
    `Title: ${target.title || 'Untitled'}`,
    `Body:\n${body || '(empty)'}`,
    target.tags?.length ? `Tags: ${target.tags.join(', ')}` : '',
    target.metadata ? `Metadata: ${JSON.stringify(target.metadata).slice(0, 2000)}` : '',
    'Return ONLY the JSON described in the system instruction.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildSummarizeContextBlock(target: SummarizeTarget): string {
  return `[SUMMARIZE TARGET]\n${JSON.stringify({ type: target.type, id: target.id, title: target.title, content: (target.content || '').slice(0, 8000) }, null, 2)}`;
}
