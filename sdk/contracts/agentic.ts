/**
 * Agentic tool contracts — shared Zod shapes, prompt payload docs, and registry metadata.
 */
import { z } from 'zod';
import { goalCreateInputZod, goalUpdateInputZod } from './goals';
import { noteCreateInputZod, noteUpdateInputZod } from './notes';
import { linkToProjectInputZod, switchWorkspaceInputZod, workspaceCreateInputZod } from './workspaces';

export const suggestNextStepZod = z.object({
  label: z.string(),
  prompt: z.string(),
});

export const suggestNextStepsInputZod = z.object({
  suggestions: z.array(suggestNextStepZod).min(1).max(6),
});

export const uiNavigateInputZod = z.object({
  target: z.string().optional(),
  route: z.string().optional(),
});

export const searchEcosystemInputZod = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
});

export const getNoteInputZod = z.object({
  id: z.string().min(1),
});

export interface AgenticToolDefinition {
  key: string;
  name: string;
  description: string;
  requiresAuthorization: boolean;
  parameters: string[];
}

/** Canonical Zod contracts keyed by agentic tool name. */
export const AGENTIC_TOOL_SCHEMAS = {
  create_note: noteCreateInputZod.extend({
    content: z.string().describe('Full markdown content of the note'),
  }),
  update_note: noteUpdateInputZod,
  get_note: getNoteInputZod,
  create_goal: goalCreateInputZod,
  update_goal: goalUpdateInputZod.extend({ id: z.string().min(1) }),
  create_project: workspaceCreateInputZod,
  link_to_project: linkToProjectInputZod,
  switch_workspace: switchWorkspaceInputZod,
  'ui.navigate': uiNavigateInputZod,
  search_ecosystem: searchEcosystemInputZod,
  suggest_next_steps: suggestNextStepsInputZod,
} as const;

