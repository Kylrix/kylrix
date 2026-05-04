export const NOTE_SOURCE_TAG_PREFIX = 'source:kylrixnote';
export const VAULT_NOTE_TAG_PREFIX = 'note';

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const normalizeNoteId = (noteId: string) => String(noteId || '').trim();

export function buildSourceNoteTags(noteIds: Array<string | null | undefined>) {
  return uniqueStrings(noteIds).map((noteId) => `${NOTE_SOURCE_TAG_PREFIX}:${normalizeNoteId(noteId)}`);
}

export function buildVaultNoteTags(noteIds: Array<string | null | undefined>) {
  return uniqueStrings(noteIds).map((noteId) => `${VAULT_NOTE_TAG_PREFIX}:${normalizeNoteId(noteId)}`);
}

export function mergeNoteTags(existingTags: Array<string | null | undefined> = [], noteIds: Array<string | null | undefined> = [], prefix: 'source' | 'vault' = 'source') {
  const noteTags = prefix === 'source' ? buildSourceNoteTags(noteIds) : buildVaultNoteTags(noteIds);
  return uniqueStrings([...existingTags, ...noteTags]);
}

export function extractLinkedNoteIdsFromTags(tags: Array<string | null | undefined> = []) {
  const ids = new Set<string>();

  for (const tag of tags) {
    const value = String(tag || '').trim();
    if (!value) continue;

    if (value.startsWith(`${NOTE_SOURCE_TAG_PREFIX}:`)) {
      const noteId = value.slice(`${NOTE_SOURCE_TAG_PREFIX}:`.length).trim();
      if (noteId) ids.add(noteId);
    }

    if (value.startsWith(`${VAULT_NOTE_TAG_PREFIX}:`)) {
      const noteId = value.slice(`${VAULT_NOTE_TAG_PREFIX}:`.length).trim();
      if (noteId) ids.add(noteId);
    }
  }

  return Array.from(ids);
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
