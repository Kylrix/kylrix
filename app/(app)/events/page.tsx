'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import EventList from '@/components/events/EventList';

export default function EventsPage() {
  const router = useRouter();

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
        <div className="min-w-0 w-full flex flex-col gap-6">
          {/* Tab Switcher */}
          <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none">
            <button
              onClick={() => router.push('/flow')}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
            >
              Goals
            </button>
            <button
              onClick={() => router.push('/forms')}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
            >
              Forms
            </button>
            <button
              onClick={() => router.push('/events')}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#A855F7] text-white shadow-[0_4px_12px_rgba(168,85,247,0.25)]"
            >
              Events
            </button>
          </div>

          <EventList />
        </div>
      </div>
    </div>
  );
}
