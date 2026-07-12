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
    name: 'Create Note',
    description: 'Create a new ideas/note resource. Specifiers: none.',
    requiresAuthorization: false,
    parameters: ['title', 'content', 'tags', 'isPublic']
  },
  {
    key: 'update_note',
    name: 'Update Note',
    description: 'Edit fields of an existing note. Specifiers: note_id. Sub-specifier syntax: update_note.[note_id].[field_name].',
    requiresAuthorization: false,
    parameters: ['title', 'content', 'tags', 'isPublic']
  },
  {
    key: 'create_goal',
    name: 'Create Goal/Task',
    description: 'Create a new scheduled task or workflow goal. Specifiers: none.',
    requiresAuthorization: false,
    parameters: ['title', 'status', 'priority', 'dueDate']
  },
  {
    key: 'update_goal',
    name: 'Update Goal/Task',
    description: 'Modify status, priority, or details of a goal. Specifiers: goal_id. Sub-specifier syntax: update_goal.[goal_id].[field_name].',
    requiresAuthorization: false,
    parameters: ['title', 'status', 'priority', 'dueDate']
  },
  {
    key: 'create_project',
    name: 'Create Project',
    description: 'Spin up a new flagship project workspace. Specifiers: none.',
    requiresAuthorization: false,
    parameters: ['title', 'summary']
  },
  {
    key: 'toggle_privacy',
    name: 'Toggle Visibility',
    description: 'Toggle resource public or guest access status. Specifiers: object_id (note_id or project_id). Sub-specifier syntax: toggle_privacy.[object_id].[isPublic].',
    requiresAuthorization: true,
    parameters: ['isPublic', 'isGuest']
  },
  {
    key: 'navigate_workspace',
    name: 'Navigate Workspace',
    description: 'Redirect user to specific active paths (e.g. /settings, /flow, /projects). Specifiers: route_path.',
    requiresAuthorization: false,
    parameters: ['route']
  }
];

export interface AgenticToolCallPayload {
  toolKey: string;
  specifier?: string;
  subSpecifier?: string;
  args: Record<string, any>;
}
