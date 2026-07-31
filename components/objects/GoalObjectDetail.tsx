'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import TaskDetails from '@/components/tasks/TaskDetails';
import { ObjectDetailHost } from '@/components/objects/ObjectDetailHost';
import { goalToDetail } from '@/lib/objects/adapters';
import { useTask } from '@/context/TaskContext';
import { isGoalLocked, decryptGoalForView } from '@/lib/appwrite/goal-crypto';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';

type Props = {
  taskId: string;
  onClose?: () => void;
  embedded?: boolean;
};

/** Unified goal detail — panel shell + TaskDetails (keeps editor chrome). */
export function GoalObjectDetail({ taskId, onClose, embedded = false }: Props) {
  const { tasks, updateTask } = useTask();
  const { promptSudo } = useSudo();
  const { closeSidebar } = useDynamicSidebar();
  const { closeOverlay } = useOverlay();
  const task = useMemo(() => tasks.find((t) => t.id === taskId), [taskId, tasks]);
  const decryptedIdRef = useRef<string | null>(null);

  const handleClose = useCallback(() => {
    onClose?.();
    closeSidebar();
    closeOverlay();
  }, [onClose, closeSidebar, closeOverlay]);

  // Session decrypt for viewing: updates local task fields but autosave skips
  // title/description while `dek` remains set, so ciphertext on the server is safe.
  useEffect(() => {
    if (!task || !isGoalLocked(task)) return;
    if (decryptedIdRef.current === task.id && (task as any)._dekViewDecrypted) return;

    if (!ecosystemSecurity.status.isUnlocked) {
      void promptSudo();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const plain = await decryptGoalForView(task);
        if (cancelled) return;
        decryptedIdRef.current = task.id;
        updateTask(task.id, {
          title: plain.title,
          description: plain.description,
          dek: task.dek,
          _dekViewDecrypted: true,
        } as any);
      } catch (err: any) {
        if (err?.message === 'VAULT_LOCKED') await promptSudo();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [task, updateTask, promptSudo]);

  const item = useMemo(
    () =>
      task
        ? goalToDetail(task)
        : { kind: 'goal' as const, id: taskId, title: 'Goal' },
    [task, taskId],
  );

  return (
    <ObjectDetailHost item={item} open onClose={handleClose} embedded={embedded} chrome="panel">
      <TaskDetails taskId={taskId} onBack={handleClose} />
    </ObjectDetailHost>
  );
}
