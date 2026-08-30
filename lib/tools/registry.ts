/**
 * Kylrix Universal Tooling Abstraction Layer
 * Centralized tool registry exposing CRUDS operations for all ecosystem domain objects.
 * Executed by both the User UI interactions and the AI Agentic Engine.
 */

interface ToolParameterSpec {
  type: string;
  description: string;
  required?: boolean;
}

interface EcosystemToolDefinition {
  id: string;
  /** Capability gate — defaults to TOOL_FEATURE_MAP[id] when pricing tiers are enabled. */
  featureId?: string;
  domain:
    | 'workspace'
    | 'project'
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
    | 'wallet'
    | 'developer'
    | 'markdown'
    | 'math';
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
      const gateError = await enforceToolFeatureGate(tool, context);
      if (gateError) {
        return { success: false, error: gateError };
      }
      const sanitizedParams = tool.isSecure ? redactPIIAndSensitiveFields(params) : params;
      return await tool.execute(sanitizedParams, context);
    } catch (err: any) {
      console.error(`[ToolRegistry] Error executing ${id}:`, err);
      return { success: false, error: err?.message || 'Tool execution failed.' };
    }
  }
}

async function enforceToolFeatureGate(
  tool: EcosystemToolDefinition,
  context?: Record<string, any>,
): Promise<string | null> {
  const userId = context?.userId || context?.actorUserId;
  if (!userId || context?.skipFeatureGate) return null;

  const { featureIdForTool } = await import('@/lib/tools/features');
  const { assertActorFeatureAccess } = await import('@/lib/tools/gate');

  const featureId = tool.featureId || featureIdForTool(tool.id);
  if (!featureId) return null;

  try {
    await assertActorFeatureAccess(String(userId), featureId);
    return null;
  } catch (err: any) {
    return err?.message || 'Feature requires an upgrade.';
  }
}

const toolRegistry = new ToolRegistry();

/**
 * PII and Security Redaction Boundary
 * Strips sensitive fields (passwords, secrets, master keys) before passing payloads to AI context.
 */
