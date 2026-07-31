/**
 * Goal (tasks table) autosave payload — never includes pending/sync UI fields.
 */

import type { Task } from '@/types';
import { clampNoteTitle } from '@/constants/noteTitle';

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

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

  const assigneeIds = (task.assigneeIds || []).filter(
    (id) => !!id && id !== 'guest' && id !== 'ghost');

  const locked = typeof task.dek === 'string' && task.dek.trim().length > 0;

  const payload: Record<string, unknown> = {
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    dueDate: task.dueDate
      ? task.dueDate instanceof Date
        ? task.dueDate.toISOString()
        : task.dueDate
      : null,
    parentId: emptyToNull(task.parentTaskId),
    assigneeIds,
    attachmentIds: Array.isArray(task.attachments)
      ? task.attachments.map((a: any) => (typeof a === 'string' ? a : a?.id)).filter(Boolean)
      : [],
    eventId: null,
    recurrenceRule: emptyToNull((task as any).recurrenceRule),
    isPinned: !!task.isPinned,
    isPublic: !!task.isPublic,
    isGuest: !!task.isGuest,
    scheduled: !!task.scheduled,
    isAgentic: !!task.isAgentic,
    isArchived: !!task.isArchived,
    isDeleted: false,
    isTrash: false,
    dek: task.dek || null,
    tags,
  };

  // While locked, never push title/description — may be session-decrypted plaintext.
  if (!locked) {
    payload.title = title;
    payload.description = task.description || '';
  }

  return payload;
}
