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
    description: 'Create a new scheduled task or workflow goal. Specifiers: none.',
    requiresAuthorization: false,
    parameters: ['title', 'status', 'priority', 'dueDate'],
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
      'Redirect user to specific active paths (e.g. /settings, /flow, /projects). Specifiers: route_path.',
    requiresAuthorization: false,
    parameters: ['route'],
  },
];

export interface AgenticToolCallPayload {
  toolKey: string;
  specifier?: string;
  subSpecifier?: string;
  args: Record<string, any>;
}

/** Exact create_note / update_note args the model must emit. */
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
  }
}`;
