'use client';

import React, { useCallback, useMemo } from 'react';
import { NoteDetailSidebar, type NoteAccessRole } from '@/components/ui/NoteDetailSidebar';
import { ObjectDetailHost } from '@/components/objects/ObjectDetailHost';
import { noteToDetail } from '@/lib/objects/adapters';
import type { Notes } from '@/types/appwrite';
import { useNotes } from '@/context/NotesContext';

type Props = {
  note: Notes;
  onUpdate: (updatedNote: Notes) => void;
  onDelete: (noteId: string) => void;
  onClose?: () => void;
  embedded?: boolean;
  readOnly?: boolean;
  accessRole?: NoteAccessRole;
  layout?: 'page' | 'drawer';
};

/** Unified note detail — panel shell + NoteDetailSidebar (keeps editor chrome). */
export function NoteObjectDetail({
  note,
  onUpdate,
  onDelete,
  onClose,
  embedded = false,
  readOnly,
  accessRole,
  layout = 'drawer'}: Props) {
  const { notes } = useNotes();
  const live = useMemo(
    () => notes.find((n) => n.$id === note.$id) || note,
    [note, notes],
  );
  const item = useMemo(() => noteToDetail(live), [live]);
  const handleClose = useCallback(() => onClose?.(), [onClose]);

  const body = (
    <NoteDetailSidebar
      note={live}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onBack={layout === 'drawer' && !embedded ? handleClose : undefined}
      layout={layout}
      readOnly={readOnly}
      accessRole={accessRole}
    />
  );

  if (layout === 'page') return body;

  return (
    <ObjectDetailHost
      item={item}
      open
      onClose={handleClose}
      embedded={embedded}
      chrome="panel"
    >
      {body}
    </ObjectDetailHost>
  );
}
