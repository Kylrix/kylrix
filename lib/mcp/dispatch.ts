import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';

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

  list_workspaces: (actor, args) => ApiResources.listWorkspaces(actor, args.limit || 25),
  get_workspace: (actor, args) => ApiResources.getWorkspace(actor, String(args.id)),
  create_workspace: (actor, args) => ApiResources.createWorkspace(actor, args),
  update_workspace: (actor, args) => ApiResources.updateWorkspace(actor, String(args.id), args),
  delete_workspace: (actor, args) => ApiResources.deleteWorkspace(actor, String(args.id)),
  list_workspace_collaborators: (actor, args) =>
    ApiResources.listWorkspaceCollaborators(actor, String(args.workspaceId)),
  add_workspace_collaborator: (actor, args) =>
    ApiResources.addWorkspaceCollaborator(actor, String(args.workspaceId), args),

  list_notes: (actor, args) =>
    ApiResources.listNotes(actor, args.limit || 25, { workspaceId: args.workspaceId || null }),
  get_note: (actor, args) => ApiResources.getNote(actor, String(args.id)),
  create_note: (actor, args) => ApiResources.createNote(actor, args),
  update_note: (actor, args) => ApiResources.updateNote(actor, String(args.id), args),
  delete_note: (actor, args) => ApiResources.deleteNote(actor, String(args.id)),

  list_goals: async (actor, args) => ({
    items: await ApiResources.listGoals(actor, args.limit || 25, {
      workspaceId: args.workspaceId || null,
      status: args.status || null,
    }),
  }),
  get_goal: (actor, args) => ApiResources.getGoal(actor, String(args.id)),
  create_goal: (actor, args) => ApiResources.createGoal(actor, args),
  update_goal: (actor, args) => ApiResources.updateGoal(actor, String(args.id), args),
  delete_goal: (actor, args) => ApiResources.deleteGoal(actor, String(args.id)),

  list_events: (actor, args) =>
    ApiResources.listEvents(actor, args.limit || 25, { workspaceId: args.workspaceId || null }),
  get_event: (actor, args) => ApiResources.getEvent(actor, String(args.id)),
  create_event: (actor, args) => ApiResources.createEvent(actor, args),
  update_event: (actor, args) => ApiResources.updateEvent(actor, String(args.id), args),
  delete_event: (actor, args) => ApiResources.deleteEvent(actor, String(args.id)),

  list_forms: (actor, args) =>
    ApiResources.listForms(actor, args.limit || 25, { workspaceId: args.workspaceId || null }),
  get_form: (actor, args) => ApiResources.getForm(actor, String(args.id)),
  create_form: (actor, args) => ApiResources.createForm(actor, args),
  delete_form: (actor, args) => ApiResources.deleteForm(actor, String(args.id)),

  list_chats: (actor, args) => ApiResources.listChats(actor, args.limit || 25),
  get_chat: (actor, args) => ApiResources.getChat(actor, String(args.id)),
  list_chat_messages: (actor, args) =>
    ApiResources.listChatMessages(actor, String(args.conversationId), args.limit || 50),
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

  list_flows: (actor, args) => ApiResources.listFlows(actor, args.limit || 25),
  get_flow: (actor, args) => ApiResources.getFlow(actor, String(args.id)),
  create_flow: (actor, args) => ApiResources.createFlow(actor, args),
  delete_flow: (actor, args) => ApiResources.deleteFlow(actor, String(args.id)),

  list_tags: (actor, args) => ApiResources.listTags(actor, args.limit || 50),
  create_tag: (actor, args) => ApiResources.createTag(actor, args),
  delete_tag: (actor, args) => ApiResources.deleteTag(actor, String(args.id)),

  list_moments: (actor, args) =>
    ApiResources.listMoments(actor, args.limit || 25, { mine: args.mine }),
  get_moment: (actor, args) => ApiResources.getMoment(actor, String(args.id)),
  create_moment: (actor, args) => ApiResources.createMoment(actor, args),
  list_moment_comments: (actor, args) =>
    ApiResources.listMomentComments(actor, String(args.momentId), args.limit || 50),
  create_moment_comment: (actor, args) =>
    ApiResources.createMomentComment(actor, String(args.momentId), {
      text: args.content || args.text,
    }),

  list_thread_messages: (actor, args) =>
    ApiResources.listThreadMessages(actor, String(args.threadId), args.limit || 50),
  create_thread_message: (actor, args) =>
    ApiResources.createThreadMessage(actor, String(args.threadId), { content: args.content }),

  list_agent_sessions: (actor, args) =>
    ApiResources.listAgentSessions(actor, args.limit || 25, {
      workspaceId: args.workspaceId,
      harness: args.harness,
    }),
  get_agent_session: (actor, args) => ApiResources.getAgentSession(actor, String(args.id)),
  create_agent_session: (actor, args) => ApiResources.createHarnessSession(actor, args),

  list_trash: (actor, args) =>
    ApiResources.listTrash(actor, args.limit || 50, { kind: args.kind }),
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
  return handler(actor, args);
}
