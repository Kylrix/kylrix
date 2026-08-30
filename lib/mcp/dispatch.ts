import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';
import { mcpListResult } from '@/sdk/contracts';
import { assertActorFeatureAccess } from '@/lib/tools/gate';
import { featureIdForMcpTool } from '@/lib/tools/mcp-features';

type McpToolHandler = (actor: ApiActor, args: Record<string, any>) => Promise<any>;

export const mcpToolHandlers: Record<string, McpToolHandler> = {
  get_my_profile: (actor) => ApiResources.me(actor),
  get_token_info: (actor) => ApiResources.tokenMe(actor),
  list_available_scopes: (actor) => ApiResources.tokenScopeCatalog(actor),
  refresh_token_scopes: (actor, args) =>
    ApiResources.tokenUpdateScopes(
      actor,
      { scopes: args.scopes, mode: args.mode || 'grant' },
      args.mode === 'replace' ? 'replace' : 'grant',
    ),

  list_workspaces: async (actor, args) =>
    mcpListResult(await ApiResources.listWorkspaces(actor, args.limit || 25)),
  get_workspace: (actor, args) => ApiResources.getWorkspace(actor, String(args.id)),
  create_workspace: (actor, args) => ApiResources.createWorkspace(actor, args),
  update_workspace: (actor, args) => ApiResources.updateWorkspace(actor, String(args.id), args),
  delete_workspace: (actor, args) => ApiResources.deleteWorkspace(actor, String(args.id)),
  list_workspace_collaborators: async (actor, args) =>
    mcpListResult(await ApiResources.listWorkspaceCollaborators(actor, String(args.workspaceId))),
  add_workspace_collaborator: (actor, args) =>
    ApiResources.addWorkspaceCollaborator(actor, String(args.workspaceId), args),

  list_notes: async (actor, args) =>
    mcpListResult(
      await ApiResources.listNotes(actor, args.limit || 25, { workspaceId: args.workspaceId || null }),
    ),
  get_note: (actor, args) => ApiResources.getNote(actor, String(args.id)),
  create_note: (actor, args) => ApiResources.createNote(actor, args),
  update_note: (actor, args) => ApiResources.updateNote(actor, String(args.id), args),
  delete_note: (actor, args) => ApiResources.deleteNote(actor, String(args.id)),

  list_goals: async (actor, args) =>
    mcpListResult(
      await ApiResources.listGoals(actor, args.limit || 25, {
        workspaceId: args.workspaceId || null,
        status: args.status || null,
      }),
    ),
  get_goal: (actor, args) => ApiResources.getGoal(actor, String(args.id)),
  create_goal: (actor, args) => ApiResources.createGoal(actor, args),
  update_goal: (actor, args) => ApiResources.updateGoal(actor, String(args.id), args),
  delete_goal: (actor, args) => ApiResources.deleteGoal(actor, String(args.id)),

  list_events: async (actor, args) =>
    mcpListResult(
      await ApiResources.listEvents(actor, args.limit || 25, { workspaceId: args.workspaceId || null }),
    ),
  get_event: (actor, args) => ApiResources.getEvent(actor, String(args.id)),
  create_event: (actor, args) => ApiResources.createEvent(actor, args),
  update_event: (actor, args) => ApiResources.updateEvent(actor, String(args.id), args),
  delete_event: (actor, args) => ApiResources.deleteEvent(actor, String(args.id)),

  list_forms: async (actor, args) =>
    mcpListResult(
      await ApiResources.listForms(actor, args.limit || 25, { workspaceId: args.workspaceId || null }),
    ),
  get_form: (actor, args) => ApiResources.getForm(actor, String(args.id)),
  create_form: (actor, args) => ApiResources.createForm(actor, args),
  delete_form: (actor, args) => ApiResources.deleteForm(actor, String(args.id)),

  list_chats: async (actor, args) => mcpListResult(await ApiResources.listChats(actor, args.limit || 25)),
  get_chat: (actor, args) => ApiResources.getChat(actor, String(args.id)),
  list_chat_messages: async (actor, args) =>
    mcpListResult(
      await ApiResources.listChatMessages(actor, String(args.conversationId), args.limit || 50),
    ),
  send_chat_message: async (actor, args) => {
    let convId = args.conversationId;
    if (!convId && args.participantId) {
      const conv = await ApiResources.createChat(actor, { participantId: args.participantId });
      convId = conv.id;
    }
    if (!convId) {
      throw new Error('Either conversationId or participantId is required to send a chat message');
    }
    return ApiResources.sendChatMessage(actor, convId, { content: args.content });
  },

  list_flows: async (actor, args) => mcpListResult(await ApiResources.listFlows(actor, args.limit || 25)),
  get_flow: (actor, args) => ApiResources.getFlow(actor, String(args.id)),
  create_flow: (actor, args) => ApiResources.createFlow(actor, args),
  delete_flow: (actor, args) => ApiResources.deleteFlow(actor, String(args.id)),

  list_tags: async (actor, args) => mcpListResult(await ApiResources.listTags(actor, args.limit || 50)),
  create_tag: (actor, args) => ApiResources.createTag(actor, args),
  delete_tag: (actor, args) => ApiResources.deleteTag(actor, String(args.id)),

  list_moments: async (actor, args) =>
    mcpListResult(await ApiResources.listMoments(actor, args.limit || 25, { mine: args.mine })),
  get_moment: (actor, args) => ApiResources.getMoment(actor, String(args.id)),
  create_moment: (actor, args) => ApiResources.createMoment(actor, args),
  list_moment_comments: async (actor, args) =>
    mcpListResult(
      await ApiResources.listMomentComments(actor, String(args.momentId), args.limit || 50),
    ),
  create_moment_comment: (actor, args) =>
    ApiResources.createMomentComment(actor, String(args.momentId), {
      text: args.content || args.text,
    }),

  list_thread_messages: async (actor, args) =>
    mcpListResult(
      await ApiResources.listThreadMessages(actor, String(args.threadId), args.limit || 50),
    ),
  create_thread_message: (actor, args) =>
    ApiResources.createThreadMessage(actor, String(args.threadId), { content: args.content }),
  list_threads: async (actor, args) =>
    mcpListResult(
      await ApiResources.listThreads(actor, args.limit || 25, {
        parentKind: args.parent_kind || args.parentKind,
        parentId: args.parent_id || args.parentId,
      }),
    ),
  ensure_thread: (actor, args) =>
    ApiResources.ensureThread(actor, {
      parent_kind: args.parent_kind || args.parentKind,
      parent_id: args.parent_id || args.parentId,
      channel: args.channel,
      title: args.title,
    }),

  list_agent_sessions: async (actor, args) =>
    mcpListResult(
      await ApiResources.listAgentSessions(actor, args.limit || 25, {
        workspaceId: args.workspaceId,
        harness: args.harness,
      }),
    ),
  get_agent_session: (actor, args) => ApiResources.getAgentSession(actor, String(args.id)),
  create_agent_session: (actor, args) => ApiResources.createHarnessSession(actor, args),

  list_trash: async (actor, args) =>
    mcpListResult(await ApiResources.listTrash(actor, args.limit || 50, { kind: args.kind })),
  restore_trash: (actor, args) =>
    ApiResources.restoreTrash(actor, { id: args.id, kind: args.kind }),
  purge_trash: (actor, args) =>
    ApiResources.purgeTrash(actor, { id: args.id, kind: args.kind }),
};

export async function executeMcpTool(
  actor: ApiActor,
  name: string,
  args: Record<string, any> = {},
): Promise<any> {
  const handler = mcpToolHandlers[name];
  if (!handler) throw new Error(`Unknown MCP tool: ${name}`);

  const featureId = featureIdForMcpTool(name);
  if (featureId && actor.userId) {
    await assertActorFeatureAccess(actor.userId, featureId);
  }

  return handler(actor, args);
}
