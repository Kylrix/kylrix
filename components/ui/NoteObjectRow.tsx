'use client';

import React, { useCallback } from 'react';
import type { Notes } from '@/types/appwrite';
import { ObjectCard } from '@/components/objects/ObjectCard';
import { noteToCard } from '@/lib/objects/adapters';

type Props = {
  note: Notes;
  onSelect?: (note: Notes) => void;
  className?: string;
};

/** List/grid row for ideas — shared ObjectCard chrome. */
export function NoteObjectRow({ note, onSelect, className }: Props) {
  const open = useCallback(() => {
    onSelect?.(note);
  }, [note, onSelect]);

  return (
    <ObjectCard
      item={noteToCard(note)}
      onOpen={open}
      className={className}
    />
  );
}
