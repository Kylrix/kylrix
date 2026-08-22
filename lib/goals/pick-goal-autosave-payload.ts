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

  // Appwrite tasks.tags has max size 50 per element
  const sanitizedTags = tags
    .map((t) => String(t || '').trim().slice(0, 50))
    .filter(Boolean);

  const rawTitle = typeof task.title === 'string' ? task.title.trim() : '';
  const title = clampNoteTitle(rawTitle || 'Untitled Goal', 'Untitled Goal').slice(0, 255);

  const assigneeIds = (task.assigneeIds || [])
    .filter((id) => !!id && id !== 'guest' && id !== 'thread')
    .map((id) => String(id).trim().slice(0, 36))
    .filter(Boolean);

  const attachmentIds = (Array.isArray(task.attachments)
    ? task.attachments.map((a: any) => (typeof a === 'string' ? a : a?.id)).filter(Boolean)
    : []
  )
    .map((id: any) => String(id).trim().slice(0, 36))
    .filter(Boolean);

  const locked = typeof task.dek === 'string' && task.dek.trim().length > 0;

  let isoDue: string | null = null;
  if (task.dueDate) {
    try {
      const d = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
      if (!isNaN(d.getTime())) {
        isoDue = d.toISOString();
      }
    } catch {
      isoDue = null;
    }
  }

  const payload: Record<string, unknown> = {
    status: (task.status || 'todo').slice(0, 20),
    priority: (task.priority || 'medium').slice(0, 20),
    dueDate: isoDue,
    parentId: emptyToNull(task.parentTaskId)?.slice(0, 36) || null,
    assigneeIds,
    attachmentIds,
    eventId: null,
    recurrenceRule: emptyToNull((task as any).recurrenceRule)?.slice(0, 255) || null,
    isPinned: !!task.isPinned,
    isPublic: !!task.isPublic,
    isGuest: !!task.isGuest,
    scheduled: !!task.scheduled,
    isAgentic: !!task.isAgentic,
    isArchived: !!task.isArchived,
    isDeleted: false,
    isTrash: false,
    dek: task.dek ? String(task.dek).slice(0, 2048) : null,
    tags: sanitizedTags,
  };

  // While locked, never push title/description — may be session-decrypted plaintext.
  if (!locked) {
    payload.title = title;
    payload.description = (task.description || '').slice(0, 65535);
  }

  return payload;
}
