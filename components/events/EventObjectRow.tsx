'use client';

import React from 'react';
import type { Event } from '@/types';
import { ObjectCard } from '@/components/objects/ObjectCard';
import { eventToCard } from '@/lib/objects/adapters';

type Props = {
  event: Event;
  onClick: () => void;
};

/** List row for events — shared ObjectCard chrome. */
export function EventObjectRow({ event, onClick }: Props) {
  return (
    <ObjectCard
      item={eventToCard({
        id: event.id,
        title: event.title,
        description: event.description,
        updatedAt: event.updatedAt,
        isPublic: event.isPublic,
        isGuest: event.isGuest,
        isPinned: event.isPinned})}
      onOpen={() => onClick()}
    />
  );
}