export function redactPIIAndSensitiveFields<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map((item: any) => redactPIIAndSensitiveFields(item)) as unknown as T;
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
      visibility: { type: 'string', description: 'private | shared | public' }},
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const doc = await ProjectsService.createProject(params as any);
      return { success: true, data: doc };
    }});

  // 1b. Workspace sub-projects (nested projects)
  toolRegistry.register({
    id: 'project.list',
    domain: 'project',
    action: 'read',
    name: 'List Workspace Projects',
    description: 'List nested projects inside a workspace.',
    parameters: {
      workspaceId: { type: 'string', description: 'Parent workspace ID', required: true },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const rows = await ProjectsService.listSubProjects(String(params.workspaceId));
      return { success: true, data: rows };
    },
  });

  toolRegistry.register({
    id: 'project.create',
    domain: 'project',
    action: 'create',
    name: 'Create Workspace Project',
    description: 'Create a nested project inside a workspace.',
    parameters: {
      workspaceId: { type: 'string', description: 'Parent workspace ID', required: true },
      title: { type: 'string', description: 'Project title', required: true },
      summary: { type: 'string', description: 'Project summary' },
      visibility: { type: 'string', description: 'private | public | team' },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const doc = await ProjectsService.createProject({
        title: String(params.title),
        summary: params.summary ? String(params.summary) : '',
        visibility: (params.visibility as any) || 'private',
        kind: 'project',
        parentProjectId: String(params.workspaceId),
      } as any);
      return { success: true, data: doc };
    },
  });

  toolRegistry.register({
    id: 'project.read',
    domain: 'project',
    action: 'read',
    name: 'Read Workspace Project',
    description: 'Get a nested project inside a workspace.',
    parameters: {
      workspaceId: { type: 'string', description: 'Parent workspace ID', required: true },
      projectId: { type: 'string', description: 'Sub-project ID', required: true },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const { getParentProjectId, isSubProjectRecord } = await import('@/lib/projects/sub-projects');
      const doc = await ProjectsService.getProject(String(params.projectId));
      if (!doc || !isSubProjectRecord(doc)) {
        return { success: false, error: 'Project not found' };
      }
      if (getParentProjectId(doc) !== String(params.workspaceId)) {
        return { success: false, error: 'Project not found in workspace' };
      }
      return { success: true, data: doc };
    },
  });

  toolRegistry.register({
    id: 'project.update',
    domain: 'project',
    action: 'update',
    name: 'Update Workspace Project',
    description: 'Update a nested project inside a workspace.',
    parameters: {
      workspaceId: { type: 'string', description: 'Parent workspace ID', required: true },
      projectId: { type: 'string', description: 'Sub-project ID', required: true },
      title: { type: 'string', description: 'Updated title' },
      summary: { type: 'string', description: 'Updated summary' },
      visibility: { type: 'string', description: 'private | public | team' },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const read = await toolRegistry.executeTool('project.read', params);
      if (!read.success) return read;
      const doc = await ProjectsService.updateProject(String(params.projectId), params as any);
      return { success: true, data: doc };
    },
  });

  toolRegistry.register({
    id: 'project.delete',
    domain: 'project',
    action: 'delete',
    name: 'Delete Workspace Project',
    description: 'Delete a nested project from a workspace.',
    parameters: {
      workspaceId: { type: 'string', description: 'Parent workspace ID', required: true },
      projectId: { type: 'string', description: 'Sub-project ID', required: true },
    },
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const read = await toolRegistry.executeTool('project.read', params);
      if (!read.success) return read;
      await ProjectsService.deleteProject(String(params.projectId));
      return { success: true, data: { deletedId: params.projectId } };
    },
  });

  toolRegistry.register({
    id: 'workspace.read',
    domain: 'workspace',
    action: 'read',
    name: 'Read Workspace',
    description: 'Get workspace details or list all workspaces.',
    parameters: {
      id: { type: 'string', description: 'Workspace ID' }},
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      if (params.id) {
        const doc = await ProjectsService.getProject(params.id);
        return { success: true, data: doc };
      }
      const list = await ProjectsService.listProjects(true);
      return { success: true, data: list.rows };
    }});

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
      visibility: { type: 'string', description: 'private | shared | public' }},
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const doc = await ProjectsService.updateProject(params.id, params as any);
      return { success: true, data: doc };
    }});

  toolRegistry.register({
    id: 'workspace.delete',
    domain: 'workspace',
    action: 'delete',
    name: 'Delete Workspace',
    description: 'Delete a workspace by ID.',
    parameters: {
      id: { type: 'string', description: 'Workspace ID', required: true }},
    execute: async (params) => {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      await ProjectsService.deleteProject(params.id);
      return { success: true, data: { deletedId: params.id } };
    }});

  toolRegistry.register({
    id: 'workspace.search',
    domain: 'workspace',
    action: 'search',
    name: 'Search Workspace Sub-objects',
    description: 'Search sub-objects attached to a workspace.',
    parameters: {
      query: { type: 'string', description: 'Search term', required: true },
      workspaceId: { type: 'string', description: 'Workspace ID' }},
    execute: async (params) => {
      const { getSessionProjectsList } = await import('@/lib/projects/projects-cache');
      const list = getSessionProjectsList() || [];
      const term = String(params.query || '').toLowerCase();
      const filtered = list.filter((w) => w.title?.toLowerCase().includes(term) || w.summary?.toLowerCase().includes(term));
      return { success: true, data: filtered };
    }});

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
      isPublic: { type: 'boolean', description: 'Public access toggle' }},
    execute: async (params) => {
      if (Array.isArray(params.tags) && params.tags.length > 0) {
        try {
          const { createTag, listTags } = await import('@/lib/appwrite/note');
          const existing = await listTags().catch(() => ({ rows: [] as any[] }));
          const existingNames = new Set((existing.rows || []).map((t: any) => (t.name || '').toLowerCase()));
          for (const rawTag of params.tags) {
            const tName = String(rawTag || '').trim();
            if (tName && !existingNames.has(tName.toLowerCase()) && !tName.startsWith('workspace:') && !tName.startsWith('project:')) {
              await createTag({ name: tName, color: '#A855F7', description: '' }).catch(() => null);
              existingNames.add(tName.toLowerCase());
            }
          }
        } catch {}
      }
      const { createNote } = await import('@/lib/appwrite/note');
      const cleanTags = Array.isArray(params.tags)
        ? params.tags.map((t: any) => String(t || '').trim()).filter((t: string) => t && !t.startsWith('workspace:') && !t.startsWith('project:'))
        : undefined;
      const note = await createNote({ ...(params as any), tags: cleanTags });
      return { success: true, data: note };
    }});

  toolRegistry.register({
    id: 'objects.idea.read',
    domain: 'idea',
    action: 'read',
    name: 'Read Idea (Note)',
    description: 'Read an idea by ID or list user ideas.',
    parameters: {
      id: { type: 'string', description: 'Note ID' }},
    execute: async (params) => {
      const { getNote, listNotes } = await import('@/lib/appwrite/note');
      if (params.id) {
        const note = await getNote(params.id);
        return { success: true, data: note };
      }
      const res = await listNotes();
      return { success: true, data: res.rows };
    }});

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
      tags: { type: 'array', description: 'Updated tag array' }},
    execute: async (params) => {
      if (Array.isArray(params.tags) && params.tags.length > 0) {
        try {
          const { createTag, listTags } = await import('@/lib/appwrite/note');
          const existing = await listTags().catch(() => ({ rows: [] as any[] }));
          const existingNames = new Set((existing.rows || []).map((t: any) => (t.name || '').toLowerCase()));
          for (const rawTag of params.tags) {
            const tName = String(rawTag || '').trim();
            if (tName && !existingNames.has(tName.toLowerCase()) && !tName.startsWith('workspace:') && !tName.startsWith('project:')) {
              await createTag({ name: tName, color: '#A855F7', description: '' }).catch(() => null);
              existingNames.add(tName.toLowerCase());
            }
          }
        } catch {}
      }
      const { updateNote } = await import('@/lib/appwrite/note');
      const cleanTags = Array.isArray(params.tags)
        ? params.tags.map((t: any) => String(t || '').trim()).filter((t: string) => t && !t.startsWith('workspace:') && !t.startsWith('project:'))
        : undefined;
      const note = await updateNote(params.id, { ...(params as any), tags: cleanTags });
      return { success: true, data: note };
    }});

  toolRegistry.register({
    id: 'objects.idea.delete',
    domain: 'idea',
    action: 'delete',
    name: 'Delete Idea (Note)',
    description: 'Delete an idea note by ID.',
    parameters: {
      id: { type: 'string', description: 'Note ID', required: true }},
    execute: async (params) => {
      const { deleteNote } = await import('@/lib/appwrite/note');
      await deleteNote(params.id);
      return { success: true, data: { deletedId: params.id } };
    }});

  toolRegistry.register({
    id: 'objects.idea.search',
    domain: 'idea',
    action: 'search',
    name: 'Search Ideas',
    description: 'Search ideas by keyword or tag.',
    parameters: {
      query: { type: 'string', description: 'Search term', required: true }},
    execute: async (params) => {
      const { listNotes } = await import('@/lib/appwrite/note');
      const res = await listNotes();
      const term = String(params.query || '').toLowerCase();
      const matched = (res.rows || []).filter(
        (n: any) => n.title?.toLowerCase().includes(term) || n.content?.toLowerCase().includes(term)
      );
      return { success: true, data: matched };
    }});

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
      tags: { type: 'array', description: 'Tag names array' }},
    execute: async (params) => {
      if (Array.isArray(params.tags) && params.tags.length > 0) {
        try {
          const { createTag, listTags } = await import('@/lib/appwrite/note');
          const existing = await listTags().catch(() => ({ rows: [] as any[] }));
          const existingNames = new Set((existing.rows || []).map((t: any) => (t.name || '').toLowerCase()));
          for (const rawTag of params.tags) {
            const tName = String(rawTag || '').trim();
            if (tName && !existingNames.has(tName.toLowerCase()) && !tName.startsWith('workspace:') && !tName.startsWith('project:')) {
              await createTag({ name: tName, color: '#A855F7', description: '' }).catch(() => null);
              existingNames.add(tName.toLowerCase());
            }
          }
        } catch {}
      }
      const { tasks } = await import('@/lib/kylrixflow');
      const cleanTags = Array.isArray(params.tags)
        ? params.tags.map((t: any) => String(t || '').trim()).filter((t: string) => t && !t.startsWith('workspace:') && !t.startsWith('project:'))
        : undefined;
      const task = await tasks.create({ ...(params as any), tags: cleanTags });
      return { success: true, data: task };
    }});

  toolRegistry.register({
    id: 'objects.goal.read',
    domain: 'goal',
    action: 'read',
    name: 'Read Goal/Task',
    description: 'Fetch goal details or list tasks.',
    parameters: {
      id: { type: 'string', description: 'Goal ID' }},
    execute: async (params) => {
      const { tasks } = await import('@/lib/kylrixflow');
      if (params.id) {
        const item = await tasks.get(params.id).catch(() => null);
        return { success: true, data: item };
      }
      const list = await tasks.list();
      return { success: true, data: list.rows };
    }});

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
      title: { type: 'string', description: 'New title' }},
    execute: async (params) => {
      const { tasks } = await import('@/lib/kylrixflow');
      const { id, ...updates } = params;
      const updated = await tasks.update(id, updates as any);
      return { success: true, data: updated };
    }});

  toolRegistry.register({
    id: 'objects.goal.delete',
    domain: 'goal',
    action: 'delete',
    name: 'Delete Goal/Task',
    description: 'Remove a task permanently.',
    parameters: {
      id: { type: 'string', description: 'Goal ID', required: true }},
    execute: async (params) => {
      const { tasks } = await import('@/lib/kylrixflow');
      await tasks.delete(params.id);
      return { success: true, data: { deletedId: params.id } };
    }});

  toolRegistry.register({
    id: 'objects.goal.search',
    domain: 'goal',
    action: 'search',
    name: 'Search Goals',
    description: 'Search goals by title or description.',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true }},
    execute: async (params) => {
      const { listFlowTasks } = await import('@/lib/appwrite/note');
      const res = await listFlowTasks();
      const term = String(params.query || '').toLowerCase();
      const matched = res.rows.filter(
        (t: any) => t.title?.toLowerCase().includes(term) || t.description?.toLowerCase().includes(term)
      );
      return { success: true, data: matched };
    }});

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
      username: { type: 'string', description: 'Username or login ID' }},
    execute: async (params) => {
      const { VaultService } = await import('@/lib/appwrite/vault');
      const created = await VaultService.createCredential(params as any);
      return { success: true, data: redactPIIAndSensitiveFields(created) };
    }});

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
    }});

  toolRegistry.register({
    id: 'objects.vault.secret.delete',
    domain: 'vault',
    action: 'delete',
    name: 'Delete Vault Secret',
    description: 'Delete a credential secret by ID.',
    parameters: {
      id: { type: 'string', description: 'Secret ID', required: true }},
    execute: async (params) => {
      const { VaultService } = await import('@/lib/appwrite/vault');
      await VaultService.deleteCredential(params.id);
      return { success: true, data: { deletedId: params.id } };
    }});

  toolRegistry.register({
    id: 'objects.vault.secret.search',
    domain: 'vault',
    action: 'search',
    name: 'Search Vault Secrets',
    description: 'Search stored secrets by title/service name.',
    isSecure: true,
    parameters: {
      query: { type: 'string', description: 'Search term', required: true }},
    execute: async (params) => {
      const { listKeepCredentials } = await import('@/lib/appwrite/note');
      const res = await listKeepCredentials();
      const term = String(params.query || '').toLowerCase();
      const matched = res.rows.filter((c: any) => c.name?.toLowerCase().includes(term));
      return { success: true, data: redactPIIAndSensitiveFields(matched) };
    }});

  // 5. Tags & Crosslinks
  toolRegistry.register({
    id: 'objects.tag.create',
    domain: 'tag',
    action: 'create',
    name: 'Create Tag',
    description: 'Create a crosslink tag.',
    parameters: {
      name: { type: 'string', description: 'Tag name', required: true },
      color: { type: 'string', description: 'HEX color string' }},
    execute: async (params) => {
      const { createTag } = await import('@/lib/appwrite/note');
      const tag = await createTag(params as any);
      return { success: true, data: tag };
    }});

  toolRegistry.register({
    id: 'objects.tag.search',
    domain: 'tag',
    action: 'search',
    name: 'Search Tags',
    description: 'Find tags by name.',
    parameters: {
      query: { type: 'string', description: 'Search term', required: true }},
    execute: async (params) => {
      const { listTags } = await import('@/lib/appwrite/note');
      const res = await listTags();
      const term = String(params.query || '').toLowerCase();
      const matched = res.rows.filter((t: any) => t.name?.toLowerCase().includes(term));
      return { success: true, data: matched };
    }});

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
    }});

  toolRegistry.register({
    id: 'user.settings.update',
    domain: 'user',
    action: 'update',
    name: 'Update User Settings',
    description: 'Update user account preferences.',
    parameters: {
      key: { type: 'string', description: 'Preference key', required: true },
      value: { type: 'string', description: 'Preference value', required: true }},
    execute: async (params) => {
      const { account } = await import('@/lib/appwrite/client');
      const current = await account.getPrefs();
      const updated = await account.updatePrefs({ ...current, [params.key]: params.value });
      return { success: true, data: updated };
    }});

  // 7. UI Navigation (semantic — route resolved client-side)
  toolRegistry.register({
    id: 'ui.navigate',
    domain: 'workspace',
    action: 'custom',
    name: 'Navigate UI',
    description: 'Navigate to a semantic UI destination by target id or route.',
    parameters: {
      target: { type: 'string', description: 'Semantic destination id e.g. settings.passkeys' },
      route: { type: 'string', description: 'Direct route fallback' }},
    execute: async (params) => {
      const { resolveUiDestination } = await import('@/lib/agentic/ui-catalog');
      const target = String(params.target || '');
      const route =
        String(params.route || '') ||
        (target ? resolveUiDestination(target)?.route : '') ||
        '';
      if (!route) return { success: false, error: 'Could not resolve navigation target.' };
      return { success: true, data: { route, target: target || null } };
    }});

  // 8. Forms
  toolRegistry.register({
    id: 'objects.form.read',
    domain: 'form',
    action: 'read',
    name: 'Read Form',
    description: 'Load form schema by id.',
    parameters: { id: { type: 'string', description: 'Form ID', required: true } },
    execute: async (params) => {
      const { FormsService } = await import('@/lib/services/forms');
      const form = await FormsService.getForm(params.id);
      return { success: true, data: form };
    }});

  toolRegistry.register({
    id: 'objects.form.submit',
    domain: 'form',
    action: 'create',
    name: 'Submit Form Response',
    description: 'Submit structured answers to a published form.',
    parameters: {
      formId: { type: 'string', description: 'Form ID', required: true },
      payload: { type: 'object', description: 'Field answers JSON', required: true }},
    execute: async (params) => {
      const { FormsService } = await import('@/lib/services/forms');
      const submission = await FormsService.submitForm(
        params.formId,
        JSON.stringify(params.payload));
      return { success: true, data: submission };
    }});

  toolRegistry.register({
    id: 'search.ecosystem',
    domain: 'workspace',
    action: 'search',
    name: 'Search Ecosystem',
    description: 'Cross-domain intelligent search.',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true }},
    execute: async (params, context) => {
      const { executeEcosystemSearch } = await import('@/lib/agentic/search-engine');
      const result = await executeEcosystemSearch(String(params.query || ''), {
        userId: context?.userId});
      return { success: true, data: result };
    }});

  toolRegistry.register({
    id: 'developer.pat.create',
    domain: 'developer',
    action: 'create',
    name: 'Create personal access token',
    description: 'Mint a PAT with selected scopes for the current user.',
    isSecure: true,
    parameters: {
      name: { type: 'string', description: 'Token label', required: true },
      scopes: { type: 'array', description: 'Permission scopes', required: true },
    },
    execute: async (params, context) => {
      if (!context?.userId) return { success: false, error: 'Unauthorized' };
      const { PatService } = await import('@/lib/services/pats');
      const created = await PatService.create({
        userId: context.userId,
        name: String(params.name || ''),
        scopes: params.scopes,
      });
      return { success: true, data: { pat: created.pat, token: created.token } };
    },
  });

  toolRegistry.register({
    id: 'developer.pat.list',
    domain: 'developer',
    action: 'read',
    name: 'List personal access tokens',
    description: 'List PATs for the current user (no secrets).',
    parameters: {},
    execute: async (_params, context) => {
      if (!context?.userId) return { success: false, error: 'Unauthorized' };
      const { PatService } = await import('@/lib/services/pats');
      const data = await PatService.listForUser(context.userId);
      return { success: true, data };
    },
  });

  toolRegistry.register({
    id: 'developer.pat.revoke',
    domain: 'developer',
    action: 'delete',
    name: 'Revoke personal access token',
    description: 'Revoke a PAT by id.',
    isSecure: true,
    parameters: {
      patId: { type: 'string', description: 'PAT row id', required: true },
    },
    execute: async (params, context) => {
      if (!context?.userId) return { success: false, error: 'Unauthorized' };
      const { PatService } = await import('@/lib/services/pats');
      await PatService.revoke({
        patId: String(params.patId || ''),
        userId: context.userId,
      });
      return { success: true };
    },
  });

  // --- Markdown / Math Mode layers (flows + agent tools) ---
  toolRegistry.register({
    id: 'markdown.transform',
    domain: 'markdown',
    action: 'custom',
    name: 'Transform markdown',
    description: 'Run the markdown post-process pipeline (math, charts, optional html preview).',
    parameters: {
      content: { type: 'string', description: 'Markdown source', required: true },
      math: { type: 'boolean', description: 'Enable math layers' },
      charts: { type: 'boolean', description: 'Enable chart/graph layers' },
      htmlPreview: { type: 'boolean', description: 'Enable html-preview fences (off by default)' },
    },
    execute: async (params) => {
      const { renderMarkdownHtml } = await import('@/lib/markdown/render');
      const html = renderMarkdownHtml(String(params.content || ''), {
        features: {
          math: params.math !== false,
          charts: params.charts !== false,
          htmlPreview: !!params.htmlPreview,
        },
      });
      return { success: true, data: { html } };
    },
  });

  toolRegistry.register({
    id: 'markdown.math.render',
    domain: 'markdown',
    action: 'custom',
    name: 'Render math',
    description: 'Render LaTeX / TeX to HTML with KaTeX.',
    parameters: {
      tex: { type: 'string', description: 'TeX source', required: true },
      display: { type: 'boolean', description: 'Display (block) mode' },
    },
    execute: async (params) => {
      const { renderKatex } = await import('@/lib/markdown/math');
      const html = renderKatex(String(params.tex || ''), !!params.display);
      return { success: true, data: { html } };
    },
  });

  toolRegistry.register({
    id: 'math.solve',
    domain: 'math',
    action: 'custom',
    name: 'Solve equation',
    description: 'Solve a simple equation or evaluate an expression.',
    parameters: {
      equation: { type: 'string', description: 'e.g. 2x + 5 = 15', required: true },
    },
    execute: async (params) => {
      const { solveEquation } = await import('@/lib/markdown/expr');
      const result = solveEquation(String(params.equation || ''));
      if (!result.ok) return { success: false, error: result.error };
      return { success: true, data: result };
    },
  });

  toolRegistry.register({
    id: 'markdown.chart.render',
    domain: 'markdown',
    action: 'custom',
    name: 'Render chart or graph',
    description: 'Render a chart or function graph block to SVG. (Charts layer removed — returns placeholder.)',
    parameters: {
      kind: { type: 'string', description: 'chart | graph', required: true },
      body: { type: 'string', description: 'Block body (key: value lines)', required: true },
    },
    execute: async (params) => {
      const kind = String(params.kind || 'chart').toLowerCase();
      const body = String(params.body || '');
      return { success: true, data: { html: `<pre>${kind}: ${body.slice(0, 200)}</pre>` } };
    },
  });

  toolRegistry.register({
    id: 'markdown.html.preview',
    domain: 'markdown',
    action: 'custom',
    name: 'HTML preview block',
    description:
      'Render a sandboxed html-preview fence. For future in-note plugins — keep off in public notes.',
    parameters: {
      content: { type: 'string', description: 'Markdown with ```html-preview fences', required: true },
    },
    execute: async (params) => {
      const { renderMarkdownHtml } = await import('@/lib/markdown/render');
      const html = renderMarkdownHtml(String(params.content || ''), {
        features: { math: false, charts: false, htmlPreview: true },
      });
      return { success: true, data: { html } };
    },
  });
}

// Self-register core tools on module evaluation
registerCoreTools();

export { toolRegistry };
export type { EcosystemToolDefinition, ToolParameterSpec };
