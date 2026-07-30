export interface AgenticToolDefinition {
  key: string;
  name: string;
  description: string;
  requiresAuthorization: boolean;
  parameters: string[];
}

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
      'Edit an existing Idea. Specifier REQUIRED: note $id. Args may include title, content, tags, isPublic (only fields to change). Use session objects list or prior create_note results for the id.',
    requiresAuthorization: false,
    parameters: ['title', 'content', 'tags', 'isPublic'],
  },
  {
    key: 'get_note',
    name: 'Get Idea (Note)',
    description:
      'Load one Idea by $id for continued editing. Specifier REQUIRED: note $id. No args. Prefer ids from [SESSION OBJECTS].',
    requiresAuthorization: false,
    parameters: [],
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
      'Modify status, priority, or details of a goal. Specifiers: goal_id. Sub-specifier syntax: update_goal.[goal_id].[field_name].',
    requiresAuthorization: false,
    parameters: ['title', 'status', 'priority', 'dueDate'],
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
    parameters: ['objectType', 'objectId'],
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
      'Toggle resource public or guest access status. Specifiers: object_id (note_id or project_id). Sub-specifier syntax: toggle_privacy.[object_id].[isPublic].',
    requiresAuthorization: true,
    parameters: ['isPublic', 'isGuest'],
  },
  {
    key: 'navigate_workspace',
    name: 'Navigate Workspace',
    description:
      'Navigate user to a page. Prefer args.target (semantic id from UI catalog, e.g. settings.passkeys, goals.home) over raw routes. Args: target (string id) OR route (path). Resolves aliases like "passkeys", "goals", "assistant settings".',
    requiresAuthorization: false,
    parameters: ['target', 'route'],
  },
  {
    key: 'ui.navigate',
    name: 'Navigate (Semantic)',
    description:
      'Same as navigate_workspace. Use stable target ids from UI catalog (settings.passkeys, goals.home, forms.home, vault.totp, settings.agents).',
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
      'Delete an Idea (Note), Goal (Task), or Project. Specifier REQUIRED: resource $id. Args REQUIRED: type ("note"|"goal"|"project").',
    requiresAuthorization: true,
    parameters: ['type'],
  },
  {
    key: 'list_goals',
    name: 'List All Goals',
    description:
      'Fetch and list all active user goals/tasks across all statuses or query by query string or ".all" to return every non-trashed goal. Specifiers: optional query string or ".all" for everything. Args: query (optional string, e.g. ".all" or "backend").',
    requiresAuthorization: false,
    parameters: ['query'],
  },
];

export interface AgenticToolCallPayload {
  toolKey: string;
  specifier?: string;
  subSpecifier?: string;
  args: Record<string, any>;
}

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
    "specifier": "note_$id — required",
    "args": {
      "title": "optional string",
      "content": "optional string markdown",
      "tags": ["optional string array"],
      "isPublic": "optional boolean"
    }
  },
  "get_note": {
    "toolKey": "get_note",
    "specifier": "note_$id — required",
    "args": {}
  },
  "suggest_next_steps": {
    "toolKey": "suggest_next_steps",
    "specifier": null,
    "args": {
      "suggestions": [
        {
          "label": "short chip text the user sees",
          "prompt": "full self-contained instruction Kylie auto-runs on click (must trigger real tools)"
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
      "objectId": "string — required"
    }
  },
  "delete_resource": {
    "toolKey": "delete_resource",
    "specifier": "resource_$id — required",
    "args": {
      "type": "note|goal|project — required"
    }
  }
  ,
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
