/**
 * Client-side agentic tool executor — single path for UI + object mutations.
 */

import { toast } from 'react-hot-toast';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { resolveUiDestination } from './ui-catalog';
import { executeEcosystemSearch } from './search-engine';
import { AgenticPreviewPartition } from './preview-partition';
import { hitsToRefs, serializeBlocksForToolSummary, type AgenticMessageBlock } from './message-blocks';

export interface AgenticToolCallInput {
  toolKey: string;
  specifier?: string;
  subSpecifier?: string;
  args?: Record<string, unknown>;
}

export interface AgenticExecutionContext {
  user?: { $id?: string } | null;
  router: AppRouterInstance;
  onClose?: () => void;
  setActiveWorkspaceId?: (id: string) => void;
  tasks?: any[];
  notes?: any[];
  setCachedData?: (key: string, data: unknown) => void;
  pushLiveNote?: (note: any, opts?: { pending?: boolean }) => void;
  removeNote?: (id: string) => void;
  registerComposeSession?: (id: string) => void;
  unregisterComposeSession?: (id: string) => void;
  migrateDraftNoteId?: (from: string, to: string) => void;
  addTask?: (task: any) => Promise<any>;
  updateTask?: (id: string, patch: any) => Promise<void>;
  deleteTask?: (id: string) => Promise<void>;
  appendMessage?: (
    role: 'assistant' | 'user',
    content: string,
    opts?: { blocks?: AgenticMessageBlock[] }) => void;
  openDrawer?: (type: string, payload?: Record<string, unknown>) => void;
  openDetailOverlay?: (kind: string, id: string) => void;
  openWalletWithIntent?: (intent: any) => void;
  recordSessionObject?: (payload: {
    objectId: string;
    objectType: string;
    title?: string | null;
    toolKey: string;
  }) => Promise<void>;
}

export interface AgenticExecutionResult {
  success: boolean;
  summary: string;
  error?: string;
  skipToast?: boolean;
  messageBlocks?: AgenticMessageBlock[];
}

