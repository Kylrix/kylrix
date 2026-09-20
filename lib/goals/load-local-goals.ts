/**
 * Goals local-copy hydration — same cascade as UnifiedFileAttachmentDrawer goals tab.
 * Context tasks → RxDB tasks → f_goals_list → Nexus memory cache.
 */

import type { Task } from '@/types';
import { LocalEngine } from '@/lib/services/LocalEngine';

function parseSafeDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseSafeOptionalDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

function normalizeGoalRow(row: any, userId?: string): Task | null {
  if (!row || typeof row !== 'object') return null;
  if (row.isTrash === true || row.isDeleted === true || String(row.isTrash) === 'true' || String(row.isDeleted) === 'true') {
    return null;
  }
  const id = String(row.$id || row.id || '').trim();
  if (!id) return null;
  if (LocalEngine.isDeleted(id, userId)) {
    return null;
  }

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
    dueDate: parseSafeOptionalDate(row.dueDate),
    createdAt: parseSafeDate(row.$createdAt || row.createdAt),
    updatedAt: parseSafeDate(row.$updatedAt || row.updatedAt),
    position: typeof row.position === 'number' ? row.position : 0,
    isArchived: row.isArchived === true || String(row.isArchived) === 'true',
    isPinned: row.isPinned === true || String(row.isPinned) === 'true',
    isPublic: row.isPublic === true || String(row.isPublic) === 'true',
    isGuest: row.isGuest === true || String(row.isGuest) === 'true',
    discussionId: row.discussionId || null,
    scheduled: row.scheduled === true || String(row.scheduled) === 'true',
    isAgentic: row.isAgentic === true || String(row.isAgentic) === 'true',
    isWorkspace: row.isWorkspace === true || String(row.isWorkspace) === 'true' || (Boolean(projectId) && projectId !== 'inbox' && projectId !== 'default' && projectId !== 'personal'),
    dek: row.dek || null,
  } as Task;
}

export async function loadGoalsFromLocalCopy(opts: {
  userId: string;
  existingTasks?: Task[];
  getCachedDataSync?: (key: string) => unknown;
  getCachedDataAsync?: (key: string) => Promise<unknown>;
}): Promise<Task[]> {
  const userId = opts.userId || 'guest';

  if (opts.existingTasks?.length) {
    const activeExisting = opts.existingTasks.filter((t) => !LocalEngine.isDeleted(t.id, userId));
    if (activeExisting.length) return activeExisting;
  }

  if (userId && userId !== 'guest') {
    try {
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB().catch(() => null);
      if (db?.tasks) {
        const rxRows = (await db.tasks.find({ selector: { userId: { $eq: userId } } }).exec()).map((d: any) => d.toJSON());
        const rxTasks = rxRows.map((r) => normalizeGoalRow(r, userId)).filter((t): t is Task => !!t);
        if (rxTasks.length) return rxTasks;
      }
    } catch {
      /* non-fatal */
    }
  }

  try {
    const goalsList = await LocalEngine.cacheGet<any[]>(`f_goals_list_${userId}`);
    if (goalsList?.length) {
      const cached = goalsList.map((r) => normalizeGoalRow(r, userId)).filter((t): t is Task => !!t);
      if (cached.length) return cached;
    }
  } catch {
    /* non-fatal */
  }

  const tasksKey = `f_tasks_${userId}`;
  const syncHit = opts.getCachedDataSync?.(tasksKey) as { rows?: any[] } | any[] | null | undefined;
  const rows = Array.isArray(syncHit) ? syncHit : syncHit?.rows || [];
  if (rows.length) {
    const fromNexus = rows.map((r) => normalizeGoalRow(r, userId)).filter((t): t is Task => !!t);
    if (fromNexus.length) return fromNexus;
  }

  if (opts.getCachedDataAsync) {
    const asyncHit = (await opts.getCachedDataAsync(tasksKey)) as { rows?: any[] } | any[] | null | undefined;
    const asyncRows = Array.isArray(asyncHit) ? asyncHit : asyncHit?.rows || [];
    if (asyncRows.length) {
      const fromAsync = asyncRows.map((r) => normalizeGoalRow(r, userId)).filter((t): t is Task => !!t);
      if (fromAsync.length) return fromAsync;
    }
  }

  return [];
}
