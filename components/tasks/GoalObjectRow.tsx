'use client';

import React, { useCallback } from 'react';
import { Check } from 'lucide-react';
import { Task } from '@/types';
import { useTask } from '@/context/TaskContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { ObjectCard } from '@/components/objects/ObjectCard';
import { GoalObjectDetail } from '@/components/objects/GoalObjectDetail';
import { goalToCard } from '@/lib/objects/adapters';

type Props = {
  task: Task;
  compact?: boolean;
};

/** Goal row — ObjectCard chrome (profile-drawer primitive). */
export default function GoalObjectRow({ task }: Props) {
  const { selectTask, completeTask } = useTask();
  const { openSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const openDetail = useCallback(() => {
    selectTask(task.id);
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
    if (isDesktop) {
      openSidebar(
        <GoalObjectDetail taskId={task.id} embedded />,
        task.id,
        { hideHeader: true });
    } else {
      openOverlay(
        <GoalObjectDetail taskId={task.id} onClose={closeOverlay} />);
    }
  }, [closeOverlay, openOverlay, openSidebar, selectTask, task.id]);

  const handleComplete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await completeTask(task.id);
    },
    [completeTask, task.id]);

  const item = goalToCard(task);

  return (
    <ObjectCard
      item={item}
      onOpen={openDetail}
      trailing={
        <button
          type="button"
          onClick={handleComplete}
          aria-label={task.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
          className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
            task.status === 'done'
              ? 'border-[#A855F7] bg-[#A855F7] text-[#0A0908]'
              : 'border-[#34322F] text-[#9B9691] hover:border-[#A855F7]'
          }`}
        >
          {task.status === 'done' ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
        </button>
      }
    />
  );
}
