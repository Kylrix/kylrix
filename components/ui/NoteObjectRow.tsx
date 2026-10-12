'use client';

import React from 'react';
import type { Notes } from '@/types/appwrite';
import NoteCard from '@/components/ui/NoteCard';

type Props = {
  note: Notes;
  onSelect?: (note: Notes) => void;
  onUpdate?: (updatedNote: Notes) => void;
  onDelete?: (noteId: string) => void;
  className?: string;
};

/** List/grid row for ideas — canonical NoteCard chrome. */
export function NoteObjectRow({ note, onSelect, onUpdate, onDelete }: Props) {
  return (
    <NoteCard
      note={note}
      onNoteSelect={onSelect}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
