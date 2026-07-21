/**
 * Goal (tasks table) autosave payload — never includes pending/sync UI fields.
 */

import { clampNoteTitle } from '@/constants/noteTitle';

export function pickGoalAutosavePayload(task: Task): Record<string, unknown> {
  const tags = [...(task.labels || [])];
  (task.linkedNotes || []).forEach((noteId) => {
    const tag = `source:kylrixnote:${noteId}`;
    if (!tags.includes(tag)) tags.push(tag);
  });
  if (task.projectId && task.projectId !== 'inbox') {
    const projectTag = `project:${task.projectId}`;
    if (!tags.includes(projectTag)) tags.push(projectTag);
  }

  const rawTitle = typeof task.title === 'string' ? task.title.trim() : '';
  const title = clampNoteTitle(rawTitle || 'Untitled Goal', 'Untitled Goal');

  return {
    title,
    description: task.description || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    dueDate: task.dueDate
      ? task.dueDate instanceof Date
        ? task.dueDate.toISOString()
        : task.dueDate
      : null,
    parentId: task.parentTaskId || '',
    assigneeIds: task.assigneeIds || [],
    attachmentIds: Array.isArray(task.attachments)
      ? task.attachments.map((a: any) => (typeof a === 'string' ? a : a?.id)).filter(Boolean)
      : [],
    eventId: '',
    recurrenceRule: '',
    isPinned: !!task.isPinned,
    isPublic: !!task.isPublic,
    isGuest: !!task.isGuest,
    scheduled: !!task.scheduled,
    isAgentic: !!task.isAgentic,
    tags,
  };
}
