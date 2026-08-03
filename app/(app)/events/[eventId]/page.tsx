'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import EventDetails from '@/components/events/EventDetails';
import { MultiSectionContainer } from '@/context/SectionContext';

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();

  if (!eventId) return null;

  return (
    <div className="min-h-screen bg-[#161412] text-white flex flex-col p-0 m-0">
      <MultiSectionContainer panels={['note', 'huddles', 'goals']} contextId={eventId}>
        <div className="flex-1 w-full h-full min-h-screen overflow-hidden flex flex-col">
          <EventDetails
            eventId={eventId}
            hideViewPageButton={true}
            onBack={() => router.push('/events')}
            onClose={() => router.push('/events')}
          />
        </div>
      </MultiSectionContainer>
    </div>
  );
}
