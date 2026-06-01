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
  VideoCall as VideoCallIcon,
  PushPin as PinIcon,
} from '@mui/icons-material';
import { useMediaQuery, useTheme } from '@mui/material';
import { format, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns';
import { Task, Priority } from '@/types';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import { useSection } from '@/context/SectionContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { UserPlus as AssignIcon } from 'lucide-react';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { completeTask, deleteTask, updateTask, labels, projects, selectTask, togglePinTask } = useTask();
  const { openSecondarySidebar } = useLayout();
  const { setActiveDetail } = useSection();
  const { openCallLauncher } = useCallLauncher();
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d');
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
      <Box
        className="task-list-item"
        onClick={() => {
          selectTask(task.id);
          setActiveDetail({ type: 'goal', id: task.id, data: task });
          onClick?.();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          p: compact || isMobile ? 2 : 2.5,
          mb: 1.5,
          cursor: 'pointer',
          borderRadius: '24px',
          backgroundColor: compact
            ? (isHovered ? '#22201E' : '#1C1A18')
            : (isHovered ? '#1C1A18' : '#161412'),
          border: '1px solid',
          borderColor: compact
            ? (isHovered ? '#3E3C3A' : '#2C2A28')
            : (isHovered ? '#34322F' : '#1C1A18'),
          opacity: task.status === 'done' ? 0.6 : 1,
          boxShadow: isHovered
            ? '0 8px 10px -8px rgba(0,0,0,1), 0 6px 8px -6px rgba(37,35,33,1.0)'
            : '0 4px 4px -4px rgba(0,0,0,0.9), 0 2px 3px -3px rgba(37,35,33,0.9)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          '&:hover': {
            transform: isMobile ? 'none' : 'translateY(-2px)',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '15%',
            bottom: '15%',
            width: 4,
            borderRadius: '0 4px 4px 0',
            backgroundColor: priorityColors[task.priority],
            opacity: isHovered || isMobile ? 1 : 0.6,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
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
              color: '#34322F',
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&.Mui-checked': {
                color: '#A855F7',
              },
              '&:hover': {
                backgroundColor: 'transparent',
                transform: 'scale(1.15)',
              }
            }}
          />

          {/* Main Content */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                {/* Title */}
                <Typography 
                    variant="body1"
                    sx={{
                        fontFamily: 'var(--font-satoshi)',
                        fontWeight: 700,
                        fontSize: isMobile ? '0.95rem' : '1.05rem',
                        color: task.status === 'done' ? '#9B9691' : '#F5F2ED',
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}
                >
                    {task.isPinned && <PinIcon sx={{ fontSize: 14, color: '#F59E0B', transform: 'rotate(45deg)' }} />}
                    {task.title}
                    {hasPresence && (
                      <Box
                        component="span"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setIsFlapOverOpen(true);
                        }}
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#A1A1AA', // ash color
                          boxShadow: '0 0 6px rgba(161, 161, 170, 0.6)',
                          display: 'inline-block',
                          ml: 1,
                          cursor: 'pointer',
                          animation: 'ashPresencePulse 2s infinite',
                          '@keyframes ashPresencePulse': {
                            '0%': {
                              boxShadow: '0 0 0 0 rgba(161, 161, 170, 0.4)',
                            },
                            '70%': {
                              boxShadow: '0 0 0 6px rgba(161, 161, 170, 0)',
                            },
                            '100%': {
                              boxShadow: '0 0 0 0 rgba(161, 161, 170, 0)',
                            }
                          }
                        }}
                      />
                    )}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {/* Indicators */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 1.5, mr: 1 }}>
                        {totalSubtasks > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#9B9691', opacity: 0.8 }}>
                            <SubtaskIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{completedSubtasks}/{totalSubtasks}</Typography>
                        </Box>
                        )}
                        {!isMobile && task.comments.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#9B9691', opacity: 0.8 }}>
                            <CommentIcon sx={{ fontSize: 13 }} />
                            <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{task.comments.length}</Typography>
                        </Box>
                        )}
                    </Box>

                    {/* Menu Trigger */}
                    <IconButton 
                        size="small" 
                        onClick={handleMenuClick}
                        sx={{ 
                            p: 0.5, 
                            color: '#9B9691',
                            opacity: isHovered || isMobile ? 1 : 0,
                            transition: 'opacity 0.2s',
                            '&:hover': { color: '#F5F2ED' }
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
                  fontFamily: 'var(--font-satoshi)',
                  color: '#9B9691',
                  fontSize: '0.875rem',
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
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    bgcolor: compact ? '#2C2A28' : '#1C1A18',
                    border: '1px solid',
                    borderColor: compact ? '#3E3C3A' : '#2C2A28',
                    borderRadius: '8px',
                    px: 1,
                    py: 0.25
                  }}
                >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: project.color }} />
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700, 
                        color: '#9B9691', 
                        letterSpacing: '0.05em', 
                        fontSize: isMobile ? '0.65rem' : '0.7rem' 
                      }}
                    >
                        {project.name.toUpperCase()}
                    </Typography>
                </Box>
              )}

              {/* Priority Indicator */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.75,
                  bgcolor: compact ? '#2C2A28' : '#1C1A18',
                  border: '1px solid',
                  borderColor: compact ? '#3E3C3A' : '#2C2A28',
                  borderRadius: '8px',
                  px: 1,
                  py: 0.25
                }}
              >
                   <FlagIcon sx={{ fontSize: 12, color: priorityColors[task.priority] }} />
                   <Typography 
                     variant="caption" 
                     sx={{ 
                       fontFamily: 'var(--font-mono)',
                       color: priorityColors[task.priority], 
                       fontWeight: 700, 
                       fontSize: isMobile ? '0.65rem' : '0.7rem' 
                     }}
                   >
                        {priorityLabels[task.priority]}
                   </Typography>
              </Box>

              {/* Deadline */}
              {task.dueDate && (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.75,
                    bgcolor: compact ? '#2C2A28' : '#1C1A18',
                    border: '1px solid',
                    borderColor: compact ? '#3E3C3A' : '#2C2A28',
                    borderRadius: '8px',
                    px: 1,
                    py: 0.25
                  }}
                >
                  <ScheduleIcon sx={{ fontSize: 12, color: getDueDateColor() }} />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontFamily: 'var(--font-mono)',
                      color: getDueDateColor(), 
                      fontWeight: 700, 
                      fontSize: isMobile ? '0.65rem' : '0.7rem' 
                    }}
                  >
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
        <MenuItem onClick={handleTogglePin}>
          <ListItemIcon><PinIcon sx={{ fontSize: 16, color: task.isPinned ? '#F59E0B' : '#A1A1AA' }} /></ListItemIcon>
          <ListItemText primary={task.isPinned ? "Unpin Goal" : "Pin Goal"} primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleAssignGoal}>
          <ListItemIcon><AssignIcon size={16} color="#A1A1AA" /></ListItemIcon>
          <ListItemText primary="Assign Goal" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleStartTaskHuddle}>
          <ListItemIcon><VideoCallIcon sx={{ fontSize: 16, color: '#A1A1AA' }} /></ListItemIcon>
          <ListItemText primary="Start Huddle" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
        </MenuItem>
        <Box sx={{ my: 0.5, height: '1px', backgroundColor: '#222222' }} />
        <MenuItem onClick={handleDelete} sx={{ color: '#ef4444' }}>
          <ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: '#ef4444' }} /></ListItemIcon>
          <ListItemText primary="Delete" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
      </Menu>

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
