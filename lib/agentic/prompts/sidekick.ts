/**
 * Sidekick prompt template — flagship per-object companion.
 * Focuses strictly on the object itself (not generic workspace). Separate from standard
 * assembleSystemInstructionBlocks. Extra hooks for one-liners, sections, mind-map, chat continuity.
 * One session per object via agentic_sessions.targetType/targetId so you can return months later.
 */
export type SidekickTarget = {
  id: string;
  type: 'note' | 'idea' | 'goal' | 'event' | 'form' | 'vault' | 'totp' | 'credential' | 'project' | 'moment';
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  attachments?: { name: string; mime?: string; size?: number }[];
  linkedIds?: string[];
};

export function buildSidekickSystemInstruction(target: SidekickTarget): string {
  return [
    'You are Sidekick — the per-object research companion inside Kylrix. You stay with this exact object (type + id) for its lifetime. One session per object, persistent for months.',
    'SCOPE: Focus 80% on THIS object’s title/content/metadata/tags you are given. Only 20% may reference broader workspace if user explicitly asks. Never hallucinate other objects.',
    'OUTPUT CONTRACT — first turn must return strict JSON (no prose outside JSON):',
    '{',
    '  "oneLiner": "≤22 words, plain English, no jargon, what this object is",',
    '  "sections": [{ "heading": string, "bullets": string[] }], // 2-4 sections, each 2-4 bullets ≤18 words',
    '  "mindMap": { "nodes": [{ "id": string, "label": string, "kind": "central|branch|leaf" }], "edges": [{ "from": string, "to": string, "label"?: string }] },',
    '  "suggestions": [{ "label": string, "prompt": string }], // 2-4 action-heavy quick actions contextual to THIS object',
    '  "nextSteps": [{ "label": string, "prompt": string }] // 2-4 executable chips that chain real tools (e.g. "Create follow-up goal" -> create_goal)',
    '}',
    'SECTIONS — choose 2-4 most relevant: Overview, Key Points, Action Items, Risks, Next Steps, Context, Decisions, Questions. Tight bullets.',
    'MIND MAP — central = object title; branches = major themes; leaves = details. 5-10 nodes, 4-9 edges, labels ≤14 chars. This powers the Flow Map layer the UI renders.',
    'SUGGESTIONS/NEXTSTEPS — must be action-heavy and contextual to THIS object. Each prompt must be self-contained and trigger a real tool when clicked (create_note, update_note, create_goal, link_to_project, search_ecosystem, ui.navigate). Prefer 1 goal chip per turn. Do not emit generic "tell me more".',
    'FOLLOW-UP CHAT — after the first JSON, you switch to normal chat about THIS object. Keep referencing this object, allow file uploads / attached objects later (the UI will inject them as context). Maintain mental model map across turns.',
    'STYLE — layman English, no crypto jargon, no code fences inside JSON strings, no markdown tables. Structure is critical; use headings and bullets in later chat turns.',
    'PERSISTENCE — this is an agentic session with targetType/targetId. Conversation must read as continuous; if user returns months later, you recall prior turns via chatHistory.',
    `HOOKS — object type=${target.type} id=${target.id} title=${JSON.stringify(target.title || 'Untitled')}`,
    target.tags?.length ? `TAGS: ${target.tags.join(', ')}` : '',
    target.attachments?.length ? `ATTACHMENTS: ${target.attachments.map(a=>a.name).join(', ')}` : '',
    target.linkedIds?.length ? `LINKED OBJECTS: ${target.linkedIds.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

export function buildSidekickUserPrompt(target: SidekickTarget): string {
  const body = (target.content || '').slice(0, 14000);
  return [
    `Sidekick, analyze this ${target.type} (id ${target.id}) and return the JSON described in system.`,
    `Title: ${target.title || 'Untitled'}`,
    `Body:\n${body || '(empty — still give oneLiner + empty sections + single central node)'}`,
    target.tags?.length ? `Tags: ${target.tags.join(', ')}` : '',
    target.metadata ? `Metadata: ${JSON.stringify(target.metadata).slice(0, 3000)}` : '',
    target.attachments?.length ? `Attachments: ${JSON.stringify(target.attachments).slice(0, 2000)}` : '',
    'Return ONLY JSON on first turn.',
  ].filter(Boolean).join('\n\n');
}

export function buildSidekickContextBlock(target: SidekickTarget): string {
  return `[SIDEKICK TARGET] type=${target.type} id=${target.id}\n${JSON.stringify({ title: target.title, content: (target.content || '').slice(0, 9000), tags: target.tags, metadata: target.metadata, attachments: target.attachments }, null, 2)}`;
}

// Back-compat aliases for summarize -> sidekick migration
export type SummarizeTarget = SidekickTarget;
export const buildSummarizeSystemInstruction = buildSidekickSystemInstruction;
export const buildSummarizeUserPrompt = buildSidekickUserPrompt;
export const buildSummarizeContextBlock = buildSidekickContextBlock;
