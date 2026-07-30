'use client';

import { ID } from 'appwrite';
import type { Notes } from '@/types/appwrite';
import type { Task } from '@/types';
import { resolveNoteCardTitle } from '@/constants/noteTitle';

export type ObjectDraft = {
  kind: 'note' | 'goal';
  title: string;
  body: string;
};

/** Build a live-copy note shell (sync engine is SoT for pending). */
export function buildNoteShell(
  draft: ObjectDraft,
  userId?: string | null,
  opts?: { isPublic?: boolean; isGuest?: boolean }): Notes {
  const id = ID.unique();
  const now = new Date().toISOString();
  const title =
    resolveNoteCardTitle(draft.title || null, draft.body) ||
    draft.title ||
    'Untitled';

  return {
    $id: id,
    id,
    title,
    content: draft.body || '',
    tags: [],
    format: 'text',
    userId: userId || '',
    creatorId: userId || null,
    isPublic: Boolean(opts?.isPublic),
    isGuest: Boolean(opts?.isGuest),
    status: null,
    parentNoteId: null,
    comments: [],
    extensions: [],
    collaborators: [],
    metadata: null,
    attachments: [],
    $createdAt: now,
    $updatedAt: now,
    createdAt: now,
    updatedAt: now} as unknown as Notes;
}

/** Minimal goal payload for TaskContext.addTask. */
export function buildGoalInput(
  draft: ObjectDraft,
  opts?: { projectId?: string; creatorId?: string | null }): Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'position'> {
  const creatorId = opts?.creatorId || 'guest';
  return {
    title: draft.title.trim() || 'Untitled Goal',
    description: draft.body.trim() || undefined,
    priority: 'medium',
    status: 'todo',
    projectId: opts?.projectId || 'inbox',
    labels: [],
    linkedNotes: [],
    subtasks: [],
    comments: [],
    attachments: [],
    reminders: [],
    timeEntries: [],
    assigneeIds: creatorId !== 'guest' ? [creatorId] : [],
    creatorId,
    userId: creatorId,
    parentTaskId: null,
    isPinned: false,
    isArchived: false,
    isPublic: false,
    isGuest: false};
}
