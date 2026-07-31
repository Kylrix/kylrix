'use client';

import React, { useCallback, useMemo } from 'react';
import {
  Check,
  Pin,
  Trash2,
  Share2,
  Lock,
  Unlock,
  Bell,
  BellOff,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Task } from '@/types';
import { useTask } from '@/context/TaskContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { ObjectCard } from '@/components/objects/ObjectCard';
import { ObjectCardMeta, PRIORITY_COLORS } from '@/components/objects/ObjectCardMeta';
import { GoalObjectDetail } from '@/components/objects/GoalObjectDetail';
import { goalToCard } from '@/lib/objects/adapters';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSudo } from '@/context/SudoContext';
import { useAuth } from '@/context/auth/AuthContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import {
  getGoalShareUrlWithDek,
  isGoalLocked,
  lockGoal,
  unlockGoal,
} from '@/lib/appwrite/goal-crypto';
import { toast } from 'react-hot-toast';

type Props = {
  task: Task;
  compact?: boolean;
};

function formatDue(due?: Date | null) {
  if (!due) return null;
  try {
    return new Date(due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

/** Goal tile — uniform ObjectCard; footer = priority + colored tags (no status copy). */
export default function GoalObjectRow({ task }: Props) {
  const {
    selectTask,
    completeTask,
    togglePinTask,
    deleteTask,
    updateTask,
    toggleTaskReminder,
    labels,
  } = useTask();
  const { isPinned: isResourcePinned } = useResourcePins();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const contextMenu = useContextMenu();
  const openMenu = contextMenu?.openMenu;
  const { open: openUnified } = useUnifiedDrawer();
  const { promptSudo } = useSudo();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const isPro = hasPaidKylrixPlan(user);

  const ownerId = task.userId || task.creatorId || '';
  const pinned = isResourcePinned('task', task.id, ownerId, task.isPinned);
  const locked = isGoalLocked(task);
  const due = formatDue(task.dueDate);
  const reminded = !!task.scheduled;

  const tagColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const label of labels || []) {
      if (label?.name) map[label.name] = label.color || '';
    }
    return map;
  }, [labels]);

  const openDetail = useCallback(() => {
    selectTask(task.id);
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
    if (isDesktop) {
      openSidebar(
        <GoalObjectDetail taskId={task.id} embedded onClose={closeSidebar} />,
        task.id,
        { hideHeader: true, fullscreen: true });
    } else {
      openOverlay(
        <GoalObjectDetail taskId={task.id} onClose={closeOverlay} embedded />);
    }
  }, [closeOverlay, closeSidebar, openOverlay, openSidebar, selectTask, task.id]);

  const handleComplete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await completeTask(task.id);
    },
    [completeTask, task.id]);

  const handlePinToggle = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      try {
        await togglePinTask(task.id);
      } catch (err: any) {
        if (String(err?.message || '').includes('limit')) {
          toast.error('Pin limit reached');
          return;
        }
        toast.error(err?.message || 'Failed to update pin');
      }
    },
    [task.id, togglePinTask]);

  const openCollaborators = useCallback(() => {
    openUnified('share-note', {
      resourceType: 'goal',
      noteId: task.id,
      noteTitle: task.title || 'Untitled goal',
    });
  }, [openUnified, task.id, task.title]);

  const openDelete = useCallback(() => {
    openUnified('delete-confirm', {
      title: `Delete "${task.title || 'Untitled goal'}"?`,
      resourceName: 'this goal',
      confirmLabel: 'Delete Goal',
      onConfirm: async () => {
        await deleteTask(task.id);
      },
    });
  }, [deleteTask, openUnified, task.id, task.title]);

  const handleLockToggle = useCallback(async () => {
    const run = async () => {
      try {
        const updated = locked ? await unlockGoal(task.id) : await lockGoal(task.id);
        updateTask(task.id, {
          title: updated.title,
          description: updated.description,
          dek: updated.dek || null,
        } as Partial<Task>);
        toast.success(locked ? 'Goal unlocked' : 'Goal locked');
      } catch (err: any) {
        if (err?.message === 'VAULT_LOCKED') {
          toast.error('Unlock vault to change lock state');
          const unlocked = await promptSudo();
          if (unlocked) await run();
          return;
        }
        toast.error(err?.message || 'Failed to toggle lock');
      }
    };
    await run();
  }, [locked, promptSudo, task.id, updateTask]);

  const handleRemindToggle = useCallback(async () => {
    try {
      await toggleTaskReminder(task.id, !reminded);
      toast.success(reminded ? 'Reminder off' : 'Reminder on');
    } catch (err: any) {
      toast.error(err?.message || 'Could not update reminder');
    }
  }, [reminded, task.id, toggleTaskReminder]);

  const handleCopyShareLink = useCallback(async () => {
    try {
      if (!(task.isPublic || task.isGuest)) {
        const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
        const res = await toggleResourcePublicGuest({
          resourceType: 'goal',
          resourceId: task.id,
          mode: 'publish',
        });
        if (!res?.success) {
          toast.error('Failed to publish goal');
          return;
        }
        updateTask(task.id, { isPublic: true, isGuest: true });
      }
      const url = await getGoalShareUrlWithDek(task.id, task.dek);
      await navigator.clipboard.writeText(url);
      toast.success(locked ? 'Public link copied with key' : 'Public link copied');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to copy share link');
    }
  }, [locked, task.dek, task.id, task.isGuest, task.isPublic, updateTask]);

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'goal',
    resourceId: task.id,
    isPublic: !!task.isPublic,
    isGuest: !!task.isGuest,
    resourceTitle: task.title || 'Untitled goal',
    resolveShareUrl: async () => getGoalShareUrlWithDek(task.id, task.dek),
    onUpdate: (updatedFields) => {
      if (updatedFields) {
        updateTask(task.id, updatedFields);
      }
    },
  });

  const contextMenuItems = useMemo(
    () => [
      {
        label: pinned ? 'Unpin' : 'Pin',
        icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#A855F7]' : ''} />,
        onClick: () => {
          void handlePinToggle();
        },
      },
      {
        label: 'Copy Public Link',
        icon: <Share2 size={16} className="text-emerald-500" />,
        onClick: () => {
          void handleCopyShareLink();
        },
      },
      ...accessControlItems,
      {
        label: locked ? 'Unlock' : 'Lock',
        icon: locked ? <Unlock size={16} /> : <Lock size={16} />,
        onClick: () => {
          void handleLockToggle();
        },
      },
      {
        label: reminded ? 'Stop Reminder' : 'Remind',
        icon: reminded ? <BellOff size={16} /> : <Bell size={16} />,
        onClick: () => {
          void handleRemindToggle();
        },
      },
      ...(isPro
        ? [
            {
              label: 'Kylie Assist',
              icon: <Sparkles size={16} className="text-[#A855F7]" />,
              onClick: () => {
                openUnified('agentic');
              },
            },
            {
              label: 'Integrate',
              icon: <FileText size={16} className="text-[#3B82F6]" />,
              submenu: [
                {
                  label: 'Convert to Idea',
                  icon: <FileText size={16} className="text-[#3B82F6]" />,
                  onClick: async () => {
                    try {
                      const { createNote } = await import('@/lib/appwrite');
                      await createNote({
                        title: locked ? 'Goal' : task.title || 'Untitled goal',
                        content: locked ? '' : task.description || '',
                        tags: ['from:goal'],
                      } as any);
                      toast.success('Idea created from goal');
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to create idea');
                    }
                  },
                },
              ],
            },
          ]
        : [
            {
              label: 'Kylie Assist',
              icon: <Sparkles size={16} className="text-[#A855F7]" />,
              onClick: () => openProUpgrade('Kylie Assist'),
            },
          ]),
      {
        label: 'Collaborators',
        icon: <Share2 size={16} />,
        onClick: openCollaborators,
      },
      {
        label: 'Delete',
        icon: <Trash2 size={16} className="text-red-500" />,
        variant: 'destructive' as const,
        onClick: openDelete,
      },
    ],
    [
      accessControlItems,
      handleCopyShareLink,
      handleLockToggle,
      handlePinToggle,
      handleRemindToggle,
      isPro,
      locked,
      openCollaborators,
      openDelete,
      openProUpgrade,
      openUnified,
      pinned,
      reminded,
      task.description,
      task.id,
      task.title,
    ],
  );

  const handleRightClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      if (!openMenu) return;
      const clientX = 'clientX' in e ? e.clientX : 0;
      const clientY = 'clientY' in e ? e.clientY : 0;
      openMenu({
        x: clientX,
        y: clientY,
        items: contextMenuItems,
        appType: 'flow',
      });
    },
    [contextMenuItems, openMenu],
  );

  const item = useMemo(() => {
    const base = goalToCard(task);
    return {
      ...base,
      title: locked ? 'Locked' : base.title,
      isPinned: pinned,
      accent: null,
      subtitle: locked
        ? 'Locked goal'
        : (task.description || '').trim().slice(0, 120) || undefined,
    };
  }, [task, pinned, locked]);

  return (
    <ObjectCard
      item={item}
      variant="task"
      density="uniform"
      railColor={PRIORITY_COLORS[task.priority || 'medium']}
      onOpen={openDetail}
      onContextMenu={handleRightClick}
      leading={
        <button
          type="button"
          onClick={handleComplete}
          aria-label={task.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
            task.status === 'done'
              ? 'border-[#A855F7] bg-[#A855F7] text-[#0A0908]'
              : 'border-[#4A4744] text-transparent hover:border-[#A855F7]'
          }`}
        >
          {task.status === 'done' ? <Check className="h-3 w-3 stroke-[3]" /> : null}
        </button>
      }
      trailing={
        <>
          <button
            type="button"
            onClick={handlePinToggle}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              pinned
                ? 'text-[#A855F7] bg-[#A855F7]/10'
                : 'text-white/25 hover:text-[#A855F7] hover:bg-[#A855F7]/10'
            }`}
            title={pinned ? 'Unpin' : 'Pin'}
            aria-label={pinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={15} className={pinned ? 'fill-[#A855F7]' : ''} />
          </button>
          <ShareLockButton
            resourceType="goal"
            resourceId={task.id}
            isPublic={!!task.isPublic}
            isGuest={!!task.isGuest}
            accentColor="#A855F7"
            getCustomShareUrl={() => getGoalShareUrlWithDek(task.id, task.dek)}
            onPublished={({ isPublic, isGuest }) => {
              updateTask(task.id, { isPublic, isGuest });
            }}
          />
        </>
      }
      footer={
        <ObjectCardMeta
          priority={task.priority || 'medium'}
          tags={task.labels || []}
          tagColors={tagColors}
          dueLabel={due}
        />
      }
    />
  );
}
