'use client';

import React, { useState } from 'react';
import {
  Box,
  Checkbox,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Flag as FlagIcon,
  AccessTime as ScheduleIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  List as SubtaskIcon,
  ChatBubbleOutline as CommentIcon,
  Archive as ArchiveIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useMediaQuery, useTheme } from '@mui/material';
import { format, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns';
import { Task, Priority } from '@/types';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';

interface TaskItemProps {
  task: Task;
  onClick?: () => void;
  compact?: boolean;
}

const priorityColors: Record<Priority, string> = {
  low: '#A1A1AA',
  medium: '#10B981',
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { completeTask, deleteTask, updateTask, labels, projects, selectTask } = useTask();
  const { openSecondarySidebar } = useLayout();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const project = projects.find((p) => p.id === task.projectId);
  const taskLabels = labels.filter((l) => task.labels.includes(l.id));
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleComplete = (event: React.MouseEvent) => {
    event.stopPropagation();
    completeTask(task.id);
  };

  const handleDelete = () => {
    handleMenuClose();
    deleteTask(task.id);
  };

  const handleArchive = () => {
    handleMenuClose();
    updateTask(task.id, { isArchived: true });
  };

  const formatDueDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d');
  };

  const getDueDateColor = () => {
    if (!task.dueDate) return '#A1A1AA';
    if (task.status === 'done') return '#10b981';
    if (isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate))) return '#ef4444';
    if (isToday(new Date(task.dueDate))) return '#f59e0b';
    return '#A1A1AA';
  };

  return (
    <>
      <Box
        onClick={() => {
          selectTask(task.id);
          openSecondarySidebar('task', task.id);
          onClick?.();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          p: compact || isMobile ? 1.5 : 2.5,
          mb: 1.5,
          cursor: 'pointer',
          borderRadius: 3,
          backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
          border: '1px solid',
          borderColor: isHovered ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          opacity: task.status === 'done' ? 0.6 : 1,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          '&:hover': {
            transform: isMobile ? 'none' : 'translateY(-2px)',
            boxShadow: '0 12px 24px rgba(0, 0, 0, 0.4)',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '25%',
            bottom: '25%',
            width: 3,
            borderRadius: '0 4px 4px 0',
            backgroundColor: priorityColors[task.priority],
            opacity: isHovered || isMobile ? 1 : 0.4,
            transition: 'all 0.3s',
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 1.5 : 2 }}>
          {/* Checkbox */}
          <Checkbox
            checked={task.status === 'done'}
            onClick={handleComplete}
            sx={{
              p: 0,
              mt: 0.25,
              color: 'rgba(255, 255, 255, 0.1)',
              '&.Mui-checked': {
                color: '#10B981',
              },
              '&:hover': {
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
              }
            }}
          />

          {/* Main Content */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                {/* Title */}
                <Typography
                    variant="body1"
                    sx={{
                        fontWeight: 700,
                        fontSize: isMobile ? '0.9rem' : '1rem',
                        color: task.status === 'done' ? 'text.disabled' : '#F2F2F2',
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {task.title}
                </Typography>

                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {/* Indicators */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 1.5, mr: 1 }}>
                        {totalSubtasks > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.4 }}>
                            <SubtaskIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>{completedSubtasks}/{totalSubtasks}</Typography>
                        </Box>
                        )}
                        {!isMobile && task.comments.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.4 }}>
                            <CommentIcon sx={{ fontSize: 13 }} />
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>{task.comments.length}</Typography>
                        </Box>
                        )}
                    </Box>

                    {/* Menu Trigger */}
                    <IconButton 
                        size="small" 
                        onClick={handleMenuClick}
                        sx={{ 
                            p: 0.5, 
                            color: 'text.disabled',
                            opacity: isHovered || isMobile ? 1 : 0,
                            transition: 'opacity 0.2s',
                            '&:hover': { color: '#F2F2F2' }
                        }}
                    >
                        <MoreIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            </Box>

            {/* Description (if not compact and not mobile) */}
            {!compact && !isMobile && task.description && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  mb: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {task.description}
              </Typography>
            )}

            {/* Meta Footer */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: isMobile ? 1.5 : 2,
              }}
            >
              {/* Project Badge */}
              {project && project.id !== 'inbox' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: project.color }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em', fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                        {project.name.toUpperCase()}
                    </Typography>
                </Box>
              )}

              {/* Priority Indicator */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                   <FlagIcon sx={{ fontSize: 12, color: priorityColors[task.priority] }} />
                   <Typography variant="caption" sx={{ color: priorityColors[task.priority], fontWeight: 800, fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                        {priorityLabels[task.priority]}
                   </Typography>
              </Box>

              {/* Deadline */}
              {task.dueDate && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <ScheduleIcon sx={{ fontSize: 12, color: getDueDateColor() }} />
                  <Typography variant="caption" sx={{ color: getDueDateColor(), fontWeight: 800, fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                    {formatDueDate(new Date(task.dueDate)).toUpperCase()}
                  </Typography>
                </Box>
              )}

              {/* Space for labels if any */}
              {taskLabels.length > 0 && !isMobile && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {taskLabels.slice(0, 2).map(l => (
                          <Box key={l.id} sx={{ height: 4, width: 12, borderRadius: 2, bgcolor: l.color, opacity: 0.6 }} />
                      ))}
                  </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { 
            minWidth: 180, 
            borderRadius: 2,
            backgroundColor: '#0F0D0C',
            border: '1px solid #222222',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          },
        }}
      >
        <MenuItem onClick={() => { 
          selectTask(task.id); 
          openSecondarySidebar('task', task.id);
          handleMenuClose(); 
        }}>
          <ListItemIcon><EditIcon sx={{ fontSize: 16, color: '#A1A1AA' }} /></ListItemIcon>
          <ListItemText primary="Edit Task" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><CopyIcon sx={{ fontSize: 16, color: '#A1A1AA' }} /></ListItemIcon>
          <ListItemText primary="Duplicate" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleArchive}>
          <ListItemIcon><ArchiveIcon sx={{ fontSize: 16, color: '#A1A1AA' }} /></ListItemIcon>
          <ListItemText primary="Archive" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
        </MenuItem>
        <Box sx={{ my: 0.5, height: '1px', backgroundColor: '#222222' }} />
        <MenuItem onClick={handleDelete} sx={{ color: '#ef4444' }}>
          <ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: '#ef4444' }} /></ListItemIcon>
          <ListItemText primary="Delete" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
      </Menu>
    </>
  );
});