export const AGENTIC_TOOLS_REGISTRY: AgenticToolDefinition[] = [
  {
    key: 'create_note',
    name: 'Create Idea (Note)',
    description:
      'Create a new Idea row in table notes (id 67ff05f3002502ef239e). Specifiers: none. REQUIRED args: title (string), content (string markdown). Optional: tags (string[]), isPublic (boolean). System assigns userId/$id. After success the client upserts the live notes list. NEVER claim creation without emitting this toolCall.',
    requiresAuthorization: false,
    parameters: ['title', 'content', 'tags', 'isPublic'],
  },
  {
    key: 'update_note',
    name: 'Update Idea (Note)',
    description:
      'Edit an existing Idea. Preferred: args.id (note $id) + fields to change (title, content, tags, isPublic). Legacy specifier note_$id still works. Use [SESSION OBJECTS] for ids.',
    requiresAuthorization: false,
    parameters: ['id', 'title', 'content', 'tags', 'isPublic'],
  },
  {
    key: 'get_note',
    name: 'Get Idea (Note)',
    description:
      'Load one Idea by $id for continued reading. Preferred: args.id (note $id). Legacy specifier note_$id still accepted. Prefer ids from [SESSION OBJECTS].',
    requiresAuthorization: false,
    parameters: ['id'],
  },
  {
    key: 'create_goal',
    name: 'Create Goal/Task',
    description:
      'Create a Goal in table tasks. Prefer goals for productivity follow-through on every page. Args: title (required), status, priority, dueDate, description. Set isAgentic true when Kylie creates the goal (not the user). Specifiers: none.',
    requiresAuthorization: false,
    parameters: ['title', 'status', 'priority', 'dueDate', 'description', 'isAgentic'],
  },
  {
    key: 'update_goal',
    name: 'Update Goal/Task',
    description:
      'Modify status/priority/details of a goal. Preferred: args.id (goal $id) + fields. Legacy specifier goal_id still works.',
    requiresAuthorization: false,
    parameters: ['id', 'title', 'status', 'priority', 'dueDate'],
  },
  {
    key: 'create_project',
    name: 'Create Project',
    description: 'Spin up a new flagship project workspace. Specifiers: none.',
    requiresAuthorization: false,
    parameters: ['title', 'summary'],
  },
  {
    key: 'create_or_select_agent',
    name: 'Create or Select Agent',
    description:
      'Open the agent selection/creation drawer so user can pick an existing agent or create a new one for the current goal/task. Optional args: name, goal.',
    requiresAuthorization: false,
    parameters: ['name', 'goal'],
  },
  {
    key: 'open_wallet_funding',
    name: 'Open Wallet Funding',
    description:
      'Open wallet-guided funding flow for agentic execution. Optional args: amount, chainId, intentId, agentId. Use this when task needs funded execution.',
    requiresAuthorization: false,
    parameters: ['amount', 'chainId', 'intentId', 'agentId'],
  },
  {
    key: 'link_to_project',
    name: 'Connect to Project',
    description:
      'Attach an Idea or Goal to a Project workspace. Specifier: project $id. Args: objectType ("note"|"goal"), objectId (required). Prefer project ids from Active Projects context.',
    requiresAuthorization: false,
    parameters: ['objectType', 'objectId', 'projectId'],
  },
  {
    key: 'suggest_next_steps',
    name: 'Suggest Next Steps',
    description:
      'Emit 2–4 clickable next-step chips in chat. REQUIRED args.suggestions: array of { label: short UI text, prompt: FULL instruction Kylie will auto-run when clicked }. Prompts must be self-contained so one click completes the flow (create_goal, create_note, create_project, link_to_project, navigate_workspace, update_note, etc). Prefer at least one goal-oriented step on every turn when useful. Use recent idea titles + habits + live chat. Specifiers: none.',
    requiresAuthorization: false,
    parameters: ['suggestions'],
  },
  {
    key: 'toggle_privacy',
    name: 'Toggle Visibility',
    description:
      'Toggle resource public/guest. Preferred: args.id (resource $id) + isPublic/isGuest. Legacy specifier object_id still works.',
    requiresAuthorization: true,
    parameters: ['id', 'isPublic', 'isGuest'],
  },
  {
    key: 'navigate_workspace',
    name: 'Navigate Workspace (Deprecated alias — use ui.navigate)',
    description:
      'Alias of ui.navigate — same impl. Prefer ui.navigate at prompt layer. Args: target (semantic id) OR route (path).',
    requiresAuthorization: false,
    parameters: ['target', 'route'],
  },
  {
    key: 'switch_workspace',
    name: 'Switch Active Workspace',
    description:
      'Switch the active workspace context to a target workspace ID or title. Specifier: workspace $id or title. Args: workspaceId (string), workspaceTitle (optional string). User is instantly context-switched without leaving the app.',
    requiresAuthorization: false,
    parameters: ['workspaceId', 'workspaceTitle'],
  },
  {
    key: 'ui.navigate',
    name: 'Navigate (Canonical)',
    description:
      'Navigate via semantic target id (settings.passkeys, goals.home, etc.) or raw route. Canonical — prefer over navigate_workspace.',
    requiresAuthorization: false,
    parameters: ['target', 'route'],
  },
  {
    key: 'search_ecosystem',
    name: 'Search Ecosystem',
    description:
      'Intelligent cross-domain search. Args: query (required). Engine receives id-only hit refs; client renders rich local-copy cards. Do not paste hit lists in response text — summarize or chain get_note / ui.navigate.',
    requiresAuthorization: false,
    parameters: ['query', 'limit'],
  },
  {
    key: 'objects.form.read',
    name: 'Read Form Schema',
    description: 'Load a form definition and schema. Specifier REQUIRED: form $id.',
    requiresAuthorization: false,
    parameters: [],
  },
  {
    key: 'objects.form.submit',
    name: 'Submit Form Response',
    description:
      'Prepare a form submission from structured answers. Opens preview drawer before commit. Specifier: form $id. Args: payload (object keyed by field ids).',
    requiresAuthorization: false,
    parameters: ['payload', 'formId'],
  },
  {
    key: 'ui.preview.open',
    name: 'Open Agentic Preview',
    description:
      'Show preview drawer for staged changes (form submit, conversions). Args: kind, title, payload.',
    requiresAuthorization: false,
    parameters: ['kind', 'title', 'payload', 'previewId'],
  },
  {
    key: 'delete_resource',
    name: 'Delete Resource',
    description:
      'Delete an Idea/Goal/Project. Preferred: args.id + type ("note"|"goal"|"project"). Legacy specifier resource_$id still works.',
    requiresAuthorization: true,
    parameters: ['id', 'type'],
  },
  {
    key: 'list_goals',
    name: 'List All Goals',
    description:
      'Fetch and list all active user goals/tasks across all statuses or query by query string or ".all" to return every non-trashed goal. Specifiers: optional query string or ".all" for everything. Args: query (optional string, e.g. ".all" or "backend").',
    requiresAuthorization: false,
    parameters: ['query'],
  },
  {
    key: 'wallet_get_balance',
    name: 'Get Wallet Balance & Chains',
    description:
      'Fetch current balances and chain addresses for Kylrix, Solana, ETH, BTC, SUI, Base, Polygon, Arbitrum. Optional args: token (string, e.g. "SOL", "KYLRIX", "ALL"). Requires authorization confirmation to access on-chain assets.',
    requiresAuthorization: true,
    parameters: ['token'],
  },
  {
    key: 'wallet_send_tokens',
    name: 'Send Tokens / Kylrix',
    description:
      'Initiate a token transfer or native Kylrix tip to a recipient. Args: token (string, e.g. "KYLRIX", "SOL"), amount (string or number), recipientUsername (string) or recipientUserId (string). Requires authorization and security unlock.',
    requiresAuthorization: true,
    parameters: ['token', 'amount', 'recipientUsername', 'recipientUserId'],
  },
  {
    key: 'search_users',
    name: 'Search Users / Directory',
    description:
      'Search users by username, display name, or handle to select a transfer target or mention. Args: query (string). Returns matched user cards with avatars and user IDs directly in chat.',
    requiresAuthorization: false,
    parameters: ['query', 'limit'],
  },
];

