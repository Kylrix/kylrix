import { createTag, listTagsByUser, getNote, listNotes, updateNote } from '@/lib/data';

export const createNoteAction = async (data: any) => ({ id: `note_${Date.now()}`, ...data });
export const createTagAction = async (data: any) => createTag(data?.name || 'Tag', data?.color);
export const listTagsAction = async () => listTagsByUser();
export const getNoteAction = async (id: string) => getNote(id);
export const listNotesAction = async () => listNotes();
export const updateNoteAction = async (id: string, data: any) => updateNote(id, data);
export const deleteNoteAction = async (id: string) => ({ id, deleted: true });
