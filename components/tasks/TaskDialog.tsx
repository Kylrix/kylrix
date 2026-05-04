'use client';

import React, { useState } from 'react';
import {
  Drawer,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Typography,
  Divider,
  alpha,
  Autocomplete,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import UserSearch from '@/components/UserSearch';
import { useTask } from '@/context/TaskContext';
import { Priority, TaskStatus } from '@/types';

interface User {
  id: string;
  title: string;
  subtitle: string;
  avatar?: string | null;
  profilePicId?: string | null;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#94a3b8' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export default function TaskDialog() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const {
    taskDialogOpen,
    setTaskDialogOpen,
    addTask,
    projects,
    labels,
    selectedProjectId,
    userId: creatorId,
  } = useTask();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [projectId, setProjectId] = useState(selectedProjectId || 'inbox');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<User[]>([]);

  const handleClose = () => {
    setTaskDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStatus('todo');
    setProjectId(selectedProjectId || 'inbox');
    setSelectedLabels([]);
    setDueDate(null);
    setEstimatedTime('');
    setSelectedAssignees([]);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      projectId,
      labels: selectedLabels,
      dueDate: dueDate || undefined,
      estimatedTime: estimatedTime ? parseInt(estimatedTime, 10) : undefined,
      subtasks: [],
      comments: [],
      attachments: [],
      reminders: [],
      timeEntries: [],
      assigneeIds: selectedAssignees.length > 0
        ? selectedAssignees.map(u => u.id).filter((id): id is string => id !== null)
        : creatorId && creatorId !== 'guest'
          ? [creatorId]
          : [],
      creatorId: creatorId || 'guest',
      isArchived: false,
    });

    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={taskDialogOpen}
        onClose={handleClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 'min(100vw, 640px)',
            maxWidth: '100%',
            height: isMobile ? '92dvh' : '100%',
            maxHeight: '100dvh',
            borderTopLeftRadius: isMobile ? 4 : 0,
            borderTopRightRadius: isMobile ? 4 : 0,
            backgroundImage: 'none',
            backgroundColor: '#050505',
            borderLeft: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pt: 3,
            pb: 2,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            flexShrink: 0,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: '#F2F2F2' }}>
                NEW TASK
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em' }}>
                INITIALIZE EXECUTION TRACK
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: 'text.disabled', '&:hover': { color: '#F2F2F2' } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        <Box sx={{ px: 3, py: 2, flex: 1, overflowY: 'auto' }}>
          <Box
            component="form"
            onKeyDown={handleKeyDown}
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}
          >
            {/* Title */}
            <TextField
              autoFocus
              placeholder="What's the primary objective?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: { 
                    fontSize: '1.5rem', 
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#F2F2F2',
                    padding: 0,
                    '&::placeholder': {
                        opacity: 0.3,
                    }
                },
              }}
            />

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

            {/* Description */}
            <TextField
              placeholder="Detailed parameters and context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: { 
                    fontSize: '0.95rem',
                    color: 'text.secondary',
                    lineHeight: 1.6,
                },
              }}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2, borderRadius: 3, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                {/* Project & Priority Row */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Project */}
                <FormControl variant="filled" fullWidth size="small">
                    <InputLabel sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>PROJECT</InputLabel>
                    <Select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    disableUnderline
                    sx={{ borderRadius: 2, bgcolor: 'transparent' }}
                    renderValue={(selected) => {
                        const project = projects.find(p => p.id === selected);
                        return (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project?.color }} />
                                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{project?.name}</Typography>
                            </Box>
                        );
                    }}
                    >
                    {projects.map((project) => (
                        <MenuItem key={project.id} value={project.id} sx={{ py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: project.color,
                            }}
                            />
                            <Typography sx={{ fontWeight: 500 }}>{project.name}</Typography>
                        </Box>
                        </MenuItem>
                    ))}
                    </Select>
                </FormControl>

                {/* Priority */}
                <FormControl variant="filled" fullWidth size="small">
                    <InputLabel sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>PRIORITY</InputLabel>
                    <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    disableUnderline
                    sx={{ borderRadius: 2, bgcolor: 'transparent' }}
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FlagIcon sx={{ fontSize: 16, color: priorityOptions.find(p => p.value === selected)?.color }} />
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{priorityOptions.find(p => p.value === selected)?.label.toUpperCase()}</Typography>
                        </Box>
                    )}
                    >
                    {priorityOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value} sx={{ py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <FlagIcon sx={{ fontSize: 18, color: option.color }} />
                            <Typography sx={{ fontWeight: 500 }}>{option.label}</Typography>
                        </Box>
                        </MenuItem>
                    ))}
                    </Select>
                </FormControl>
                </Box>

                {/* Due Date & Status Row */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Due Date */}
                <DatePicker
                    label="DEADLINE"
                    value={dueDate}
                    onChange={(newValue) => setDueDate(newValue)}
                    slotProps={{
                    textField: {
                        fullWidth: true,
                        variant: 'filled',
                        size: 'small',
                        InputProps: { disableUnderline: true, sx: { borderRadius: 2 } },
                        InputLabelProps: { sx: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' } }
                    },
                    }}
                />

                {/* Status */}
                <FormControl variant="filled" fullWidth size="small">
                    <InputLabel sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>STATUS</InputLabel>
                    <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    disableUnderline
                    sx={{ borderRadius: 2, bgcolor: 'transparent' }}
                    >
                    {statusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value} sx={{ py: 1.5 }}>
                            {option.label}
                        </MenuItem>
                    ))}
                    </Select>
                </FormControl>
                </Box>
            </Box>

            {/* Labels */}
            <Autocomplete
              multiple
              options={labels}
              value={labels.filter((l) => selectedLabels.includes(l.id))}
              onChange={(_, newValue) => setSelectedLabels(newValue.map((l) => l.id))}
              getOptionLabel={(option) => option.name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="TAGS"
                  variant="standard"
                  placeholder="Categorize task..."
                  InputLabelProps={{ sx: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' } }}
                  InputProps={{ ...params.InputProps, disableUnderline: true }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={option.name.toUpperCase()}
                    size="small"
                    sx={{
                      backgroundColor: alpha(option.color, 0.1),
                      color: option.color,
                      fontWeight: 800,
                      fontSize: '0.65rem',
                      borderRadius: 1,
                      border: `1px solid ${alpha(option.color, 0.2)}`,
                    }}
                  />
                ))
              }
              renderOption={(props, option) => (
                <Box
                  component="li"
                  {...props}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}
                >
                  <Box sx={{ width: 4, height: 16, borderRadius: 1, bgcolor: option.color }} />
                  <Typography sx={{ fontWeight: 500 }}>{option.name}</Typography>
                </Box>
              )}
            />

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

            {/* Assignees */}
            <UserSearch
              label="ASSIGNEES"
              selectedUsers={selectedAssignees}
              onSelect={(user) => setSelectedAssignees(prev => [...prev, user])}
              onRemove={(userId) => setSelectedAssignees(prev => prev.filter(u => u.id !== userId))}
              excludeIds={creatorId ? [creatorId] : []}
            />
          </Box>
        </Box>

        <Box sx={{ px: 3, py: 3, gap: 1, display: 'flex', borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
          <Button 
            onClick={handleClose} 
            sx={{ 
                color: 'text.secondary',
                fontWeight: 700,
                letterSpacing: '0.05em',
                fontSize: '0.75rem',
                '&:hover': { color: '#F2F2F2' }
            }}
          >
            CANCEL REQUEST
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!title.trim()}
            sx={{
                px: 3,
                py: 1.2,
                borderRadius: 2,
                fontWeight: 800,
                letterSpacing: '0.05em',
                fontSize: '0.75rem',
                bgcolor: '#6366F1',
                color: '#000',
                '&:hover': {
                    bgcolor: '#00D1D9',
                },
                '&.Mui-disabled': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.1)',
                }
            }}
          >
            CREATE TASK
          </Button>
        </Box>
      </Drawer>
    </LocalizationProvider>
  );
}
