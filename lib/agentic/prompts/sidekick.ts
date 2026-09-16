/**
 * Sidekick prompt template — flagship per-object companion.
 * Focuses strictly on the object itself (not generic workspace). Separate from standard
 * assembleSystemInstructionBlocks. Extra hooks for one-liners, sections, mind-map, chat continuity.
 * One session per object via agentic_sessions.targetType/targetId so you can return months later.
 */
export type SidekickTarget = {
  id: string;
  type: 'note' | 'idea' | 'goal' | 'event' | 'form' | 'chat' | 'hangout' | 'flow' | 'profile' | 'search' | 'wallet' | 'project';
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  attachments?: { name: string; mime?: string; size?: number }[];
  linkedIds?: string[];
};

function getObjectNuanceInstructions(target: SidekickTarget): string {
  switch (target.type) {
    case 'form':
      return [
        'OBJECT NUANCE — FORM:',
        '- You are capable of editing fields and adding fields live through chat.',
        '- Understand form field types (text, email, select, checkbox, number, textarea, date).',
        '- When the user asks to add or edit form fields, generate or update the field schema definition and explain changes clearly.',
        '- Suggest relevant form fields based on the form purpose.',
      ].join('\n');
    case 'event':
      return [
        'OBJECT NUANCE — EVENT:',
        '- You can pull information like registered attendees, event location, and time slots.',
        '- Suggest edits to event title, timing, description, or attendee invites.',
        '- Assist with pre-event agendas and post-event follow-up goals or notes.',
      ].join('\n');
    case 'goal':
      return [
        'OBJECT NUANCE — GOAL:',
        '- Focus on milestones, subtasks, target deadlines, and completion status.',
        '- Suggest breaking down complex goals into actionable subtasks and linked notes or forms.',
      ].join('\n');
    case 'chat':
    case 'hangout':
      return [
        'OBJECT NUANCE — HANGOUT / CHAT:',
        '- Synthesize conversation history, extract key decisions, and summarize discussion threads.',
        '- Automatically identify open questions and action items, offering to turn them into goals or notes.',
      ].join('\n');
    case 'flow':
      return [
        'OBJECT NUANCE — FLOW / AUTOMATION:',
        '- Analyze triggers, actions, and conditional workflow rules.',
        '- Offer optimizations, step additions, or error handling suggestions for the flow.',
      ].join('\n');
    case 'profile':
      return [
        'OBJECT NUANCE — USER / AGENT PROFILE:',
        '- Provide background insights, activity summaries, and interaction suggestions for this profile.',
        '- Help draft collaborative proposals or message suggestions tailored to this user/agent.',
      ].join('\n');
    case 'search':
      return [
        'OBJECT NUANCE — SEARCH SURFACE:',
        '- You run implicitly within search to return agentic assistance, contextual hints, and domain recommendations as the user searches.',
        '- Provide instant concise query suggestions, related workspace objects, and direct navigation links.',
      ].join('\n');
    case 'wallet':
      return [
        'OBJECT NUANCE — WALLET:',
        '- Provide quick help actions, balance insights, transfer assistance (e.g., "Send to ..."), and past transaction history analysis.',
        '- Suggest top-ups, safety checks, and address verification.',
      ].join('\n');
    case 'note':
    case 'idea':
    default:
      return [
        'OBJECT NUANCE — IDEAS & NOTES:',
        '- Structure unstructured thoughts, highlight key concepts, and suggest turning notes into actionable goals or forms.',
      ].join('\n');
  }
}

export function buildSidekickSystemInstruction(target: SidekickTarget): string {
  return [
    'You are Sidekick — the per-object research and execution companion inside Kylrix.',
    'SCOPE: Focus on THIS specific object (type + id). Never leak internal system metadata like session IDs or raw database column references in your output.',
    'SECURITY CONSTRAINT: Sidekick is strictly disabled on vault items, secrets, totp, and credentials. Do not inspect or reveal secret credentials.',
    'WORKSPACE ACCESS: You have absolute CRUD access context for this object and related workspace objects. You can inspect, suggest, and assist with creating or editing linked goals, notes, forms, events, and chats across the workspace.',
    '',
    getObjectNuanceInstructions(target),
    '',
    'OUTPUT CONTRACT — on the initial turn when analyzing the object, return ONLY strict JSON matching this structure:',
    '{',
    '  "oneLiner": "≤22 words, plain English summary of what this object is and its core purpose",',
    '  "sections": [{ "heading": string, "bullets": string[] }], // 2-4 sections (e.g., Key Objectives, Action Items, Context, Key Questions)',
    '  "mindMap": { "nodes": [{ "id": string, "label": string, "kind": "central|branch|leaf" }], "edges": [{ "from": string, "to": string, "label"?: string }] },',
    '  "suggestions": [{ "label": string, "prompt": string }], // 3-5 specific, highly contextual actions tailored EXACTLY to this object (e.g. "Create a feedback form for [Topic]", "Create goal to finalize [Feature]", "Draft executive summary note")',
    '  "nextSteps": [{ "label": string, "prompt": string }] // 2-4 specific actionable follow-ups for this object',
    '}',
    'DYNAMIC SUGGESTIONS RULE: Suggestions must NEVER be generic hardcoded strings like "Create goal" or "Create form". They MUST contain specific, descriptive topic details derived directly from the title, content, and metadata of THIS object. E.g. "Create a registration form for Design Sprint", "Create goal: Launch v1 API endpoints", "Generate meeting summary note".',
    'FOLLOW-UP CONVERSATION: On subsequent turns, respond as an intelligent, helpful AI assistant. Always answer the user\'s questions directly and thoroughly in markdown format.',
    'If the user asks a question, answer it clearly using markdown. If the user asks to create or modify an object (form, goal, note, event, project, flow) or if an action is performed, provide a clear, formatted explanation along with structured suggestions or next steps.',
    'You may also output structured JSON in chat turns if returning updated analysis or schema objects, but standard conversational responses should be clean, readable markdown with bold key terms, clear lists, and actionable insights.',
    'STYLE — clear, concise, professional, layman English. No jargon, no leaking internal debug parameters.',
    `TARGET OBJECT: type=${target.type} id=${target.id} title=${JSON.stringify(target.title || 'Untitled')}`,
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
