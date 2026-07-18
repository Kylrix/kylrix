'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Flag,
  Clock,
  Edit,
  Trash2,
  MoreVertical,
  ListTodo,
  MessageSquare,
  Archive,
  Copy,
  Video,
  Pin,
  Check,
  UserPlus as AssignIcon,
  Sparkles,
  Settings,
  Tag,
  FolderKanban,
  Bell,
  ChevronLeft,
} from 'lucide-react';
import { Drawer, Box, Typography } from '@/lib/openbricks/primitives';
import { formatTime, isToday, isTomorrow, isPast, isThisWeek } from '@/lib/time-util';
import { Task, Priority } from '@/types';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import { useSection } from '@/context/SectionContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { usePresence } from '@/components/providers/PresenceProvider';
import { FlowPresenceFlapOver } from '@/components/LinkRenderer';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { ShareLockButton } from '../share/ShareLockButton';
import { useAccessControlMenuItems } from '../share/AccessControlMenuItems';
import { useToast } from '@/components/ui/Toast';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import TaskDetails from './TaskDetails';

interface TaskItemProps {
  task: Task;
  onClick?: () => void;
  compact?: boolean;
}

const priorityColors: Record<Priority, string> = {
  low: '#A1A1AA',
  medium: '#14B8A6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

const priorityLabels: Record<Priority, string> = {
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
  urgent: 'URGENT',
};

export default React.memo(function TaskItem({ task, onClick, compact = false }: TaskItemProps) {
  const {
    completeTask,
    deleteTask,
    updateTask,
    togglePinTask,
    toggleTaskReminder,
    addTask,
    labels,
    projects,
    selectTask,
    getTagFilterOptions,
  } = useTask();

  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [drawerMenuStack, setDrawerMenuStack] = useState<any[][]>([]);

  const handleToggleReminder = async () => {
    try {
      const nextScheduled = !task.scheduled;
      await toggleTaskReminder(task.id, nextScheduled);
      showSuccess(nextScheduled ? 'Reminder turned on' : 'Reminder turned off');
    } catch (err: any) {
      console.error(err);
      showError(err.message || 'Failed to toggle reminder');
    }
  };
  const { isPinned: isResourcePinned } = useResourcePins();
  const { showSuccess, showError } = useToast();
  const taskPinned = isResourcePinned('task', task.id, task.creatorId, task.isPinned);

  const handlePinToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      await togglePinTask(task.id);
      showSuccess(taskPinned ? 'Goal unpinned' : 'Goal pinned');
    } catch (err: any) {
      console.error('Failed to toggle pin:', err);
      showError(err.message || 'Failed to update pin status');
    }
  };

  const { openSecondarySidebar } = useLayout();
  const { setActiveDetail } = useSection();
  const { openCallLauncher } = useCallLauncher();
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { openSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const { openMenu } = useContextMenu();
  const { openAgenticDrawer } = useAgenticDrawer();

  const handleHireAgentClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const { createKylrixTokenOperationsClient } = await import('@/lib/sdk/token/client');
    const tokenClient = createKylrixTokenOperationsClient();
    try {
      const intentRes = await tokenClient.requestPaymentIntent(
        task.id,
        10.0,
        { taskId: task.id, title: task.title }
      );
      if (intentRes.success && intentRes.intent) {
        openAgenticDrawer({
          prompt: `Confirming payment setup for task: ${task.title}.`,
          autoRun: false
        });
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('kylrix:request-payment', {
            detail: {
              agentId: task.id,
              amount: 10.0,
              intentId: intentRes.intent.id,
              chainId: intentRes.intent.chainId
            }
          }));
        }, 500);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const [isHovered, setIsHovered] = useState(false);
  const [isFlapOverOpen, setIsFlapOverOpen] = useState(false);
  const { resourcePresence } = usePresence();

  const [isDesktop, setIsDesktop] = React.useState(true);
  React.useEffect(() => {
    const checkViewport = () => setIsDesktop(window.innerWidth >= 768);
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const activeTeammates = resourcePresence[task.id] || [];
  const projectTeammates = task.projectId ? (resourcePresence[task.projectId] || []) : [];
  const hasPresence = activeTeammates.length > 0 || projectTeammates.length > 0;

  const project = projects.find((p) => p.id === task.projectId);
  const taskLabels = useMemo(() => {
    const known = labels.filter((label) => task.labels.includes(label.name));
    const knownNames = new Set(known.map((label) => label.name));
    const orphans = task.labels
      .filter((name) => !knownNames.has(name))
      .map((name) => ({ id: name, name, color: '#9B9691' }));
    return [...known, ...orphans];
  }, [labels, task.labels]);
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  const toggleTaskTag = useCallback((tagName: string) => {
    const hasTag = task.labels.includes(tagName);
    const nextLabels = hasTag
      ? task.labels.filter((name) => name !== tagName)
      : [...task.labels, tagName];
    updateTask(task.id, { labels: nextLabels });
  }, [task.id, task.labels, updateTask]);

  const tagMenuOptions = getTagFilterOptions();

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'goal',
    resourceId: task.id,
    isPublic: !!task.isPublic,
    isGuest: !!task.isGuest,
    resourceTitle: task.title,
    onUpdate: () => {
      // Sharing flags sync via realtime subscription after access changes
    }
  });

  const contextMenuItems = useMemo(() => {
    const items = [
      ...accessControlItems,
      { 
          label: 'Synergy', 
          icon: <Sparkles size={16} className="text-[#A855F7]" />,
          submenu: [
              { 
                  label: 'Assign Goal', 
                  icon: <AssignIcon size={16} />, 
                  onClick: () => openUnified('share-note', {
                      resourceId: task.id,
                      resourceType: 'goal',
                      resourceTitle: task.title,
                      actorName: user?.name || 'A Kylrix User'
                  })
              },
              { 
                  label: 'Start Huddle', 
                  icon: <Video size={16} />, 
                  onClick: () => {
                      const participantIds = Array.from(new Set([task.creatorId, ...(task.assigneeIds || [])].filter(Boolean)));
                      openCallLauncher({
                        source: 'task',
                        taskId: task.id,
                        participantIds,
                        title: task.title ? `Task Huddle: ${task.title}` : 'Task Huddle',
                      });
                  }
              },
          ]
      },
      {
          label: 'Project',
          icon: <FolderKanban size={16} className="text-[#6366F1]" />,
          submenu: [
              {
                  label: 'Add to Project',
                  icon: <FolderKanban size={16} />,
                  onClick: () => openUnified('task-add-to-project', {
                      taskId: task.id,
                      taskTitle: task.title,
                  }),
              },
          ],
      },
      {
          label: 'Tags',
          icon: <Tag size={16} className="text-[#A855F7]" />,
          submenu: tagMenuOptions.length > 0
            ? tagMenuOptions.map((tagName) => ({
                label: tagName,
                icon: task.labels.includes(tagName)
                  ? <Check size={16} className="text-[#A855F7]" />
                  : <Tag size={14} className="opacity-30" />,
                keepOpen: true,
                onClick: () => toggleTaskTag(tagName),
              }))
            : [{ label: 'No tags available', onClick: () => undefined }],
      },
      { 
          label: 'Workflow', 
          icon: <Settings size={16} />,
          submenu: [
              { 
                  label: 'Duplicate', 
                  icon: <Copy size={16} />, 
                  onClick: () => {
                      addTask({
                          title: `${task.title} (Copy)`,
                          description: task.description,
                          status: task.status,
                          priority: task.priority,
                          projectId: task.projectId,
                          labels: task.labels,
                          dueDate: task.dueDate,
                          comments: [],
                          isPinned: false,
                          isArchived: false,
                          attachments: [],
                          reminders: [],
                          timeEntries: [],
                          subtasks: [],
                          creatorId: task.creatorId,
                          assigneeIds: task.assigneeIds || []
                      });
                  }
              },
              { 
                  label: 'Archive', 
                  icon: <Archive size={16} />, 
                  onClick: () => updateTask(task.id, { isArchived: true })
              },
          ]
      },
      { 
          label: 'Edit Goal', 
          icon: <Edit size={16} />, 
          onClick: () => {
              selectTask(task.id);
              openSecondarySidebar('task', task.id);
          }
      },
    ];

    if (task.dueDate) {
      items.push({
        label: task.scheduled ? 'Turn off reminder' : 'Turn on reminder',
        icon: task.scheduled ? <Check size={16} className="text-green-500" /> : <Bell size={16} />,
        onClick: handleToggleReminder
      } as any);
    }

    items.push({ 
        label: 'Delete', 
        icon: <Trash2 size={16} className="text-red-500" />, 
        onClick: () => openUnified('delete-confirm', {
            title: `Delete goal: "${task.title}"?`,
            description: 'This will permanently remove this goal and all its subtasks, comments, and history from your domain.',
            resourceName: 'this goal',
            confirmLabel: 'Delete Goal',
            onConfirm: async () => {
              await deleteTask(task.id);
            }
        })
    } as any);

    return items;
  }, [
    accessControlItems, 
    task.id, 
    task.title, 
    task.dueDate,
    task.scheduled,
    user?.name, 
    task.creatorId, 
    task.assigneeIds, 
    openCallLauncher, 
    openUnified, 
    tagMenuOptions, 
    toggleTaskTag, 
    addTask, 
    task.description, 
    task.status, 
    task.priority, 
    task.projectId, 
    task.labels, 
    updateTask, 
    selectTask, 
    openSecondarySidebar, 
    deleteTask,
    handleToggleReminder
  ]);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDrawerMenuStack([contextMenuItems]);
    setIsMenuDrawerOpen(true);
  };

  const handleComplete = (event: React.MouseEvent) => {
    event.stopPropagation();
    completeTask(task.id);
  };

  const formatDueDate = (date: Date) => {
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
    const timeStr = hasTime ? ' at ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
    if (isToday(date)) return `Today${timeStr}`;
    if (isTomorrow(date)) return `Tomorrow${timeStr}`;
    if (isThisWeek(date)) return formatTime(date, { weekday: 'long' }) + timeStr;
    return formatTime(date, { month: 'short', day: 'numeric' }) + timeStr;
  };

  const getDueDateColor = () => {
    if (!task.dueDate) return '#A1A1AA';
    if (task.status === 'done') return '#A855F7';
    if (isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate))) return '#ef4444';
    if (isToday(new Date(task.dueDate))) return '#f59e0b';
    return '#A1A1AA';
  };

  return (
    <>
      <div
        className={`task-list-item cursor-pointer rounded-3xl transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] relative group ${
          compact
            ? (isHovered ? 'bg-[#22201E] border-[#3E3C3A]' : 'bg-[#1C1A18] border-[#2C2A28]')
            : (isHovered ? 'bg-[#1C1A18] border-[#34322F]' : 'bg-[#161412] border-[#1C1A18]')
        } ${
          compact ? 'p-4' : 'p-4 sm:p-5'
        } ${
          task.status === 'done' ? 'opacity-60' : 'opacity-100'
        } border shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9)] hover:shadow-[0_8px_10px_-8px_rgba(0,0,0,1)] hover:-translate-y-0.5 mb-3 select-none`}
        onClick={() => {
          selectTask(task.id);
          if (isDesktop) {
            openSidebar(
              <TaskDetails taskId={task.id} />,
              task.id,
              { hideHeader: true }
            );
          } else {
            openOverlay(
              <TaskDetails taskId={task.id} onBack={closeOverlay} />
            );
          }
          onClick?.();
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Priority Left Ribbon Indicator */}
        <div 
          className="absolute left-0 top-[15%] bottom-[15%] w-1 rounded-r-md transition-all duration-400 opacity-60 group-hover:opacity-100" 
          style={{ backgroundColor: priorityColors[task.priority] }}
        />

        <div className="flex items-start gap-3 sm:gap-4 pl-1">
          {/* Checkbox (Circular Pattern) */}
          <button
            type="button"
            onClick={handleComplete}
            className={`flex items-center justify-center h-5 w-5 mt-0.5 rounded-full border transition-all duration-200 hover:scale-115 cursor-pointer shrink-0 ${
              task.status === 'done'
                ? 'border-[#A855F7] bg-[#A855F7] text-[#0A0908]'
                : 'border-[#34322F] text-[#9B9691]'
            }`}
          >
            {task.status === 'done' && (
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            )}
          </button>

          {/* Main Content */}
          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              {/* Title */}
              <div
                className={`font-satoshi font-bold text-sm sm:text-base tracking-tight flex-1 min-w-0 ${
                  task.status === 'done' ? 'text-[#9B9691] line-through' : 'text-[#F5F2ED]'
                }`}
              >
                <span className="inline-flex items-start gap-1.5 flex-wrap break-words [overflow-wrap:anywhere]">
                  {taskPinned && (
                    <Pin className="h-3.5 w-3.5 text-[#F59E0B] rotate-45 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                  )}
                  <span>{task.title}</span>
                  <SyncStatusDot resourceId={goalPendingKey(task.id)} />
                  {hasPresence && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsFlapOverOpen(true);
                      }}
                      className="inline-block w-2 h-2 rounded-full bg-[#A1A1AA] shadow-[0_0_6px_rgba(161,161,170,0.6)] cursor-pointer animate-pulse shrink-0 mt-1.5"
                    />
                  )}
                </span>
              </div>

              <div className="flex gap-0.5 items-start shrink-0 relative pt-0.5">
                {/* Indicators */}
                <div className="flex items-center gap-2 sm:gap-3 mr-1.5 text-[#9B9691] opacity-80">
                  {totalSubtasks > 0 && (
                    <div className="flex items-center gap-1">
                      <ListTodo className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs font-bold">{completedSubtasks}/{totalSubtasks}</span>
                    </div>
                  )}
                  {task.comments.length > 0 && (
                    <div className="hidden sm:flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs font-bold">{task.comments.length}</span>
                    </div>
                  )}
                </div>

                {/* Inline Actions (Pin, Lock/Link) */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={handlePinToggle}
                    className={`p-1 rounded-lg transition-all duration-200 ${taskPinned ? 'text-[#F59E0B] bg-[#F59E0B]/5' : 'text-white/20 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'}`}
                    title={taskPinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin size={16} className={taskPinned ? 'fill-[#F59E0B]' : ''} />
                  </button>

                  <button
                    type="button"
                    onClick={handleHireAgentClick}
                    className="p-1 rounded-lg text-white/20 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all duration-200"
                    title="Hire Agent"
                  >
                    <Sparkles size={16} />
                  </button>

                  <ShareLockButton 
                    resourceType="goal"
                    resourceId={task.id}
                    isPublic={!!task.isPublic}
                    isGuest={!!task.isGuest}
                    accentColor="#A855F7"
                    onPublished={({ isPublic, isGuest }) => {
                      updateTask(task.id, { isPublic, isGuest });
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            {!compact && task.description && (
              <p className="hidden sm:block text-xs sm:text-sm font-satoshi text-[#9B9691] leading-relaxed mb-3 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Meta Footer */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Project Badge */}
              {project && project.id !== 'inbox' && (
                <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 transition-colors ${
                  compact ? 'bg-[#2C2A28] border-[#3E3C3A]' : 'bg-[#1C1A18] border-[#2C2A28]'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                  <span className="font-mono font-bold text-[9px] text-[#9B9691] tracking-wider">
                    {project.name.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Priority Indicator */}
              <div className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 transition-colors ${
                compact ? 'bg-[#2C2A28] border-[#3E3C3A]' : 'bg-[#1C1A18] border-[#2C2A28]'
              }`}>
                <Flag className="h-3 w-3" style={{ color: priorityColors[task.priority] }} />
                <span className="font-mono font-bold text-[9px] tracking-wider" style={{ color: priorityColors[task.priority] }}>
                  {priorityLabels[task.priority]}
                </span>
              </div>

              {/* Deadline */}
              {task.dueDate && (
                <div className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 transition-colors ${
                  compact ? 'bg-[#2C2A28] border-[#3E3C3A]' : 'bg-[#1C1A18] border-[#2C2A28]'
                }`}>
                  <Clock className="h-3 w-3" style={{ color: getDueDateColor() }} />
                  <span className="font-mono font-bold text-[9px] tracking-wider" style={{ color: getDueDateColor() }}>
                    {formatDueDate(new Date(task.dueDate)).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Label Pills */}
              {taskLabels.length > 0 && (
                <div className="hidden sm:flex gap-1">
                  {taskLabels.slice(0, 2).map((label, idx) => (
                    <span
                      key={`${label.name}-${idx}`}
                      className="h-1.5 w-4 rounded-full opacity-60"
                      style={{ backgroundColor: label.color }}
                      title={label.name}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isFlapOverOpen && (
        <FlowPresenceFlapOver
          isOpen={isFlapOverOpen}
          onClose={() => setIsFlapOverOpen(false)}
          task={task}
          taskId={task.id}
        />
      )}

      {isMenuDrawerOpen && (
        <Drawer
          anchor="bottom"
          open={isMenuDrawerOpen}
          onClose={() => setIsMenuDrawerOpen(false)}
          PaperProps={{
            sx: {
              position: 'fixed !important',
              bottom: '0 !important',
              left: '0 !important',
              right: '0 !important',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              bgcolor: '#161412',
              borderTop: '1px solid #34322F',
              backgroundImage: 'none',
              maxWidth: 720,
              width: '100%',
              mx: 'auto',
              p: 2,
              pb: 4,
              height: '60dvh',
              pointerEvents: 'auto',
            }
          }}
          ModalProps={{
            keepMounted: false,
            disableScrollLock: false,
            disablePortal: true,
          }}
        >
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36', mx: 'auto', mb: 1 }} aria-hidden />
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 950, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', tracking: '0.05em', fontFamily: 'var(--font-mono)', mb: 1, textAlign: 'center' }}>
            Goal Actions
          </Typography>

          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1.5, 
              pointerEvents: 'auto',
              flex: 1,
              overflowY: 'auto'
            }}
          >
            {drawerMenuStack.length > 1 && (
              <button
                type="button"
                onClick={() => setDrawerMenuStack(prev => prev.slice(0, -1))}
                className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-white/50 hover:text-white transition-colors text-left"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}

            {(drawerMenuStack[drawerMenuStack.length - 1] || []).map((item: any, idx: number) => {
              const isDestructive = item.variant === 'destructive';
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (item.submenu) {
                      setDrawerMenuStack(prev => [...prev, item.submenu]);
                    } else {
                      setIsMenuDrawerOpen(false);
                      item.onClick?.();
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left cursor-pointer ${
                    isDestructive 
                      ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' 
                      : 'bg-white/[0.02] border-white/5 text-white hover:bg-white/5'
                  }`}
                >
                  {item.icon && <span className="opacity-70">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </Box>
        </Drawer>
      )}
    </>
  );
});
