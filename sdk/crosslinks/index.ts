export const NOTE_SOURCE_TAG_PREFIX = 'source:kylrixnote';
const VAULT_NOTE_TAG_PREFIX = 'note';

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const normalizeNoteId = (noteId: string) => String(noteId || '').trim();

export function isSourceNoteTag(tag: string): boolean {
  return String(tag || '').startsWith(`${NOTE_SOURCE_TAG_PREFIX}:`);
}

export function parseSourceNoteIdsFromTags(tags: Array<string | null | undefined>): string[] {
  return (tags || [])
    .map((tag) => String(tag || '').trim())
    .filter(isSourceNoteTag)
    .map((tag) => tag.slice(NOTE_SOURCE_TAG_PREFIX.length + 1).trim())
    .filter(Boolean);
}

export function buildSourceNoteTags(noteIds: Array<string | null | undefined>) {
  return uniqueStrings(noteIds).map((noteId) => `${NOTE_SOURCE_TAG_PREFIX}:${normalizeNoteId(noteId)}`);
}

export function buildVaultNoteTags(noteIds: Array<string | null | undefined>) {
  return uniqueStrings(noteIds).map((noteId) => `${VAULT_NOTE_TAG_PREFIX}:${normalizeNoteId(noteId)}`);
}

export function buildNoteAttachmentMetadata(note: {
  $id?: string;
  title?: string | null;
  content?: string | null;
}) {
  return {
    type: 'attachment',
    entity: 'note',
    subType: 'shared_note',
    referenceId: note.$id || null,
    payload: {
      label: note.title || 'Attached Note',
      preview: String(note.content || '').slice(0, 100),
    },
  };
}
