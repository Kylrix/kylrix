import { ulid } from '@/lib/utils/ulid';
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

      const { resolveNoteCardTitle } = await import('@/constants/noteTitle');
      const { markNotePersistedRemote } = await import('@/lib/notes/compose-draft-registry');
      const { isValidAppwriteRowId } = await import('@/lib/utils/resource-ids');
      const draftId = ulid();
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

    if ((key === 'update_note' || key === 'patch_note' || key === 'objects.idea.update') && (call.specifier || (args as any).id)) {
      const noteId = (call.specifier || (args as any).id) as string;
      const patches = (args as any).patches;
      let finalContent = args.content as string | undefined;

      if (Array.isArray(patches) && patches.length > 0) {
        const targetNote = (ctx.notes || []).find((n: any) => n.$id === noteId);
        const { applyTextPatch } = await import('@/lib/agentic/patching-engine');
        const patchResult = applyTextPatch(targetNote?.content || '', patches);
        if (patchResult.success || patchResult.appliedCount > 0) {
          finalContent = patchResult.text;
        }
      }

      const { updateNote } = await import('@/lib/actions/client-ops');
      const saved = await updateNote(noteId, {
        title: args.title as string | undefined,
        content: finalContent,
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
      const { getNote } = await import('@/lib/data');
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

    if ((key === 'get_goal' || key === 'objects.goal.read') && (call.specifier || (args as any).id)) {
      const gid = (call.specifier || (args as any).id) as string;
      let task = ctx.tasks?.find((t: any) => (t.id || t.$id) === gid);
      if (!task) {
        try {
          const { tasks: taskApi } = await import('@/lib/kylrixflow');
          const loaded = await taskApi.get(gid);
          if (loaded) {
            task = loaded as any;
          }
        } catch {}
      }
      const goalTitle = task?.title || 'Goal';
      const goalDesc = task?.description || '';
      const goalStatus = task?.status || 'todo';
      const goalPriority = task?.priority || 'medium';
      const subtasksList = Array.isArray(task?.subtasks) && task.subtasks.length > 0
        ? `\n\n**Subtasks (${task.subtasks.length}):**\n` + task.subtasks.map((st: any) => `- [${st.completed ? 'x' : ' '}] ${st.title}`).join('\n')
        : '';

      await ctx.recordSessionObject?.({
        objectId: gid,
        objectType: 'goal',
        title: goalTitle,
        toolKey: key});
      ctx.openDetailOverlay?.('goal', gid);

      const body = `### Goal: ${goalTitle}\n- **Status**: ${goalStatus}\n- **Priority**: ${goalPriority}${goalDesc ? `\n\n**Description:**\n${goalDesc}` : ''}${subtasksList}`;
      ctx.appendMessage?.('assistant', body, { blocks: [{ type: 'markdown', content: body }] });
      return {
        success: true,
        summary: `Loaded goal: "${goalTitle}"`,
        skipToast: true,
        messageBlocks: [{ type: 'markdown', content: body }],
      };
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

    // ── Projects / Workspaces ───────────────────────────────────
    if (key === 'create_project' || key === 'objects.workspace.create') {
      const { ProjectsService } = await import('@/lib/data');
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

    if ((key === 'update_project' || key === 'objects.workspace.update') && (call.specifier || (args as any).id || args.projectId)) {
      const projectId = String(call.specifier || (args as any).id || args.projectId);
      const { updateProject } = await import('@/lib/actions/client-ops');
      await updateProject(projectId, {
        title: args.title as string | undefined,
        summary: args.summary as string | undefined,
      });
      return { success: true, summary: `Updated project: ${args.title || projectId}` };
    }

    if ((key === 'get_project' || key === 'objects.workspace.read') && (call.specifier || (args as any).id || args.projectId)) {
      const projectId = String(call.specifier || (args as any).id || args.projectId);
      const { ProjectsService } = await import('@/lib/data');
      const project = await ProjectsService.getProject(projectId);
      const title = project?.title || 'Project';
      const body = `### Workspace: ${title}\n- **Summary**: ${project?.summary || 'No description provided'}`;
      ctx.appendMessage?.('assistant', body, { blocks: [{ type: 'markdown', content: body }] });
      return { success: true, summary: `Loaded project: "${title}"`, skipToast: true, messageBlocks: [{ type: 'markdown', content: body }] };
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
    if (key === 'create_form' || key === 'objects.form.create') {
      const title = String(args.title || 'Untitled Form');
      const description = String(args.description || '');
      const schemaFields = Array.isArray(args.fields) ? args.fields : [
        { id: 'f1', type: 'text', label: 'Response / Feedback', required: true },
        { id: 'f2', type: 'email', label: 'Contact Email', required: false },
      ];
      const { createForm } = await import('@/lib/actions/client-ops');
      const form = await createForm({
        title,
        description,
        schema: JSON.stringify(schemaFields),
        status: 'draft',
      });
      if (form?.$id) {
        await ctx.recordSessionObject?.({
          objectId: form.$id,
          objectType: 'form',
          title: form.title || title,
          toolKey: key,
        });
      }
      return { success: true, summary: `Created form: ${form.title || title}` };
    }

    if ((key === 'update_form' || key === 'objects.form.update') && (call.specifier || (args as any).id || args.formId)) {
      const formId = String(call.specifier || (args as any).id || args.formId);
      const { updateForm } = await import('@/lib/actions/client-ops');
      const schemaStr = Array.isArray(args.fields) ? JSON.stringify(args.fields) : undefined;
      const form = await updateForm(formId, {
        title: args.title as string | undefined,
        description: args.description as string | undefined,
        schema: schemaStr,
        status: args.status as string | undefined,
      });
      return { success: true, summary: `Updated form: ${form.title || formId}` };
    }

    if ((key === 'get_form' || key === 'objects.form.read') && (call.specifier || (args as any).id || args.formId)) {
      const formId = String(call.specifier || (args as any).id || args.formId);
      const { FormsService } = await import('@/lib/services/forms');
      const form = await FormsService.getForm(formId);
      const fields = (() => { try { return JSON.parse(form.schema || '[]'); } catch { return []; } })();
      const body = `### Form: ${form.title}\n- **Description**: ${form.description || 'N/A'}\n- **Fields**: ${fields.length} dynamic fields`;
      ctx.appendMessage?.('assistant', body, { blocks: [{ type: 'markdown', content: body }] });
      return { success: true, summary: `Loaded form ${form.title}`, skipToast: true, messageBlocks: [{ type: 'markdown', content: body }] };
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

    // ── Events ──────────────────────────────────────────────────
    if (key === 'create_event' || key === 'objects.event.create') {
      const title = String(args.title || 'Untitled Event');
      const description = String(args.description || '');
      const location = String(args.location || '');
      const startTime = args.startTime ? String(args.startTime) : new Date().toISOString();
      const endTime = args.endTime ? String(args.endTime) : new Date(Date.now() + 3600000).toISOString();
      const { createEvent } = await import('@/lib/actions/client-ops');
      const evt = await createEvent({
        title,
        description,
        location,
        startTime,
        endTime,
      });
      if (evt?.$id || evt?.id) {
        const id = evt.$id || evt.id;
        await ctx.recordSessionObject?.({
          objectId: id,
          objectType: 'event',
          title,
          toolKey: key,
        });
      }
      return { success: true, summary: `Created event: ${title}` };
    }

    if ((key === 'update_event' || key === 'objects.event.update') && (call.specifier || (args as any).id || args.eventId)) {
      const eventId = String(call.specifier || (args as any).id || args.eventId);
      const { updateEvent } = await import('@/lib/actions/client-ops');
      const updated = await updateEvent(eventId, {
        title: args.title as string | undefined,
        description: args.description as string | undefined,
        location: args.location as string | undefined,
        startTime: args.startTime as string | undefined,
        endTime: args.endTime as string | undefined,
      });
      return { success: true, summary: `Updated event: ${updated.title || eventId}` };
    }

    if ((key === 'get_event' || key === 'objects.event.read') && (call.specifier || (args as any).id || args.eventId)) {
      const eventId = String(call.specifier || (args as any).id || args.eventId);
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const events = (await LocalEngine.cacheGet<any[]>('f_events_list').catch(() => null)) || [];
      const evt = events.find((e) => e.id === eventId || e.$id === eventId);
      const title = evt?.title || 'Event';
      const body = `### Event: ${title}\n- **Location**: ${evt?.location || 'N/A'}\n- **Start Time**: ${evt?.startTime || 'N/A'}`;
      ctx.appendMessage?.('assistant', body, { blocks: [{ type: 'markdown', content: body }] });
      return { success: true, summary: `Loaded event: "${title}"`, skipToast: true, messageBlocks: [{ type: 'markdown', content: body }] };
    }

    // ── Workflows / Flows ────────────────────────────────────────
    if (key === 'create_flow' || key === 'objects.flow.create') {
      const title = String(args.title || 'Untitled Workflow');
      const trigger = String(args.trigger || 'manual');
      const actions = Array.isArray(args.actions) ? args.actions : [];
      const { createRow } = await import('@/lib/actions/client-ops');
      const flowId = ulid();
      await createRow('passwordManagerDb', 'workflows', {
        id: flowId,
        userId: ctx.user?.$id || 'guest',
        name: title,
        trigger,
        actions: JSON.stringify(actions),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await ctx.recordSessionObject?.({
        objectId: flowId,
        objectType: 'flow',
        title,
        toolKey: key,
      });
      return { success: true, summary: `Created workflow: ${title}` };
    }

    if ((key === 'update_flow' || key === 'objects.flow.update') && (call.specifier || (args as any).id || args.flowId)) {
      const flowId = String(call.specifier || (args as any).id || args.flowId);
      const { updateRow } = await import('@/lib/actions/client-ops');
      await updateRow('passwordManagerDb', 'workflows', flowId, {
        name: args.title as string | undefined,
        trigger: args.trigger as string | undefined,
        status: args.status as string | undefined,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, summary: `Updated workflow: ${args.title || flowId}` };
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
      } else if (type === 'form') {
        const { deleteForm } = await import('@/lib/actions/client-ops');
        await deleteForm(delId);
      } else if (type === 'event') {
        const { deleteEvent } = await import('@/lib/actions/client-ops');
        await deleteEvent(delId);
      } else if (type === 'flow') {
        const { deleteRow } = await import('@/lib/actions/client-ops');
        await deleteRow('passwordManagerDb', 'workflows', delId);
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
      
      const userWallets = await WalletService.listMainWallets(ctx.user.$id).catch(() => []);
      const userBalance = await KylrixTokenService.getUserBalance(ctx.user.$id).catch(() => ({ amount: '0' }));

      // Fuzzy chain pattern normalization
      const rawToken = String(args.token || args.chain || call.specifier || 'ALL').trim().toLowerCase();
      let normalizedFilter = 'ALL';
      if (/kyl|kts|token/i.test(rawToken)) normalizedFilter = 'KYLRIX';
      else if (/sol/i.test(rawToken)) normalizedFilter = 'SOL';
      else if (/eth|ether/i.test(rawToken)) normalizedFilter = 'ETH';
      else if (/btc|bit/i.test(rawToken)) normalizedFilter = 'BTC';
      else if (/sui/i.test(rawToken)) normalizedFilter = 'SUI';
      else if (/base/i.test(rawToken)) normalizedFilter = 'BASE';
      else if (/poly|pol|matic/i.test(rawToken)) normalizedFilter = 'POL';
      else if (/arb/i.test(rawToken)) normalizedFilter = 'ARB';
      else if (rawToken !== 'all') normalizedFilter = rawToken.toUpperCase();

      const allItems = [
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
          color: w.symbol === 'SOL' ? '#14F195' : w.symbol === 'ETH' ? '#627EEA' : w.symbol === 'BTC' ? '#F7931A' : '#818cf8'
        }))
      ];

      const items = allItems.filter(
        item => normalizedFilter === 'ALL' || item.token.toUpperCase() === normalizedFilter
      );

      const messageBlocks: AgenticMessageBlock[] = [
        {
          type: 'wallet_balances',
          items: items.length > 0 ? items : allItems,
          totalKylrix: userBalance?.amount || '0'
        }
      ];

      return {
        success: true,
        summary: `Retrieved ${items.length || allItems.length} wallet balance(s)`,
        messageBlocks
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
      const { UsersService } = await import('@/lib/services/users');
      
      const results = await UsersService.searchUsers(q).catch(() => []);
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

    // ── Agent Provisioning Keys & CLI Skills ─────────────────────
    if (key === 'create_apk' || key === 'create_agent_key' || key === 'provision_apk') {
      const name = String(args.name || 'Agent Provisioning Key').trim();
      const { PatService } = await import('@/lib/services/pats');
      const userId = ctx.user?.$id || 'guest';
      const pat = await PatService.create({
        userId,
        name,
        scopes: ['agents:provision'],
        keyCategory: 'agent_provisioning_key',
      });
      const body = `### Created Agent Provisioning Key\n- **Name**: ${pat.pat.name}\n- **APK Key**: \`${pat.token}\`\n- **Category**: \`agent_provisioning_key\`\n- **Scopes**: \`agents:provision\`\n\nSave this key securely. It can be used to provision autonomous agents.`;
      ctx.appendMessage?.('assistant', body, { blocks: [{ type: 'markdown', content: body }] });
      return { success: true, summary: `Created Agent Provisioning Key: ${pat.token}`, messageBlocks: [{ type: 'markdown', content: body }] };
    }

    if (key === 'install_skill' || key === 'install_cli_skill') {
      const skill = String(args.skill || args.name || call.specifier || 'default-skill').trim();
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const installed = (await LocalEngine.cacheGet<string[]>('installed_cli_skills').catch(() => [])) || [];
      if (!installed.includes(skill)) {
        installed.push(skill);
        await LocalEngine.cacheSet('installed_cli_skills', installed).catch(() => {});
      }
      const body = `### Installed CLI Skill\n- **Skill**: \`${skill}\`\n- **Status**: Installed & Ready in Sidekick Workspace.`;
      ctx.appendMessage?.('assistant', body, { blocks: [{ type: 'markdown', content: body }] });
      return { success: true, summary: `Installed skill: ${skill}`, messageBlocks: [{ type: 'markdown', content: body }] };
    }

    // ── Collaboration & Attachments ─────────────────────────────
    if (key === 'add_collaborator' || key === 'add_workspace_collaborator') {
      const workspaceId = String(args.workspaceId || args.projectId || call.specifier || '').trim();
      const targetUser = String(args.userId || args.username || args.collaborator || '').trim();
      if (!workspaceId || !targetUser) {
        return { success: false, summary: '', error: 'workspaceId and target user required' };
      }
      const { addProjectCollaborator } = await import('@/lib/actions/client-ops');
      await addProjectCollaborator(workspaceId, targetUser, (args.permission as string) || 'write');
      return { success: true, summary: `Added collaborator ${targetUser} to workspace` };
    }

    if (key === 'attach_object_to_workspace' || key === 'attach_object_workspace') {
      const workspaceId = String(args.workspaceId || args.projectId || call.specifier || '').trim();
      const entityKind = String(args.entityKind || args.kind || 'note').trim();
      const entityId = String(args.entityId || args.id || '').trim();
      if (!workspaceId || !entityId) {
        return { success: false, summary: '', error: 'workspaceId and entityId required' };
      }
      const { addObjectToProject } = await import('@/lib/actions/client-ops');
      await addObjectToProject(workspaceId, entityKind === 'goal' ? 'task' : entityKind, entityId);
      return { success: true, summary: `Attached ${entityKind} ${entityId} to workspace` };
    }

    // ── Vault & TOTP Secrets ─────────────────────────────────────
    if (key === 'create_vault_item' || key === 'create_secret') {
      const title = String(args.name || args.title || 'Untitled Secret').trim();
      const secret = String(args.secret || args.password || '');
      const { upsertVaultItemTurso } = await import('@/lib/actions/turso-ops');
      const now = new Date().toISOString();
      const itemId = ulid();
      await upsertVaultItemTurso({
        id: itemId,
        userId: ctx.user?.$id || 'guest',
        title,
        encryptedData: secret,
        itemType: (args.itemType as string) || 'login',
        createdAt: now,
        updatedAt: now,
      });
      await ctx.recordSessionObject?.({
        objectId: itemId,
        objectType: 'vault',
        title,
        toolKey: key,
      });
      return { success: true, summary: `Created vault secret: ${title}` };
    }

    if (key === 'create_totp_secret') {
      const issuer = String(args.issuer || args.name || 'App').trim();
      const secretKey = String(args.secretKey || args.secret || '').trim();
      const { upsertTotpSecretTurso } = await import('@/lib/actions/turso-ops');
      const now = new Date().toISOString();
      const itemId = ulid();
      await upsertTotpSecretTurso({
        id: itemId,
        userId: ctx.user?.$id || 'guest',
        accountName: issuer,
        encryptedSecret: secretKey,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.recordSessionObject?.({
        objectId: itemId,
        objectType: 'totp',
        title: issuer,
        toolKey: key,
      });
      return { success: true, summary: `Created TOTP secret for ${issuer}` };
    }

    if (key === 'token_me' || key === 'token_update_scopes') {
      const { PatService } = await import('@/lib/services/pats');
      const userId = ctx.user?.$id || 'guest';
      if (key === 'token_update_scopes' && call.specifier) {
        const scopes = Array.isArray(args.scopes) ? args.scopes : [args.scopes];
        await PatService.updateScopes({ patId: call.specifier, userId, scopes: scopes as any, mode: 'grant' });
        return { success: true, summary: `Updated scopes for PAT ${call.specifier}` };
      }
      const pats = await PatService.listForUser(userId);
      const body = `### Token Status\n- **Active PATs**: ${pats.length}`;
      ctx.appendMessage?.('assistant', body, { blocks: [{ type: 'markdown', content: body }] });
      return { success: true, summary: `Checked PAT status (${pats.length} active)`, skipToast: true, messageBlocks: [{ type: 'markdown', content: body }] };
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
