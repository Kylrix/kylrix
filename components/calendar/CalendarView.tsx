'use client';

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Chip,
  useTheme,
  alpha,
} from '@/lib/mui-tailwind/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Add as AddIcon,
} from '@/lib/mui-tailwind/icons';
import {
  formatTime,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from '@/lib/time-util';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import { Task, Priority } from '@/types';
import { usePresence } from '@/components/providers/PresenceProvider';
import { FlowPresenceFlapOver } from '@/components/LinkRenderer';

const priorityColors: Record<Priority, string> = {
  low: '#94a3b8',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

interface DayCellProps {
  date: Date;
  tasks: Task[];
  isCurrentMonth: boolean;
  onTaskClick: (taskId: string) => void;
  onAddTask: (date: Date) => void;
  onHuddleDoubleClick: (task: Task) => void;
}

const DayCell = React.memo(function DayCell({
  date,
  tasks,
  isCurrentMonth,
  onTaskClick,
  onAddTask,
  onHuddleDoubleClick,
}: DayCellProps) {
  const theme = useTheme();
  const { resourcePresence } = usePresence();
  const today = isToday(date);
  const maxVisible = 3;
  const visibleTasks = tasks.slice(0, maxVisible);
  const moreCount = tasks.length - maxVisible;
  const hasTasks = tasks.length > 0;

  // Resolve presence across all tasks in this cell from Data Nexus presence cache
  const tasksWithPresence = tasks.filter(t => (resourcePresence[t.id] || []).length > 0);
  const cellHasPresence = tasksWithPresence.length > 0;
  const totalCellParticipants = tasksWithPresence.reduce(
    (acc, t) => acc + (resourcePresence[t.id] || []).length,
    0
  );

  return (
    <Box
      sx={{
        minHeight: 110,
        p: 1,
        borderRight: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: !isCurrentMonth
          ? alpha(theme.palette.text.primary, 0.02)
          : today 
            ? alpha('#10B981', 0.04)
            : 'transparent',
        transition: 'all 0.2s ease',
        position: 'relative',
        '&:hover': {
          backgroundColor: alpha('#10B981', 0.06),
          '& .add-task-btn': {
            opacity: 1,
          },
        },
      }}
    >
      {/* Today indicator line */}
      {today && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, #10B981, ${alpha('#10B981', 0.3)})`,
          }}
        />
      )}
      
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 0.75,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="body2"
            sx={{
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              fontWeight: today ? 700 : isCurrentMonth ? 500 : 400,
              backgroundColor: today ? '#10B981' : 'transparent',
              color: today
                ? theme.palette.primary.contrastText
                : isCurrentMonth
                ? 'text.primary'
                : 'text.disabled',
              fontSize: '0.8rem',
              boxShadow: today ? `0 2px 8px ${alpha('#10B981', 0.4)}` : 'none',
            }}
          >
            {date.getDate()}
          </Typography>
          {hasTasks && !today && !cellHasPresence && (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#10B981',
                opacity: 0.6,
              }}
            />
          )}
          {cellHasPresence && (
            <Box
              component="span"
              title={`${totalCellParticipants} active huddle participant(s) (double-click to jump)`}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tasksWithPresence[0]) {
                  onHuddleDoubleClick(tasksWithPresence[0]);
                }
              }}
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#A1A1AA', // ash color
                boxShadow: '0 0 6px rgba(161, 161, 170, 0.8)',
                cursor: 'pointer',
                animation: 'ashPresencePulse 2s infinite',
                '@keyframes ashPresencePulse': {
                  '0%': {
                    boxShadow: '0 0 0 0 rgba(161, 161, 170, 0.4)',
                  },
                  '70%': {
                    boxShadow: '0 0 0 5px rgba(161, 161, 170, 0)',
                  },
                  '100%': {
                    boxShadow: '0 0 0 0 rgba(161, 161, 170, 0)',
                  }
                },
                '&:hover': {
                  backgroundColor: '#E4E4E7',
                  transform: 'scale(1.2)',
                }
              }}
            />
          )}
        </Box>
        <IconButton
          size="small"
          className="add-task-btn"
          onClick={() => onAddTask(date)}
          sx={{
            opacity: 0,
            transition: 'opacity 0.2s, background-color 0.2s',
            width: 24,
            height: 24,
            '&:hover': { 
              backgroundColor: alpha('#10B981', 0.1),
            },
          }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {visibleTasks.map((task) => {
          const activeTeammates = resourcePresence[task.id] || [];
          const hasPresence = activeTeammates.length > 0;
          return (
            <Box
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              sx={{
                py: 0.25,
                px: 0.5,
                borderRadius: 0.75,
                backgroundColor: alpha(priorityColors[task.priority], 0.12),
                borderLeft: `2px solid ${priorityColors[task.priority]}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 0.5,
                '&:hover': {
                  backgroundColor: alpha(priorityColors[task.priority], 0.2),
                  transform: 'translateX(2px)',
                },
              }}
            >
              <Typography
                variant="caption"
                noWrap
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  textDecoration: task.status === 'done' ? 'line-through' : 'none',
                  color: task.status === 'done' ? 'text.secondary' : 'text.primary',
                  opacity: task.status === 'done' ? 0.6 : 1,
                  flexGrow: 1,
                }}
              >
                {task.title}
              </Typography>
              {hasPresence && (
                <Box
                  component="span"
                  title={`${activeTeammates.length} active participant(s) in huddle (double-click to jump)`}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onHuddleDoubleClick(task);
                  }}
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#A1A1AA', // ash color
                    boxShadow: '0 0 6px rgba(161, 161, 170, 0.8)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    animation: 'ashPresencePulse 2s infinite',
                    '@keyframes ashPresencePulse': {
                      '0%': {
                        boxShadow: '0 0 0 0 rgba(161, 161, 170, 0.4)',
                      },
                      '70%': {
                        boxShadow: '0 0 0 5px rgba(161, 161, 170, 0)',
                      },
                      '100%': {
                        boxShadow: '0 0 0 0 rgba(161, 161, 170, 0)',
                      }
                    },
                    '&:hover': {
                      backgroundColor: '#E4E4E7',
                      transform: 'scale(1.2)',
                    }
                  }}
                />
              )}
            </Box>
          );
        })}
        {moreCount > 0 && (
          <Typography 
            variant="caption" 
            sx={{ 
              pl: 0.5, 
              color: '#10B981',
              fontWeight: 500,
              fontSize: '0.65rem',
            }}
          >
            +{moreCount} more
          </Typography>
        )}
      </Box>
    </Box>
  );
});

export default function CalendarView() {
  const theme = useTheme();
  const { tasks, selectTask, setTaskDialogOpen } = useTask();
  const { openSecondarySidebar } = useLayout();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Flap-over state for active WebRTC huddle sessions
  const [flapOverOpen, setFlapOverOpen] = useState(false);
  const [selectedFlapOverTask, setSelectedFlapOverTask] = useState<Task | null>(null);

  const handleHuddleDoubleClick = React.useCallback((task: Task) => {
    setSelectedFlapOverTask(task);
    setFlapOverOpen(true);
  }, []);

  const { days, tasksByDate, monthTasks, completedMonthTasks } = React.useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const daysInterval = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    const byDate: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (task.dueDate && !task.isArchived) {
        const dateKey = new Date(task.dueDate).toISOString().split('T')[0];
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(task);
      }
    });

    const mTasks = tasks.filter((task) => {
      if (!task.dueDate || task.isArchived) return false;
      const dueDate = new Date(task.dueDate);
      return isSameMonth(dueDate, currentDate);
    });

    const cMTasks = mTasks.filter((t) => t.status === 'done');

    return {
      days: daysInterval,
      tasksByDate: byDate,
      monthTasks: mTasks,
      completedMonthTasks: cMTasks
    };
  }, [currentDate, tasks]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleTaskClick = React.useCallback((taskId: string) => {
    selectTask(taskId);
    openSecondarySidebar('task', taskId);
  }, [selectTask, openSecondarySidebar]);

  const handleAddTask = React.useCallback((_date: Date) => {
    // In a real implementation, this would pre-fill the date in the task dialog
    setTaskDialogOpen(true);
  }, [setTaskDialogOpen]);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" fontWeight={700}>
            {formatTime(currentDate, { month: 'long', year: 'numeric' })}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={handlePrevMonth} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <IconButton onClick={handleNextMonth} size="small">
              <ChevronRightIcon />
            </IconButton>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TodayIcon />}
            onClick={handleToday}
          >
            Today
          </Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip label={`${monthTasks.length} tasks`} size="small" />
          <Chip
            label={`${completedMonthTasks.length} completed`}
            size="small"
            color="success"
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setTaskDialogOpen(true)}
          >
            Add Task
          </Button>
        </Box>
      </Box>

      {/* Calendar */}
      <Paper
        sx={{
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
        }}
      >
        {/* Week Days Header */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: alpha(theme.palette.text.primary, 0.02),
          }}
        >
          {weekDays.map((day) => (
            <Box
              key={day}
              sx={{
                p: 1.5,
                textAlign: 'center',
                borderRight: `1px solid ${theme.palette.divider}`,
                '&:last-child': { borderRight: 'none' },
              }}
            >
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                {day}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Calendar Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
          }}
        >
          {days.map((day) => {
            const dateKey = day.toISOString().split('T')[0];
            return (
              <DayCell
                key={day.toISOString()}
                date={day}
                tasks={tasksByDate[dateKey] || []}
                isCurrentMonth={isSameMonth(day, currentDate)}
                onTaskClick={handleTaskClick}
                onAddTask={handleAddTask}
                onHuddleDoubleClick={handleHuddleDoubleClick}
              />
            );
          })}
        </Box>
      </Paper>

      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          mt: 2,
          justifyContent: 'center',
        }}
      >
        {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((priority) => (
          <Box key={priority} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 0.5,
                backgroundColor: priorityColors[priority],
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Slide-out Flap-Over Panel */}
      {flapOverOpen && selectedFlapOverTask && (
        <FlowPresenceFlapOver
          isOpen={flapOverOpen}
          onClose={() => setFlapOverOpen(false)}
          task={selectedFlapOverTask}
          taskId={selectedFlapOverTask.id}
        />
      )}
    </Box>
  );
}