async function executeAgenticToolCall(
  call: AgenticToolCallInput,
  ctx: AgenticExecutionContext): Promise<AgenticExecutionResult> {
  const key = call.toolKey;
  const args = call.args || {};

  try {
    // ── Navigation ──────────────────────────────────────────────
    if (key === 'navigate_workspace' || key === 'ui.navigate') {
      const target = String(args.target || call.specifier || '').trim();
      let route = String(args.route || '').trim();
      if (target && !route) {
        const dest = resolveUiDestination(target);
        if (!dest) {
          return { success: false, summary: '', error: `Unknown navigation target: ${target}` };
        }
        route = dest.route;
        if (dest.drawer && ctx.openDrawer) {
          ctx.onClose?.();
          ctx.router.push(route.split('#')[0]);
          ctx.openDrawer(dest.drawer, dest.drawerPayload);
          return { success: true, summary: `Opened ${dest.label}` };
        }
      }
      if (!route) {
        return { success: false, summary: '', error: 'Navigation requires target or route' };
      }
      ctx.onClose?.();
      ctx.router.push(route);
      return { success: true, summary: `Navigate: ${route}` };
    }

    // ── Workspace Context Switch ────────────────────────────────
    if (key === 'switch_workspace') {
      const workspaceId = String(args.workspaceId || call.specifier || '').trim();
      if (!workspaceId) {
        return { success: false, summary: '', error: 'Workspace ID required for switch_workspace' };
      }
      ctx.setActiveWorkspaceId?.(workspaceId);
      const title = String(args.workspaceTitle || workspaceId);
      return { success: true, summary: `Switched active workspace to "${title}"` };
    }

    // ── Search ──────────────────────────────────────────────────
    if (key === 'search_ecosystem' || key === 'objects.search') {
      const query = String(args.query || call.specifier || '').trim();
      const { plan, hits } = await executeEcosystemSearch(query, {
        userId: ctx.user?.$id,
        limit: Number(args.limit) || 15,
        localNotes: ctx.notes,
        localTasks: ctx.tasks});
      const blocks: AgenticMessageBlock[] = [
        {
          type: 'ecosystem_hits',
          query,
          plan: {
            reasoning: plan.reasoning,
            temporal: plan.temporal,
            domains: plan.domains},
          hits: hitsToRefs(hits)},
      ];
      return {
        success: true,
        summary: serializeBlocksForToolSummary(blocks),
        skipToast: true,
        messageBlocks: blocks};
    }

    // ── Drawers / UI chrome ─────────────────────────────────────
    if (key === 'ui.open_drawer' || key === 'create_or_select_agent' || key === 'open_wallet_funding') {
      const drawerType =
        key === 'open_wallet_funding'
          ? 'wallet'
          : key === 'create_or_select_agent'
            ? 'agent-create'
            : String(args.drawer || 'agent-create');
      ctx.openDrawer?.(drawerType, {
        name: args.name,
        goal: args.goal,
        amount: args.amount,
        chainId: args.chainId,
        intentId: args.intentId,
        agentId: args.agentId || call.specifier});
      ctx.onClose?.();
      return { success: true, summary: `Opened ${drawerType} drawer` };
    }

    if (key === 'ui.preview.open' || key === 'open_preview') {
      const previewId = String(args.previewId || call.specifier || `preview_${Date.now()}`);
      await AgenticPreviewPartition.set(previewId, String(args.kind || 'generic'), args.payload || args);
      ctx.openDrawer?.('agentic-preview', {
        previewId,
        kind: args.kind,
        title: args.title || 'Preview'});
      return { success: true, summary: 'Opened preview drawer' };
    }

    // ── Ideas ───────────────────────────────────────────────────
    if (key === 'create_note' || key === 'objects.idea.create') {
      const title = String(args.title || '').trim() || 'Untitled Idea';
      const content = String(args.content || '').trim();
      if (!content) return { success: false, summary: '', error: 'Missing content' };

      const tags = Array.isArray(args.tags) ? args.tags : args.tags ? [args.tags] : [];
      const isPublic = args.isPublic === true || args.isPublic === 'true';

      const { ID } = await import('appwrite');
      const { resolveNoteCardTitle } = await import('@/constants/noteTitle');
      const { markNotePersistedRemote } = await import('@/lib/notes/compose-draft-registry');
      const { isValidAppwriteRowId } = await import('@/lib/utils/resource-ids');
      const draftId = ID.unique();
      const now = new Date().toISOString();
      const draftNote = {
        $id: draftId,
        title: resolveNoteCardTitle(title, content) || title,
        content,
        tags,
        format: 'text',
        isPublic,
        isGuest: isPublic,
        userId: ctx.user?.$id || '',
        $createdAt: now,
        $updatedAt: now,
        updatedAt: now};

      ctx.registerComposeSession?.(draftId);
      ctx.pushLiveNote?.(draftNote);

      const { createNote } = await import('@/lib/actions/client-ops');
      const saved = (await createNote({
        $id: isValidAppwriteRowId(draftId) ? draftId : undefined,
        title,
        content,
        tags,
        isPublic,
        isGuest: isPublic})) as any;

      markNotePersistedRemote(saved.$id);
      if (saved.$id && saved.$id !== draftId) ctx.migrateDraftNoteId?.(draftId, saved.$id);
      ctx.unregisterComposeSession?.(draftId);
      if (saved.$id) ctx.unregisterComposeSession?.(saved.$id);
      ctx.pushLiveNote?.(saved, { pending: false });

      const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
      autonomicSyncEngine.ack(saved.$id, saved.updatedAt || now);
      ctx.setCachedData?.(`note_${saved.$id}`, saved);

      await ctx.recordSessionObject?.({
        objectId: saved.$id,
        objectType: 'idea',
        title: saved.title || title,
        toolKey: key});
      return { success: true, summary: `Created idea: ${saved.title || title}` };
    }

    if ((key === 'update_note' || key === 'objects.idea.update') && (call.specifier || (args as any).id)) {
      const noteId = (call.specifier || (args as any).id) as string;
      const { updateNote } = await import('@/lib/actions/client-ops');
      const saved = await updateNote(noteId, {
        title: args.title as string | undefined,
        content: args.content as string | undefined,
        tags:
          args.tags !== undefined
            ? Array.isArray(args.tags)
              ? args.tags
              : [args.tags]
            : undefined,
        isPublic:
          args.isPublic !== undefined
            ? args.isPublic === true || args.isPublic === 'true'
            : undefined,
        isGuest:
          args.isPublic !== undefined
            ? args.isPublic === true || args.isPublic === 'true'
            : undefined});
      ctx.pushLiveNote?.(saved, { pending: false });
      const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
      autonomicSyncEngine.ack(saved.$id || noteId);
      await ctx.recordSessionObject?.({
        objectId: saved.$id || noteId,
        objectType: 'idea',
        title: (saved as any).title || (args.title as string) || null,
        toolKey: key});
      return {
        success: true,
        summary: `Updated idea: ${(saved as any).title || args.title || noteId}`};
    }

    if ((key === 'get_note' || key === 'objects.idea.read') && (call.specifier || (args as any).id)) {
      const nid = (call.specifier || (args as any).id) as string;
      const { getNote } = await import('@/lib/appwrite/note');
      const note = await getNote(nid);
      ctx.pushLiveNote?.(note, { pending: false });
      await ctx.recordSessionObject?.({
        objectId: note.$id,
        objectType: 'idea',
        title: note.title || null,
        toolKey: key});
      ctx.openDetailOverlay?.('idea', note.$id);
      const snippet = String(note.content || '').slice(0, 2200);
      const body = snippet ? `### ${note.title || 'Untitled'}\n\n${snippet}` : `Loaded Idea **"${note.title || 'Untitled'}"**.`;
      ctx.appendMessage?.('assistant', body, { blocks: [{ type: 'markdown', content: body }] });
      return { success: true, summary: `Loaded idea: "${note.title || 'Untitled'}"`, skipToast: true, messageBlocks: [{ type: 'markdown', content: body }] };
    }

    // ── Goals ───────────────────────────────────────────────────
    if (key === 'create_goal' || key === 'objects.goal.create') {
      const goalTitle = String(args.title || 'Untitled Goal');
      const goalDesc = String(args.description || `Goal: ${goalTitle}`);
      const created = await ctx.addTask?.({
        title: goalTitle,
        description: goalDesc,
        status: args.status || 'todo',
        priority: args.priority || 'medium',
        dueDate: args.dueDate ? new Date(String(args.dueDate)) : null,
        labels: [],
        subtasks: [],
        comments: [],
        attachments: [],
        reminders: [],
        timeEntries: [],
        assigneeIds: ctx.user?.$id ? [ctx.user.$id] : ['guest'],
        creatorId: ctx.user?.$id || 'guest',
        isArchived: false,
        isPinned: false,
        isAgentic: args.isAgentic !== false});
      const goalId = (created as any)?.id || (created as any)?.$id;
      if (goalId) {
        await ctx.recordSessionObject?.({
          objectId: String(goalId),
          objectType: 'goal',
          title: goalTitle,
          toolKey: key});
      }
      return { success: true, summary: `Created goal: ${goalTitle}` };
    }

    if (key === 'list_goals' || key === 'objects.goal.search') {
      const query = String(args.query || call.specifier || '.all').trim();
      const allTasks = ctx.tasks || [];
      const filtered =
        query === '.all' || !query
          ? allTasks.filter((t) => !t.isArchived)
          : allTasks.filter(
              (t) =>
                !t.isArchived &&
                (t.title?.toLowerCase().includes(query.toLowerCase()) ||
                  t.description?.toLowerCase().includes(query.toLowerCase())));
      const summaryList = filtered
        .slice(0, 15)
        .map(
          (t) =>
            `- **${t.title}** (${t.status || 'todo'}${t.priority ? `, ${t.priority}` : ''}) — ID: \`${t.id}\``)
        .join('\n');
      ctx.appendMessage?.(
        'assistant',
        `### Active Goals (${filtered.length})\n${summaryList || 'No matching goals found.'}`);
      return { success: true, summary: `Listed ${filtered.length} goals`, skipToast: true };
    }

    if ((key === 'update_goal' || key === 'objects.goal.update') && (call.specifier || (args as any).id)) {
      const gid = (call.specifier || (args as any).id) as string;
      await ctx.updateTask?.(gid, {
        title: args.title,
        status: args.status,
        priority: args.priority,
        dueDate: args.dueDate ? new Date(String(args.dueDate)) : undefined});
      return { success: true, summary: `Updated goal: ${gid}` };
    }

    // ── Projects ────────────────────────────────────────────────
    if (key === 'create_project' || key === 'objects.workspace.create') {
      const { ProjectsService } = await import('@/lib/appwrite/projects');
      const project = await ProjectsService.createProject({
        ownerId: ctx.user?.$id || 'guest',
        title: String(args.title || 'Untitled Project'),
        summary: String(args.summary || '')});
      if (project?.$id) {
        await ctx.recordSessionObject?.({
          objectId: project.$id,
          objectType: 'project',
          title: String(args.title || project.title || 'Untitled Project'),
          toolKey: key});
      }
      return {
        success: true,
        summary: `Created project: ${args.title || project?.title || 'Untitled Project'}`};
    }

    if (key === 'link_to_project' && call.specifier) {
      const objectType = String(args.objectType || 'note');
      const objectId = String(args.objectId || '').trim();
      if (!objectId) return { success: false, summary: '', error: 'Missing objectId' };
      const entityKind = objectType === 'goal' || objectType === 'task' ? 'task' : 'note';
      const { addObjectToProject } = await import('@/lib/actions/client-ops');
      await addObjectToProject(call.specifier, entityKind, objectId);
      await ctx.recordSessionObject?.({
        objectId,
        objectType: entityKind === 'task' ? 'goal' : 'idea',
        title: `Linked to project ${call.specifier}`,
        toolKey: key});
      return { success: true, summary: `Connected ${entityKind} to project` };
    }

    // ── Forms ───────────────────────────────────────────────────
    if (key === 'objects.form.read' && (call.specifier || args.formId)) {
      const formId = String(call.specifier || args.formId);
      const { FormsService } = await import('@/lib/services/forms');
      const form = await FormsService.getForm(formId);
      ctx.appendMessage?.(
        'assistant',
        `### Form: ${form.title}\nSchema fields: ${JSON.parse(form.schema || '[]').length}`);
      return { success: true, summary: `Loaded form ${form.title}`, skipToast: true };
    }

    if (key === 'objects.form.submit' || key === 'submit_form_response') {
      const formId = String(call.specifier || args.formId || '');
      const payload = args.payload || args.responses;
      if (!formId || !payload) {
        return { success: false, summary: '', error: 'formId and payload required' };
      }
      const previewId = `form_submit_${formId}_${Date.now()}`;
      await AgenticPreviewPartition.set(previewId, 'form_submit', { formId, payload });
      ctx.openDrawer?.('agentic-preview', {
        previewId,
        kind: 'form_submit',
        title: 'Review form submission'});
      return { success: true, summary: 'Form submission preview ready' };
    }

    // ── Visibility ──────────────────────────────────────────────
    if (key === 'toggle_privacy' || key === 'objects.visibility.toggle') {
      const resourceId = String(call.specifier || (args as any).id || args.objectId || args.object_id || '');
      if (!resourceId) {
        return { success: false, summary: '', error: 'Missing resource id' };
      }

      const rawType = String(args.type || args.objectType || args.resourceType || 'note');
      const resourceType =
        rawType === 'goal' || rawType === 'task' ? 'goal' : (rawType as 'note' | 'project');

      let enablePublic =
        args.isPublic === true ||
        args.isPublic === 'true' ||
        call.subSpecifier === 'true';

      if (call.subSpecifier && call.subSpecifier !== 'true' && call.subSpecifier !== 'false') {
        const parts = call.subSpecifier.split('.');
        const tail = parts[parts.length - 1];
        if (tail === 'true' || tail === 'false') {
          enablePublic = tail === 'true';
        }
      }

      if (args.openDrawer === true) {
        ctx.openDrawer?.('access-control', {
          resourceType,
          resourceId,
          isPublic: enablePublic,
          isGuest: args.isGuest === true || args.isGuest === 'true',
          resourceTitle: String(args.title || resourceId),
          projectId: args.projectId as string | undefined});
        return { success: true, summary: 'Opened visibility controls' };
      }

      const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
      const res = await toggleResourcePublicGuest({
        resourceType,
        resourceId,
        mode: enablePublic ? 'publish' : 'make_private',
        projectId: args.projectId as string | undefined});

      if (!res?.success) {
        return { success: false, summary: '', error: 'Visibility update failed' };
      }

      if (resourceType === 'note') {
        ctx.pushLiveNote?.({ $id: resourceId, isPublic: enablePublic, isGuest: enablePublic });
      }

      return {
        success: true,
        summary: enablePublic ? 'Resource is now public' : 'Resource is now private'};
    }

    // ── Delete ──────────────────────────────────────────────────
    if (key === 'delete_resource' || key.startsWith('objects.') && key.endsWith('.delete')) {
      const delId = (call.specifier || (args as any).id) as string;
      if (!delId) return { success: false, summary: '', error: 'Missing resource id' };
      const type = String(args.type || 'note');
      if (type === 'note') {
        const { deleteNote } = await import('@/lib/actions/client-ops');
        await deleteNote(delId);
        ctx.removeNote?.(delId);
      } else if (type === 'goal' || type === 'task') {
        await ctx.deleteTask?.(delId);
      } else if (type === 'project') {
        const { deleteProject } = await import('@/lib/actions/client-ops');
        await deleteProject(delId);
      }
      return { success: true, summary: `Deleted ${type}: ${delId}` };
    }

    // ── Wallet Balance & Chains ────────────────────────────────
    if (key === 'wallet_get_balance') {
      if (!ctx.user?.$id) {
        return { success: false, summary: '', error: 'Please sign in to check wallet balances.' };
      }
      const { WalletService } = await import('@/lib/services/wallets');
      const { KylrixTokenService } = await import('@/lib/services/token');
      
      const userWallets = await WalletService.getWallets(ctx.user.$id).catch(() => []);
      const userBalance = await KylrixTokenService.getUserBalance(ctx.user.$id).catch(() => ({ amount: '0' }));

      const requestedToken = String(args.token || 'ALL').toUpperCase();

      const items = [
        {
          token: 'KYLRIX',
          chainName: 'Kylrix Ledger',
          address: ctx.user.$id,
          balance: userBalance?.amount || '0',
          color: '#6366F1'
        },
        ...userWallets.map(w => ({
          token: w.symbol,
          chainName: w.label,
          address: w.address,
          balance: '0.00',
          color: '#14F195'
        }))
      ].filter(item => requestedToken === 'ALL' || item.token === requestedToken);

      const block: AgenticMessageBlock = {
        type: 'wallet_balances',
        items,
        totalKylrix: userBalance?.amount || '0'
      };

      return {
        success: true,
        summary: `Retrieved ${items.length} wallet balance(s)`,
        messageBlocks: [block]
      };
    }

    // ── Wallet Send Tokens ───────────────────────────────────────
    if (key === 'wallet_send_tokens') {
      if (!ctx.user?.$id) {
        return { success: false, summary: '', error: 'Please sign in to transfer tokens.' };
      }
      const token = String(args.token || 'KYLRIX').toUpperCase();
      const amount = String(args.amount || '0');
      const recipientUsername = String(args.recipientUsername || args.recipient || '').replace(/^@/, '');
      const recipientUserId = String(args.recipientUserId || '');

      if (ctx.openWalletWithIntent) {
        ctx.openWalletWithIntent({
          mode: 'send',
          toUser: recipientUserId || recipientUsername ? {
            id: recipientUserId,
            username: recipientUsername || 'recipient',
            displayName: recipientUsername || recipientUserId || 'Recipient'
          } : null
        });
        return {
          success: true,
          summary: `Prepared transfer of ${amount} ${token} to ${recipientUsername ? '@' + recipientUsername : 'recipient'}`
        };
      }

      return {
        success: true,
        summary: `Initiated transfer of ${amount} ${token}`
      };
    }

    // ── Search Users / Directory ────────────────────────────────
    if (key === 'search_users') {
      const q = String(args.query || call.specifier || '').trim();
      const limit = Number(args.limit) || 6;
      const { fetchUserProfiles } = await import('@/lib/appwrite/identity');
      
      const results = await fetchUserProfiles(q).catch(() => []);
      const matched = results.slice(0, limit).map((u: any) => ({
        id: u.$id || u.userId || u.id,
        username: u.username || u.name || 'user',
        displayName: u.displayName || u.name || u.username || 'User',
        avatarUrl: u.avatarUrl || u.avatar || undefined
      }));

      const block: AgenticMessageBlock = {
        type: 'user_search',
        query: q,
        users: matched
      };

      return {
        success: true,
        summary: `Found ${matched.length} user(s) matching "${q}"`,
        messageBlocks: [block]
      };
    }

    return { success: false, summary: '', error: `Unhandled tool: ${key}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tool execution failed';
    return { success: false, summary: '', error: message };
  }
}

export async function executeAgenticToolCallWithToast(
  call: AgenticToolCallInput,
  ctx: AgenticExecutionContext,
  toolName?: string): Promise<AgenticExecutionResult> {
  const result = await executeAgenticToolCall(call, ctx);
  if (result.success && !result.skipToast) {
    toast.success(`Kylie ran ${toolName || call.toolKey}.`);
  } else if (!result.success) {
    toast.error(result.error || `Kylie couldn't run ${toolName || call.toolKey}`);
  }
  return result;
}
