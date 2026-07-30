'use client';

import React, { useCallback } from 'react';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { useTask } from '@/context/TaskContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { GoalObjectDetail } from '@/components/objects/GoalObjectDetail';
import { buildGoalInput } from '@/lib/objects/create';

/**
 * Unified goal create — same ObjectCreateDrawer chrome as notes.
 * Detail opens after create (desktop sidebar / mobile overlay).
 */
export default function TaskDialog() {
  const {
    taskDialogOpen,
    setTaskDialogOpen,
    addTask,
    selectedProjectId,
    userId: creatorId} = useTask();
  const { openSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const handleClose = useCallback(() => {
    setTaskDialogOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:draft:task');
    }
  }, [setTaskDialogOpen]);

  const handleSubmit = useCallback(
    async (draft: { kind: string; title: string; body: string }) => {
      const newTask = await addTask(
        buildGoalInput(
          { kind: 'goal', title: draft.title, body: draft.body },
          { projectId: selectedProjectId || 'inbox', creatorId },
        ),
      );

      if (newTask?.id) {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        if (isDesktop) {
          openSidebar(
            <GoalObjectDetail taskId={newTask.id} embedded />,
            newTask.id,
            { hideHeader: true },
          );
        } else {
          openOverlay(<GoalObjectDetail taskId={newTask.id} onClose={closeOverlay} />);
        }
      }
      handleClose();
    },
    [addTask, closeOverlay, creatorId, handleClose, openOverlay, openSidebar, selectedProjectId],
  );

  return (
    <ObjectCreateDrawer
      open={taskDialogOpen}
      kind="goal"
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  );
}
