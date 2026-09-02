'use client';

import { Target, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import EventList from '@/components/events/EventList';
import { HangoutTabTrigger } from '@/components/hangout/HangoutTabTrigger';
import { MomentTabTrigger } from '@/components/connect/MomentTabTrigger';
import { FlowTabTrigger } from '@/components/flows/FlowTabTrigger';

export default function EventsPage() {
  const router = useRouter();

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
        <div className="min-w-0 w-full flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-1.5 sm:gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none">
              <button
                type="button"
                onClick={() => router.push('/goals')}
                className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
                title="Goals"
                aria-label="Goals"
              >
                <Target size={15} />
                <span className="hidden sm:inline">Goals</span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/events')}
                className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#A855F7] text-white shadow-[0_4px_12px_rgba(168,85,247,0.25)]"
                title="Events"
                aria-label="Events"
              >
                <Calendar size={15} />
                <span className="hidden sm:inline">Events</span>
              </button>
            </div>


            <div className="flex items-center gap-2">
              <FlowTabTrigger />
              <MomentTabTrigger />
              <HangoutTabTrigger />
            </div>
          </div>



          <EventList />
        </div>
      </div>
    </div>
  );
}
