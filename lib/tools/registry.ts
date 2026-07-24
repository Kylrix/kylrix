/**
 * Kylrix Universal Tooling Abstraction Layer
 * Centralized tool registry exposing CRUDS operations for all ecosystem domain objects.
 * Executed by both the User UI interactions and the AI Agentic Engine.
 */

export interface ToolParameterSpec {
  type: string;
  description: string;
  required?: boolean;
}

export interface EcosystemToolDefinition {
  id: string;
  domain:
    | 'workspace'
    | 'idea'
    | 'goal'
    | 'vault'
    | 'event'
    | 'form'
    | 'tag'
    | 'thread'
    | 'huddle'
    | 'hangout'
    | 'moment'
    | 'user'
    | 'storage'
    | 'github'
    | 'wallet';
  action: 'create' | 'read' | 'update' | 'delete' | 'search' | 'custom';
  name: string;
  description: string;
  parameters: Record<string, ToolParameterSpec>;
  isSecure?: boolean;
  execute: (params: Record<string, any>, context?: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>;
}

class ToolRegistry {
  private tools = new Map<string, EcosystemToolDefinition>();

  register(tool: EcosystemToolDefinition) {
    this.tools.set(tool.id, tool);
  }

  get(id: string): EcosystemToolDefinition | undefined {
    return this.tools.get(id);
  }

  list(): EcosystemToolDefinition[] {
    return Array.from(this.tools.values());
  }

  listByDomain(domain: EcosystemToolDefinition['domain']): EcosystemToolDefinition[] {
    return this.list().filter((t) => t.domain === domain);
  }

