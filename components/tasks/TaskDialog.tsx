'use client';

import React, { useCallback, useEffect } from 'react';
import { useTask } from '@/context/TaskContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { GoalObjectDetail } from '@/components/objects/GoalObjectDetail';
import { CreateGoalComposer } from '@/components/objects/CreateGoalComposer';

/**
 * Unified goal create — live-copy CreateGoalComposer in native right sidebar (desktop) or overlay (mobile).
 */
export default function TaskDialog() {
  const { taskDialogOpen, setTaskDialogOpen } = useTask();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const handleClose = useCallback(() => {
    setTaskDialogOpen(false);
    closeSidebar();
    closeOverlay();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:draft:task');
    }
  }, [setTaskDialogOpen, closeSidebar, closeOverlay]);

  useEffect(() => {
    if (!taskDialogOpen) return;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;

    const composer = (
      <CreateGoalComposer
        onGoalCreated={(task) => {
          handleClose();
          if (!task?.id) return;
          if (isDesktop) {
            openSidebar(
              <GoalObjectDetail taskId={task.id} embedded onClose={closeSidebar} />,
              task.id,
              { hideHeader: true },
            );
          } else {
            openOverlay(<GoalObjectDetail taskId={task.id} onClose={closeOverlay} embedded />);
          }
        }}
        onClose={handleClose}
      />
    );

    if (isDesktop) {
      openSidebar(composer, 'create-goal', { hideHeader: true });
    } else {
      openOverlay(composer);
    }
  }, [taskDialogOpen, openSidebar, closeSidebar, openOverlay, closeOverlay, handleClose]);

  return null;
}
