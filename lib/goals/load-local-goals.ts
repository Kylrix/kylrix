/**
 * Goals local-copy hydration — same cascade as UnifiedFileAttachmentDrawer goals tab.
 * Context tasks → RxDB tasks → f_goals_list → Nexus memory cache.
 */

import type { Task } from '@/types';

function normalizeGoalRow(row: any): Task | null {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.$id || row.id || '').trim();
  if (!id) return null;

  if (row.id && !row.$id && Array.isArray(row.labels)) {
    return { ...row, id } as Task;
  }

  const tags = Array.isArray(row.tags) ? row.tags : [];
  const projectTag = tags.find((t: string) => String(t).startsWith('project:'));
  const projectId = projectTag ? String(projectTag).split(':')[1] : row.projectId || 'inbox';
  const userLabels = tags.filter(
    (t: string) => !String(t).startsWith('project:') && !String(t).startsWith('source:'));

  return {
    id,
    title: String(row.title || 'Untitled'),
    description: String(row.description || ''),
    status: row.status || 'todo',
    priority: row.priority || 'medium',
    projectId,
    labels: userLabels.length ? userLabels : Array.isArray(row.labels) ? row.labels : [],
    linkedNotes: Array.isArray(row.linkedNotes) ? row.linkedNotes : [],
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    reminders: Array.isArray(row.reminders) ? row.reminders : [],
    timeEntries: Array.isArray(row.timeEntries) ? row.timeEntries : [],
    assigneeIds: Array.isArray(row.assigneeIds) ? row.assigneeIds : [],
    creatorId: row.creatorId || row.userId || 'guest',
    userId: row.userId || row.creatorId || 'guest',
    parentTaskId: row.parentTaskId || row.parentId || null,
    dueDate: row.dueDate ? new Date(row.dueDate) : undefined,
    createdAt: row.$createdAt ? new Date(row.$createdAt) : row.createdAt ? new Date(row.createdAt) : new Date(),
    updatedAt: row.$updatedAt ? new Date(row.$updatedAt) : row.updatedAt ? new Date(row.updatedAt) : new Date(),
    position: typeof row.position === 'number' ? row.position : 0,
    isArchived: row.isArchived === true || String(row.isArchived) === 'true',
    isPinned: row.isPinned === true || String(row.isPinned) === 'true',
    isPublic: row.isPublic === true || String(row.isPublic) === 'true',
    isGuest: row.isGuest === true || String(row.isGuest) === 'true',
    discussionId: row.discussionId || null,
    scheduled: row.scheduled === true || String(row.scheduled) === 'true',
    isAgentic: row.isAgentic === true || String(row.isAgentic) === 'true',
    dek: row.dek || null,
  } as Task;
}

export async function loadGoalsFromLocalCopy(opts: {
  userId: string;
  existingTasks?: Task[];
  getCachedDataSync?: (key: string) => unknown;
  getCachedDataAsync?: (key: string) => Promise<unknown>;
}): Promise<Task[]> {
  if (opts.existingTasks?.length) {
    return opts.existingTasks;
  }

  try {
    const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
    const db = await getRxDB().catch(() => null);
    if (db?.tasks) {
      const rxRows = (await db.tasks.find().exec()).map((d: any) => d.toJSON());
      const rxTasks = rxRows.map(normalizeGoalRow).filter((t): t is Task => !!t);
      if (rxTasks.length) return rxTasks;
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const goalsList = await LocalEngine.cacheGet<any[]>(`f_goals_list_${opts.userId}`);
    if (goalsList?.length) {
      const cached = goalsList.map(normalizeGoalRow).filter((t): t is Task => !!t);
      if (cached.length) return cached;
    }
  } catch {
    /* non-fatal */
  }

  const tasksKey = `f_tasks_${opts.userId}`;
  const syncHit = opts.getCachedDataSync?.(tasksKey) as { rows?: any[] } | any[] | null | undefined;
  const rows = Array.isArray(syncHit) ? syncHit : syncHit?.rows || [];
  if (rows.length) {
    const fromNexus = rows.map(normalizeGoalRow).filter((t): t is Task => !!t);
    if (fromNexus.length) return fromNexus;
  }

  if (opts.getCachedDataAsync) {
    const asyncHit = (await opts.getCachedDataAsync(tasksKey)) as { rows?: any[] } | any[] | null | undefined;
    const asyncRows = Array.isArray(asyncHit) ? asyncHit : asyncHit?.rows || [];
    if (asyncRows.length) {
      const fromAsync = asyncRows.map(normalizeGoalRow).filter((t): t is Task => !!t);
      if (fromAsync.length) return fromAsync;
    }
  }

  return [];
}
