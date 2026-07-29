'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import TaskList from '@/components/tasks/TaskList';
import { MultiSectionContainer } from '@/context/SectionContext';

export default function GoalsPage() {
  const router = useRouter();

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
        <div className="min-w-0 w-full flex flex-col gap-6">
          {/* Tab Switcher matching /app design structure */}
          <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none">
            <button
              onClick={() => router.push('/app')}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
            >
              Ideas
            </button>
            <button
              onClick={() => router.push('/goals')}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#A855F7] text-white shadow-[0_4px_12px_rgba(168,85,247,0.25)]"
            >
              Goals
            </button>
          </div>

          <MultiSectionContainer panels={['forms', 'huddles', 'projects']}>
            <TaskList />
          </MultiSectionContainer>
        </div>
      </div>
    </div>
  );
}
