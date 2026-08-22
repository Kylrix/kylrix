'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import TaskList from '@/components/tasks/TaskList';
import { MultiSectionContainer } from '@/context/SectionContext';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { useAuth } from '@/context/auth/AuthContext';

export default function GoalsPage() {
  const router = useRouter();
  const { isAuthenticated, openIDMWindow } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const handleOpenCreate = useCallback(() => {
    if (!isAuthenticated) {
      openIDMWindow?.();
      return;
    }
    setCreateOpen(true);
  }, [isAuthenticated, openIDMWindow]);

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
        <div className="min-w-0 w-full flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none">
              <button
                type="button"
                onClick={() => router.push('/goals')}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#A855F7] text-white shadow-[0_4px_12px_rgba(168,85,247,0.25)]"
              >
                Goals
              </button>
              <button
                type="button"
                onClick={() => router.push('/events')}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
              >
                Events
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#A855F7] text-white hover:bg-[#9333ea] active:scale-95 transition-all shadow-[0_4px_14px_rgba(168,85,247,0.3)] select-none shrink-0"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>New Goal</span>
            </button>
          </div>

          <MultiSectionContainer panels={['forms', 'huddles', 'projects']}>
            <TaskList />
          </MultiSectionContainer>

          <ObjectCreateDrawer
            open={createOpen}
            kind="goal"
            onClose={() => setCreateOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
