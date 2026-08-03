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
    <div className="min-h-screen bg-[#0A0908] text-white flex flex-col">
      <MultiSectionContainer panels={['note', 'huddles', 'goals']} contextId={eventId}>
        {/* Top Bar Header */}
        <div className="p-4 bg-[#161412] border-b border-[#34322F] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => router.push('/events')}
            className="px-3.5 py-1.5 rounded-xl bg-[#1C1A18] hover:bg-[#242220] border border-[#34322F] text-white text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#8E8A86]" />
            <span>Back to Events</span>
          </button>
          <span className="text-xs font-mono font-bold text-[#8E8A86] tracking-wider uppercase">
            Event Invite Page
          </span>
        </div>

        {/* Direct Event Details Component Mirror — Full width, thin margins */}
        <div className="flex-1 w-full p-1 sm:p-3 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 rounded-xl sm:rounded-[24px] border border-[#34322F] bg-[#161412] overflow-hidden shadow-2xl flex flex-col min-h-0">
            <EventDetails
              eventId={eventId}
              onBack={() => router.push('/events')}
              onClose={() => router.push('/events')}
            />
          </div>
        </div>
      </MultiSectionContainer>
    </div>
  );
}
