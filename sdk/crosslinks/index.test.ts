import { describe, it, expect } from 'vitest';
import {
  isSourceNoteTag,
  parseSourceNoteIdsFromTags,
  buildSourceNoteTags,
  buildVaultNoteTags,
  buildNoteAttachmentMetadata,
  NOTE_SOURCE_TAG_PREFIX,
} from './index';

describe('sdk/crosslinks', () => {
  it('isSourceNoteTag checks prefix correctly', () => {
    expect(isSourceNoteTag(`${NOTE_SOURCE_TAG_PREFIX}:note-123`)).toBe(true);
    expect(isSourceNoteTag('regular-tag')).toBe(false);
    expect(isSourceNoteTag('')).toBe(false);
  });

  it('parseSourceNoteIdsFromTags extracts note ids', () => {
    const tags = [`${NOTE_SOURCE_TAG_PREFIX}:note-1`, 'other-tag', `${NOTE_SOURCE_TAG_PREFIX}:note-2`, null, undefined];
    const ids = parseSourceNoteIdsFromTags(tags);
    expect(ids).toEqual(['note-1', 'note-2']);
  });

  it('buildSourceNoteTags builds formatted unique tags', () => {
    const tags = buildSourceNoteTags(['note-1', 'note-2', 'note-1', '', null]);
    expect(tags).toEqual([
      `${NOTE_SOURCE_TAG_PREFIX}:note-1`,
      `${NOTE_SOURCE_TAG_PREFIX}:note-2`,
    ]);
  });

  it('buildVaultNoteTags builds vault note tags', () => {
    const tags = buildVaultNoteTags(['v1', 'v2', 'v1']);
    expect(tags).toEqual(['note:v1', 'note:v2']);
  });

  it('buildNoteAttachmentMetadata builds metadata payload with defaults', () => {
    const meta = buildNoteAttachmentMetadata({
      $id: 'note-1',
      title: 'My Title',
      content: 'Hello world long content',
    });
    expect(meta).toEqual({
      type: 'attachment',
      entity: 'note',
      subType: 'shared_note',
      referenceId: 'note-1',
      payload: {
        label: 'My Title',
        preview: 'Hello world long content',
      },
    });

    const defaultMeta = buildNoteAttachmentMetadata({});
    expect(defaultMeta.referenceId).toBeNull();
    expect(defaultMeta.payload.label).toBe('Attached Note');
    expect(defaultMeta.payload.preview).toBe('');
  });
});
