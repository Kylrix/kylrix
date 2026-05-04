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
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import { Task, Priority } from '@/types';

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
}

const DayCell = React.memo(function DayCell({ date, tasks, isCurrentMonth, onTaskClick, onAddTask }: DayCellProps) {
  const theme = useTheme();
  const today = isToday(date);
  const maxVisible = 3;
  const visibleTasks = tasks.slice(0, maxVisible);
  const moreCount = tasks.length - maxVisible;
  const hasTasks = tasks.length > 0;

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
            {format(date, 'd')}
          </Typography>
          {hasTasks && !today && (
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
        {visibleTasks.map((task) => (
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
              }}
            >
              {task.title}
            </Typography>
          </Box>
        ))}
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

  const { days, tasksByDate, monthTasks, completedMonthTasks } = React.useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const daysInterval = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    const byDate: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (task.dueDate && !task.isArchived) {
        const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
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
            {format(currentDate, 'MMMM yyyy')}
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
            const dateKey = format(day, 'yyyy-MM-dd');
            return (
              <DayCell
                key={day.toISOString()}
                date={day}
                tasks={tasksByDate[dateKey] || []}
                isCurrentMonth={isSameMonth(day, currentDate)}
                onTaskClick={handleTaskClick}
                onAddTask={handleAddTask}
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
    </Box>
  );
}


