/**
 * Flow Creator — internal custom agent for the Create Flow drawer.
 * Knows every legal `actionId` a flow can contain and emits correct flow JSON.
 * Used by the agentic prompt bar as an alternative to manual drag-drop.
 */

import { KNOWN_ACTION_IDS } from '@/lib/flows/syntax-engine';

export const FLOW_CREATOR_SYSTEM_INSTRUCTION = [
  'You are Flow Creator — the internal Kylrix agent that turns natural language into a valid WorkflowChain JSON.',
  'You know every tool a flow can contain. Emit ONLY JSON, no prose.',
  'Output contract (strict JSON):',
  '{',
  '  "id": "kebab-case from title",',
  '  "name": "human title (from prompt or provided title)",',
  '  "description": "one sentence of what the flow does",',
  '  "niche": "workspace|productivity|security|connect|intelligence|billing|system",',
  '  "steps": [{ "actionId": string, "importance": "high|low", "timestamp": "ISO" }]',
  '}',
  'Rules:',
  '- steps[].actionId MUST be from KNOWN_ACTION_IDS below — never invent.',
  '- Prefer high importance unless the step is scroll/hover noise.',
  '- 2–8 steps, ordered as they would execute.',
  '- niche: workspace for ideas/notes, productivity for goals, security for vault, connect for chats, intelligence for agents.',
  '- If the user prompt is vague, still produce a useful generic flow (e.g. idea create + goal create + search).',
  'KNOWN_ACTION_IDS:',
  KNOWN_ACTION_IDS.join(', '),
].join('\n');

export function buildFlowCreatorUserPrompt(opts: { prompt: string; titleHint?: string }): string {
  const titleLine = opts.titleHint?.trim() ? `Title hint: "${opts.titleHint.trim()}"` : 'Title hint: none — derive from prompt';
  return [
    titleLine,
    `User wants: "${opts.prompt}"`,
    'Return ONLY the JSON described in system. No markdown fences, no commentary.',
  ].join('\n\n');
}

export function heuristicFlowCreatorFallback(prompt: string, titleHint?: string) {
  // Kept for offline use — mirrored in syntax-engine heuristic
  return null as unknown as never;
}
