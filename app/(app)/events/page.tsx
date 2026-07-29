'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import EventList from '@/components/events/EventList';

export default function EventsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0A0908] text-white/90 font-satoshi relative overflow-x-hidden pt-4 md:pt-8 px-4 md:px-6">
      {/* Spotlight ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[240px] bg-gradient-to-b from-purple-500/[0.05] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none mb-8">
          <button
            onClick={() => router.push('/flow')}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
          >
            Goals
          </button>
          <button
            onClick={() => router.push('/flow/forms')}
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

        {/* Events Content */}
        <EventList />
      </div>
    </div>
  );
}