/** Exact create_note / update_note / next-step args the model must emit. */
export const NOTE_TOOL_PAYLOAD_SCHEMA = `{
  "create_note": {
    "toolKey": "create_note",
    "specifier": null,
    "args": {
      "title": "string — required, Idea title",
      "content": "string — required, markdown body",
      "tags": ["optional string array of tag names"],
      "isPublic": "optional boolean, default false"
    }
  },
  "update_note": {
    "toolKey": "update_note",
    "specifier": null,
    "args": {
      "id": "string — required, note $id (preferred); legacy specifier still accepted",
      "title": "optional string",
      "content": "optional string markdown",
      "tags": ["optional string array"],
      "isPublic": "optional boolean"
    }
  },
  "get_note": {
    "toolKey": "get_note",
    "specifier": null,
    "args": {
      "id": "string — required, note $id"
    }
  },
  "suggest_next_steps": {
    "toolKey": "suggest_next_steps",
    "specifier": null,
    "args": {
      "suggestions": [
        {
          "label": "short chip text the user sees",
          "prompt": "natural-language trigger Kylie executes as tool call next turn"
        }
      ]
    }
  },
  "create_goal": {
    "toolKey": "create_goal",
    "specifier": null,
    "args": {
      "title": "string — required, descriptive goal title",
      "description": "string — required, detailed goal description explaining what to accomplish",
      "status": "todo|in_progress|done — optional, default todo",
      "priority": "low|medium|high — optional, default medium",
      "dueDate": "ISO date optional",
      "isAgentic": true
    }
  },
  "list_goals": {
    "toolKey": "list_goals",
    "specifier": ".all | query_string — optional",
    "args": {
      "query": "optional string e.g. '.all' to fetch all non-trashed goals"
    }
  },
  "link_to_project": {
    "toolKey": "link_to_project",
    "specifier": "project_$id — required",
    "args": {
      "objectType": "note|goal",
      "objectId": "string — required",
      "projectId": "optional workspace id"
    }
  },
  "delete_resource": {
    "toolKey": "delete_resource",
    "specifier": null,
    "args": {
      "id": "string — required, resource $id (preferred)",
      "type": "note|goal|project — required"
    }
  },
  "create_or_select_agent": {
    "toolKey": "create_or_select_agent",
    "specifier": null,
    "args": {
      "name": "optional suggested agent name",
      "goal": "optional agent objective"
    }
  },
  "open_wallet_funding": {
    "toolKey": "open_wallet_funding",
    "specifier": "optional agent id",
    "args": {
      "amount": "optional numeric amount",
      "chainId": "optional numeric chain id",
      "intentId": "optional payment intent id",
      "agentId": "optional target agent id"
    }
  }
}`;
