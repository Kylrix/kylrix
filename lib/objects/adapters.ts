import type { Notes } from '@/types/appwrite';
import type { Task } from '@/types';
import type { UnifiedObjectCardModel, UnifiedObjectDetailModel } from '@/lib/objects/types';
import { resolveNoteCardTitle } from '@/constants/noteTitle';

export function noteToCard(note: Notes): UnifiedObjectCardModel {
  const id = note.$id || note.id || '';
  const title =
    resolveNoteCardTitle(note.title, note.content) || note.title || 'Untitled';
  const subtitle = (note.content || '').trim().slice(0, 160) || undefined;
  return {
    kind: 'note',
    id,
    title,
    subtitle,
    updatedAt: note.updatedAt || note.$updatedAt || null,
    isPinned: Boolean(note.isPinned),
    isPublic: Boolean(note.isPublic),
    isGuest: Boolean(note.isGuest),
    status: note.status ? String(note.status) : null};
}

export function noteToDetail(note: Notes): UnifiedObjectDetailModel {
  return {
    ...noteToCard(note),
    body: note.content || '',
    tags: Array.isArray(note.tags) ? note.tags.filter(Boolean) as string[] : [],
    ownerId: note.userId || note.creatorId || null,
    raw: note};
}

export function goalToCard(task: Task): UnifiedObjectCardModel {
  return {
    kind: 'goal',
    id: task.id,
    title: task.title || 'Untitled',
    subtitle: (task.description || '').trim().slice(0, 160) || undefined,
    updatedAt: task.updatedAt || null,
    isPinned: Boolean(task.isPinned),
    isPublic: Boolean(task.isPublic),
    isGuest: Boolean(task.isGuest),
    status: task.status || null,
    accent: null};
}

export function goalToDetail(task: Task): UnifiedObjectDetailModel {
  return {
    ...goalToCard(task),
    body: task.description || '',
    tags: task.labels || [],
    ownerId: task.userId || task.creatorId || null,
    raw: task};
}


export function eventToCard(event: {
  $id?: string;
  id?: string;
  title?: string | null;
  description?: string | null;
  updatedAt?: string | Date | null;
  $updatedAt?: string | null;
  isPublic?: boolean | null;
  isGuest?: boolean | null;
  isPinned?: boolean | null;
  status?: string | null;
}): UnifiedObjectCardModel {
  return {
    kind: 'event',
    id: event.$id || event.id || '',
    title: event.title || 'Untitled',
    subtitle: (event.description || '').trim().slice(0, 160) || undefined,
    updatedAt: event.updatedAt || event.$updatedAt || null,
    isPinned: Boolean(event.isPinned),
    isPublic: Boolean(event.isPublic),
    isGuest: Boolean(event.isGuest),
    status: event.status || null};
}
