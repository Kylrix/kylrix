'use client';

import React, { useState } from 'react';
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
  UserPlus as AssignIcon
} from 'lucide-react';
import { formatTime, isToday, isTomorrow, isPast, isThisWeek } from '@/lib/time-util';
import { Task, Priority } from '@/types';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import { useSection } from '@/context/SectionContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { usePresence } from '@/components/providers/PresenceProvider';
import { FlowPresenceFlapOver } from '@/components/LinkRenderer';

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
  const { completeTask, deleteTask, updateTask, labels, projects, selectTask, togglePinTask } = useTask();
  const { openSecondarySidebar } = useLayout();
  const { setActiveDetail } = useSection();
  const { openCallLauncher } = useCallLauncher();
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const [anchorEl, setAnchorEl] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFlapOverOpen, setIsFlapOverOpen] = useState(false);
  const { resourcePresence } = usePresence();

  const activeTeammates = resourcePresence[task.id] || [];
  const projectTeammates = task.projectId ? (resourcePresence[task.projectId] || []) : [];
  const hasPresence = activeTeammates.length > 0 || projectTeammates.length > 0;

  const project = projects.find((p) => p.id === task.projectId);
  const taskLabels = labels.filter((l) => task.labels.includes(l.id));
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(!anchorEl);
  };

  const handleMenuClose = () => {
    setAnchorEl(false);
  };

  const handleComplete = (event: React.MouseEvent) => {
    event.stopPropagation();
    completeTask(task.id);
  };

  const handleDelete = () => {
    handleMenuClose();
    openUnified('delete-confirm', {
      title: `Delete goal: "${task.title}"?`,
      description: 'This will permanently remove this goal and all its subtasks, comments, and history from your domain.',
      resourceName: 'this goal',
      confirmLabel: 'Delete Goal',
      onConfirm: async () => {
        await deleteTask(task.id);
      }
    });
  };

  const handleArchive = () => {
    handleMenuClose();
    updateTask(task.id, { isArchived: true });
  };

  const handleTogglePin = async () => {
    handleMenuClose();
    await togglePinTask(task.id);
  };

  const handleStartTaskHuddle = () => {
    handleMenuClose();
    const participantIds = Array.from(new Set([task.creatorId, ...(task.assigneeIds || [])].filter(Boolean)));
    openCallLauncher({
      source: 'task',
      taskId: task.id,
      participantIds,
      title: task.title ? `Task Huddle: ${task.title}` : 'Task Huddle',
    });
  };

  const handleAssignGoal = () => {
    handleMenuClose();
    openUnified('share-note', {
      resourceId: task.id,
      resourceType: 'goal',
      resourceTitle: task.title,
      actorName: user?.name || 'A Kylrix User'
    });
  };

  const formatDueDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return formatTime(date, { weekday: 'long' });
    return formatTime(date, { month: 'short', day: 'numeric' });
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
        } border shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9)] hover:shadow-[0_8px_10px_-8px_rgba(0,0,0,1)] hover:-translate-y-0.5 mb-3`}
        onClick={() => {
          selectTask(task.id);
          setActiveDetail({ type: 'goal', id: task.id, data: task });
          onClick?.();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Priority Left Ribbon Indicator */}
        <div 
          className="absolute left-0 top-[15%] bottom-[15%] w-1 rounded-r-md transition-all duration-400 opacity-60 group-hover:opacity-100" 
          style={{ backgroundColor: priorityColors[task.priority] }}
        />

        <div className="flex items-start gap-3 sm:gap-4 pl-1">
          {/* Checkbox */}
          <button
            type="button"
            onClick={handleComplete}
            className={`flex items-center justify-center h-5 w-5 mt-0.5 rounded border transition-all duration-200 hover:scale-115 cursor-pointer shrink-0 ${
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
            <div className="flex items-center justify-between mb-1">
              {/* Title */}
              <div 
                className={`font-satoshi font-bold text-sm sm:text-base tracking-tight truncate flex items-center gap-1.5 ${
                  task.status === 'done' ? 'text-[#9B9691] line-through' : 'text-[#F5F2ED]'
                }`}
              >
                {task.isPinned && (
                  <Pin className="h-3.5 w-3.5 text-[#F59E0B] rotate-45 shrink-0" style={{ color: '#F59E0B' }} />
                )}
                <span className="truncate">{task.title}</span>
                {hasPresence && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsFlapOverOpen(true);
                    }}
                    className="inline-block w-2 h-2 rounded-full bg-[#A1A1AA] shadow-[0_0_6px_rgba(161,161,170,0.6)] cursor-pointer animate-pulse ml-1 shrink-0"
                  />
                )}
              </div>

              <div className="flex gap-1 items-center shrink-0 relative">
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

                {/* Menu Trigger */}
                <button
                  type="button"
                  onClick={handleMenuClick}
                  className="p-1 rounded-full text-[#9B9691] hover:text-[#F5F2ED] transition-colors"
                >
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>

                {/* Dropdown Menu */}
                {anchorEl && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={handleMenuClose} />
                    <div 
                      className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[#0F0D0C] border border-[#222222] shadow-2xl py-1.5 z-50 font-satoshi text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          selectTask(task.id);
                          openSecondarySidebar('task', task.id);
                          handleMenuClose();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#9B9691] hover:bg-[#1C1A18] hover:text-white transition-colors"
                      >
                        <Edit className="h-4 w-4 text-[#A1A1AA]" />
                        <span>Edit Task</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleMenuClose}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#9B9691] hover:bg-[#1C1A18] hover:text-white transition-colors"
                      >
                        <Copy className="h-4 w-4 text-[#A1A1AA]" />
                        <span>Duplicate</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleArchive}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#9B9691] hover:bg-[#1C1A18] hover:text-white transition-colors"
                      >
                        <Archive className="h-4 w-4 text-[#A1A1AA]" />
                        <span>Archive</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleTogglePin}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#9B9691] hover:bg-[#1C1A18] hover:text-white transition-colors"
                      >
                        <Pin className={`h-4 w-4 ${task.isPinned ? 'text-[#F59E0B]' : 'text-[#A1A1AA]'}`} />
                        <span>{task.isPinned ? "Unpin Goal" : "Pin Goal"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAssignGoal}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#9B9691] hover:bg-[#1C1A18] hover:text-white transition-colors"
                      >
                        <AssignIcon className="h-4 w-4 text-[#A1A1AA]" />
                        <span>Assign Goal</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStartTaskHuddle}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#9B9691] hover:bg-[#1C1A18] hover:text-white transition-colors"
                      >
                        <Video className="h-4 w-4 text-[#A1A1AA]" />
                        <span>Start Huddle</span>
                      </button>
                      <div className="my-1 border-t border-[#222222]" />
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#ef4444] hover:bg-red-500/5 transition-colors font-semibold"
                      >
                        <Trash2 className="h-4 w-4 text-[#ef4444]" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </>
                )}
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
                  {taskLabels.slice(0, 2).map((l) => (
                    <span key={l.id} className="h-1.5 w-4 rounded-full opacity-60" style={{ backgroundColor: l.color }} />
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
    </>
  );
});
