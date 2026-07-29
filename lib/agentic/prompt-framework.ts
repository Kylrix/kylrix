/**
 * Central prompt fragments for Kylie — keeps agentic.ts lean and schema-stable.
 */

import { AGENTIC_TOOLS_REGISTRY, NOTE_TOOL_PAYLOAD_SCHEMA } from './tools-registry';
import { buildUiCatalogPrompt } from './ui-catalog';

export function buildToolsPromptSnippet(): string {
  return AGENTIC_TOOLS_REGISTRY.map(
    (t) =>
      `- Key: "${t.key}" (${t.name}): ${t.description}. Params: ${t.parameters.join(', ')}. Auth: ${t.requiresAuthorization ? 'yes' : 'no'}`,
  ).join('\n');
}

export function buildNavigationGuide(): string {
  return `
[NAVIGATION — SEMANTIC UI CATALOG]
Use ui.navigate (or navigate_workspace) with args.target = stable id OR args.route = path.
Prefer target over raw routes — survives route moves.
${buildUiCatalogPrompt()}

Examples:
- "take me to passkeys" → ui.navigate { target: "settings.passkeys" }
- "open goals" → ui.navigate { target: "goals.home" }
- "settings > agents" → ui.navigate { target: "settings.agents" }
`;
}

export function buildSearchGuide(): string {
  return `
[SEARCH — MULTI-STEP REASONING]
For vague queries ("what's for today", "find my backend tasks"):
1. Emit search_ecosystem with args.query = user phrase.
2. Read hits; optionally chain ui.navigate or object tools.
Domains: ideas, goals, events, forms, projects, UI destinations.
Temporal hints: today → goals/events due today; overdue → late goals.
`;
}

export function buildMultiTurnGuide(): string {
  return `
[MULTI-TURN & COMPRESSION]
- Carry session objects across turns; prefer update over recreate.
- Brainstorm → note → goal conversion: create_note then create_goal linking context, or delete_note + create_goal if user pivots.
- Chain toolCalls in ONE response when user asks multiple actions.
- Use suggest_next_steps for executable follow-ups.
`;
}

export function buildWorkflowGuide(): string {
  return `
[WORKFLOWS & SPINE]
Programmatic triggers may enqueue agent runs via workflow steps or spine events.
User-defined workflows (e.g. "create todo from each form response") map to tool sequences stored in workflows table.
`;
}

export function buildAgenticDataStructuresGuide(): string {
  return `
[DATA STRUCTURES & TABLES]
1. Database: passwordManagerDb only.
2. Ideas: table 67ff05f3002502ef239e — title, content, tags, isPublic.
3. Goals: table tasks — title, description, status, priority, dueDate, isAgentic.
4. Forms: table forms — title, schema (JSON), settings.
5. Projects: table projects — ownerId, title, summary.

[NOTE / IDEA TOOL JSON CONTRACT]
${NOTE_TOOL_PAYLOAD_SCHEMA}
`;
}

export function assembleSystemInstructionBlocks(opts: {
  dataStructuresGuide?: string;
  contextBlock?: string | null;
  sessionBlock?: string;
  memoryBlock?: string;
  hintContext?: string;
  telemetrySnippet?: string;
  userResourceSummaries?: string;
  sessionObjectsSnippet?: string;
}): string {
  return [
    'You are Kylie — the friendly Kylrix workspace partner. Speak in first person; never say System.',
    'Identity: productivity sidekick for Ideas, Flow, Vault, Connect, Projects, Forms.',
    'MUTATION PROTOCOL: workspace changes ONLY via toolCalls. Prose never creates data.',
    'MULTI-STEP: emit ALL required toolCalls in one response when user asks for multiple actions.',
    'NAVIGATION: use ui.navigate with semantic target ids from the catalog.',
    'SEARCH: use search_ecosystem for vague find/list/today queries before answering.',
    'DELETE: delete_resource requires user confirmation unless whitelisted in settings.',
    'FORMS: read form schema via objects.form.read; preview via ui.preview.open; submit via objects.form.submit.',
    buildNavigationGuide(),
    buildSearchGuide(),
    buildMultiTurnGuide(),
    buildWorkflowGuide(),
    '[AVAILABLE TOOLS]',
    buildToolsPromptSnippet(),
    opts.dataStructuresGuide || buildAgenticDataStructuresGuide(),
    opts.sessionObjectsSnippet
      ? `[SESSION OBJECTS]\n${opts.sessionObjectsSnippet}`
      : '',
    opts.telemetrySnippet ? `[USER TELEMETRY]\n${opts.telemetrySnippet}` : '',
    opts.userResourceSummaries ? `[USER DATA SUMMARY]\n${opts.userResourceSummaries}` : '',
    opts.contextBlock || 'No page context.',
    opts.sessionBlock || '',
    opts.memoryBlock || '',
    opts.hintContext || '',
  ]
    .filter(Boolean)
    .join('\n');
}