  async executeTool(
    id: string,
    params: Record<string, any>,
    context?: Record<string, any>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const tool = this.get(id);
    if (!tool) {
      return { success: false, error: `Tool "${id}" not found in registry.` };
    }
    try {
      const sanitizedParams = tool.isSecure ? redactPIIAndSensitiveFields(params) : params;
      return await tool.execute(sanitizedParams, context);
    } catch (err: any) {
      console.error(`[ToolRegistry] Error executing ${id}:`, err);
      return { success: false, error: err?.message || 'Tool execution failed.' };
    }
  }
}

export const toolRegistry = new ToolRegistry();

/**
 * PII and Security Redaction Boundary
 * Strips sensitive fields (passwords, secrets, master keys) before passing payloads to AI context.
 */
export function redactPIIAndSensitiveFields<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => redactPIIAndSensitiveFields(item)) as unknown as T;
  }

  const redacted: Record<string, any> = {};
  const sensitiveKeys = ['password', 'secret', 'dek', 'privatekey', 'totpsecret', 'masterpass', 'verifier', 'token'];

  for (const [key, value] of Object.entries(payload as Record<string, any>)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPIIAndSensitiveFields(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted as T;
}

// Helper to register standard tools
function registerCoreTools() {
  // 1. Workspaces (formerly Projects)
  toolRegistry.register({
    id: 'workspace.create',
    domain: 'workspace',
    action: 'create',
    name: 'Create Workspace',
    description: 'Create a new flagship workspace.',
    parameters: {
      title: { type: 'string', description: 'Workspace title', required: true },
      summary: { type: 'string', description: 'Workspace summary' },
      visibility: { type: 'string', description: 'private | shared | public' },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const doc = await ProjectsService.createProject(params as any);
      return { success: true, data: doc };
    },
  });

  toolRegistry.register({
    id: 'workspace.read',
    domain: 'workspace',
    action: 'read',
    name: 'Read Workspace',
    description: 'Get workspace details or list all workspaces.',
    parameters: {
      id: { type: 'string', description: 'Workspace ID' },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      if (params.id) {
        const doc = await ProjectsService.getProject(params.id);
        return { success: true, data: doc };
      }
      const list = await ProjectsService.listProjects(true);
      return { success: true, data: list.rows };
    },
  });

  toolRegistry.register({
    id: 'workspace.update',
    domain: 'workspace',
    action: 'update',
    name: 'Update Workspace',
    description: 'Update workspace metadata, title, or visibility.',
    parameters: {
      id: { type: 'string', description: 'Workspace ID', required: true },
      title: { type: 'string', description: 'New title' },
      summary: { type: 'string', description: 'New summary' },
      visibility: { type: 'string', description: 'private | shared | public' },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const doc = await ProjectsService.updateProject(params.id, params as any);
      return { success: true, data: doc };
    },
  });

  toolRegistry.register({
    id: 'workspace.delete',
    domain: 'workspace',
    action: 'delete',
    name: 'Delete Workspace',
    description: 'Delete a workspace by ID.',
    parameters: {
      id: { type: 'string', description: 'Workspace ID', required: true },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      await ProjectsService.deleteProject(params.id);
      return { success: true, data: { deletedId: params.id } };
    },
  });

  toolRegistry.register({
    id: 'workspace.search',
    domain: 'workspace',
    action: 'search',
    name: 'Search Workspace Sub-objects',
    description: 'Search sub-objects attached to a workspace.',
    parameters: {
      query: { type: 'string', description: 'Search term', required: true },
      workspaceId: { type: 'string', description: 'Workspace ID' },
    },
    execute: async (params) => {
      const { getSessionProjectsList } = await import('@/lib/projects/projects-cache');
      const list = getSessionProjectsList() || [];
      const term = String(params.query || '').toLowerCase();
      const filtered = list.filter((w) => w.title?.toLowerCase().includes(term) || w.summary?.toLowerCase().includes(term));
      return { success: true, data: filtered };
    },
  });

  // 2. Ideas (Notes)
  toolRegistry.register({
    id: 'objects.idea.create',
    domain: 'idea',
    action: 'create',
    name: 'Create Idea (Note)',
    description: 'Create a new markdown note/idea.',
    parameters: {
      title: { type: 'string', description: 'Idea title', required: true },
      content: { type: 'string', description: 'Markdown content body', required: true },
      tags: { type: 'array', description: 'Tag names array' },
      isPublic: { type: 'boolean', description: 'Public access toggle' },
    },
    execute: async (params) => {
      const { createNote } = await import('@/lib/appwrite/note');
      const note = await createNote(params as any);
      return { success: true, data: note };
    },
  });

  toolRegistry.register({
    id: 'objects.idea.read',
    domain: 'idea',
    action: 'read',
    name: 'Read Idea (Note)',
    description: 'Read an idea by ID or list user ideas.',
    parameters: {
      id: { type: 'string', description: 'Note ID' },
    },
    execute: async (params) => {
      const { getNote, listNotes } = await import('@/lib/appwrite/note');
      if (params.id) {
        const note = await getNote(params.id);
        return { success: true, data: note };
      }
      const res = await listNotes();
      return { success: true, data: res.rows };
    },
  });

  toolRegistry.register({
    id: 'objects.idea.update',
    domain: 'idea',
    action: 'update',
    name: 'Update Idea (Note)',
    description: 'Update an existing idea note.',
    parameters: {
      id: { type: 'string', description: 'Note ID', required: true },
      title: { type: 'string', description: 'New title' },
      content: { type: 'string', description: 'New content body' },
      tags: { type: 'array', description: 'Updated tag array' },
    },
    execute: async (params) => {
      const { updateNote } = await import('@/lib/appwrite/note');
      const note = await updateNote(params.id, params as any);
      return { success: true, data: note };
    },
  });

  toolRegistry.register({
    id: 'objects.idea.delete',
    domain: 'idea',
    action: 'delete',
    name: 'Delete Idea (Note)',
    description: 'Delete an idea note by ID.',
    parameters: {
      id: { type: 'string', description: 'Note ID', required: true },
    },
    execute: async (params) => {
      const { deleteNote } = await import('@/lib/appwrite/note');
      await deleteNote(params.id);
      return { success: true, data: { deletedId: params.id } };
    },
  });

  toolRegistry.register({
    id: 'objects.idea.search',
    domain: 'idea',
    action: 'search',
    name: 'Search Ideas',
    description: 'Search ideas by keyword or tag.',
    parameters: {
      query: { type: 'string', description: 'Search term', required: true },
    },
    execute: async (params) => {
      const { listNotes } = await import('@/lib/appwrite/note');
      const res = await listNotes();
      const term = String(params.query || '').toLowerCase();
      const matched = (res.rows || []).filter(
        (n: any) => n.title?.toLowerCase().includes(term) || n.content?.toLowerCase().includes(term)
      );
      return { success: true, data: matched };
    },
  });

  // 3. Goals (Tasks)
  toolRegistry.register({
    id: 'objects.goal.create',
    domain: 'goal',
    action: 'create',
    name: 'Create Goal/Task',
    description: 'Create a new execution goal or task.',
    parameters: {
      title: { type: 'string', description: 'Goal title', required: true },
      status: { type: 'string', description: 'todo | in_progress | done' },
      priority: { type: 'string', description: 'low | medium | high' },
      dueDate: { type: 'string', description: 'ISO due date' },
      description: { type: 'string', description: 'Detailed description' },
    },
    execute: async (params) => {
      const { tasks } = await import('@/lib/kylrixflow');
      const task = await tasks.create(params as any);
      return { success: true, data: task };
    },
  });

  toolRegistry.register({
    id: 'objects.goal.read',
    domain: 'goal',
    action: 'read',
    name: 'Read Goal/Task',
    description: 'Fetch goal details or list tasks.',
    parameters: {
      id: { type: 'string', description: 'Goal ID' },
    },
    execute: async (params) => {
      const { tasks } = await import('@/lib/kylrixflow');
      if (params.id) {
        const item = await tasks.get(params.id).catch(() => null);
        return { success: true, data: item };
      }
      const list = await tasks.list();
      return { success: true, data: list.rows };
    },
  });

  toolRegistry.register({
    id: 'objects.goal.update',
    domain: 'goal',
    action: 'update',
    name: 'Update Goal/Task',
    description: 'Update status, priority, or details of a task.',
    parameters: {
      id: { type: 'string', description: 'Goal ID', required: true },
      status: { type: 'string', description: 'New status' },
      priority: { type: 'string', description: 'New priority' },
      title: { type: 'string', description: 'New title' },
    },
    execute: async (params) => {
      const { tasks } = await import('@/lib/kylrixflow');
      const { id, ...updates } = params;
      const updated = await tasks.update(id, updates as any);
      return { success: true, data: updated };
    },
  });

  toolRegistry.register({
    id: 'objects.goal.delete',
    domain: 'goal',
    action: 'delete',
    name: 'Delete Goal/Task',
    description: 'Remove a task permanently.',
    parameters: {
      id: { type: 'string', description: 'Goal ID', required: true },
    },
    execute: async (params) => {
      const { tasks } = await import('@/lib/kylrixflow');
      await tasks.delete(params.id);
      return { success: true, data: { deletedId: params.id } };
    },
  });

  toolRegistry.register({
    id: 'objects.goal.search',
    domain: 'goal',
    action: 'search',
    name: 'Search Goals',
    description: 'Search goals by title or description.',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
    },
    execute: async (params) => {
      const { listFlowTasks } = await import('@/lib/appwrite/note');
      const res = await listFlowTasks();
      const term = String(params.query || '').toLowerCase();
      const matched = res.rows.filter(
        (t: any) => t.title?.toLowerCase().includes(term) || t.description?.toLowerCase().includes(term)
      );
      return { success: true, data: matched };
    },
  });

  // 4. Vault Credentials / Secrets
  toolRegistry.register({
    id: 'objects.vault.secret.create',
    domain: 'vault',
    action: 'create',
    name: 'Create Vault Secret',
    description: 'Store a password or credential entry in the vault.',
    isSecure: true,
    parameters: {
      name: { type: 'string', description: 'Credential title / service name', required: true },
      username: { type: 'string', description: 'Username or login ID' },
    },
    execute: async (params) => {
      const { VaultService } = await import('@/lib/appwrite/vault');
      const created = await VaultService.createCredential(params as any);
      return { success: true, data: redactPIIAndSensitiveFields(created) };
    },
  });

  toolRegistry.register({
    id: 'objects.vault.secret.read',
    domain: 'vault',
    action: 'read',
    name: 'Read Vault Secrets',
    description: 'List vault secrets (sensitive payload redacted).',
    isSecure: true,
    parameters: {},
    execute: async () => {
      const { listKeepCredentials } = await import('@/lib/appwrite/note');
      const res = await listKeepCredentials();
      return { success: true, data: redactPIIAndSensitiveFields(res.rows) };
    },
  });

  toolRegistry.register({
    id: 'objects.vault.secret.delete',
    domain: 'vault',
    action: 'delete',
    name: 'Delete Vault Secret',
    description: 'Delete a credential secret by ID.',
    parameters: {
      id: { type: 'string', description: 'Secret ID', required: true },
    },
    execute: async (params) => {
      const { VaultService } = await import('@/lib/appwrite/vault');
      await VaultService.deleteCredential(params.id);
      return { success: true, data: { deletedId: params.id } };
    },
  });

  toolRegistry.register({
    id: 'objects.vault.secret.search',
    domain: 'vault',
    action: 'search',
    name: 'Search Vault Secrets',
    description: 'Search stored secrets by title/service name.',
    isSecure: true,
    parameters: {
      query: { type: 'string', description: 'Search term', required: true },
    },
    execute: async (params) => {
      const { listKeepCredentials } = await import('@/lib/appwrite/note');
      const res = await listKeepCredentials();
      const term = String(params.query || '').toLowerCase();
      const matched = res.rows.filter((c: any) => c.name?.toLowerCase().includes(term));
      return { success: true, data: redactPIIAndSensitiveFields(matched) };
    },
  });

  // 5. Tags & Crosslinks
  toolRegistry.register({
    id: 'objects.tag.create',
    domain: 'tag',
    action: 'create',
    name: 'Create Tag',
    description: 'Create a crosslink tag.',
    parameters: {
      name: { type: 'string', description: 'Tag name', required: true },
      color: { type: 'string', description: 'HEX color string' },
    },
    execute: async (params) => {
      const { createTag } = await import('@/lib/appwrite/note');
      const tag = await createTag(params as any);
      return { success: true, data: tag };
    },
  });

  toolRegistry.register({
    id: 'objects.tag.search',
    domain: 'tag',
    action: 'search',
    name: 'Search Tags',
    description: 'Find tags by name.',
    parameters: {
      query: { type: 'string', description: 'Search term', required: true },
    },
    execute: async (params) => {
      const { listTags } = await import('@/lib/appwrite/note');
      const res = await listTags();
      const term = String(params.query || '').toLowerCase();
      const matched = res.rows.filter((t: any) => t.name?.toLowerCase().includes(term));
      return { success: true, data: matched };
    },
  });

  // 6. User Profile & Settings
  toolRegistry.register({
    id: 'user.profile.read',
    domain: 'user',
    action: 'read',
    name: 'Read User Profile',
    description: 'Get current user profile.',
    parameters: {},
    execute: async () => {
      const { getCurrentUser } = await import('@/lib/appwrite/client');
      const user = await getCurrentUser();
      return { success: true, data: user };
    },
  });

  toolRegistry.register({
    id: 'user.settings.update',
    domain: 'user',
    action: 'update',
    name: 'Update User Settings',
    description: 'Update user account preferences.',
    parameters: {
      key: { type: 'string', description: 'Preference key', required: true },
      value: { type: 'string', description: 'Preference value', required: true },
    },
    execute: async (params) => {
      const { account } = await import('@/lib/appwrite/client');
      const current = await account.getPrefs();
      const updated = await account.updatePrefs({ ...current, [params.key]: params.value });
      return { success: true, data: updated };
    },
  });
}

// Self-register core tools on module evaluation
registerCoreTools();
