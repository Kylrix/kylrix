'use client';

import React, { useCallback } from 'react';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { useTask } from '@/context/TaskContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { GoalObjectDetail } from '@/components/objects/GoalObjectDetail';

/**
 * Unified goal create — live-copy CreateGoalComposer inside ObjectCreateDrawer.
 */
export default function TaskDialog() {
  const { taskDialogOpen, setTaskDialogOpen } = useTask();
  const { openSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const handleClose = useCallback(() => {
    setTaskDialogOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:draft:task');
    }
  }, [setTaskDialogOpen]);

  return (
    <ObjectCreateDrawer
      open={taskDialogOpen}
      kind="goal"
      onClose={handleClose}
      onGoalCreated={(task) => {
        if (!task?.id) return;
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        if (isDesktop) {
          openSidebar(
            <GoalObjectDetail taskId={task.id} embedded />,
            task.id,
            { hideHeader: true },
          );
        } else {
          openOverlay(<GoalObjectDetail taskId={task.id} onClose={closeOverlay} />);
        }
      }}
    />
  );
}
