'use client';

import React, { useMemo } from 'react';
import TaskDetails from '@/components/tasks/TaskDetails';
import { ObjectDetailHost } from '@/components/objects/ObjectDetailHost';
import { goalToDetail } from '@/lib/objects/adapters';
import { useTask } from '@/context/TaskContext';

type Props = {
  taskId: string;
  onClose?: () => void;
  embedded?: boolean;
};

/** Unified goal detail — panel shell + TaskDetails (keeps editor chrome). */
export function GoalObjectDetail({ taskId, onClose, embedded = false }: Props) {
  const { tasks } = useTask();
  const task = useMemo(() => tasks.find((t) => t.id === taskId), [taskId, tasks]);
  const item = useMemo(
    () =>
      task
        ? goalToDetail(task)
        : { kind: 'goal' as const, id: taskId, title: 'Goal' },
    [task, taskId],
  );

  const body = (
    <TaskDetails taskId={taskId} onBack={embedded ? undefined : onClose} />
  );

  return (
    <ObjectDetailHost item={item} open onClose={onClose || (() => {})} embedded={embedded} chrome="panel">
      {body}
    </ObjectDetailHost>
  );
}
