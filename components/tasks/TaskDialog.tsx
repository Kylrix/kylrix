'use client';

import React, { useState, useEffect } from 'react';
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
  Stack,
} from '@/lib/mui-tailwind/material';
import {
  Close as CloseIcon,
  Flag as FlagIcon,
} from '@/lib/mui-tailwind/icons';
import { DatePicker } from '@/lib/mui-tailwind/date-pickers/DatePicker';
import { LocalizationProvider } from '@/lib/mui-tailwind/date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@/lib/mui-tailwind/date-pickers/AdapterDateFns';
import UserSearch from '@/components/UserSearch';
import { useTask } from '@/context/TaskContext';
import { Priority, TaskStatus } from '@/types';

import { ArrowUpRight, ChevronUp, ChevronDown } from 'lucide-react';
import { useSection } from '@/context/SectionContext';

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
  { value: 'urgent', label: 'Urgent', color: '#ef4444' }];

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' }];

export default function TaskDialog() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { setActiveDetail } = useSection();
  const [isExpanded, setIsExpanded] = useState(false);
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
  const [isHydrated, setIsHydrated] = useState(false);

  // Load draft when dialog opens
  useEffect(() => {
    if (!taskDialogOpen || typeof window === 'undefined') {
      setIsHydrated(false);
      return;
    }
    const raw = localStorage.getItem('kylrix:draft:task');
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.priority) setPriority(draft.priority);
        if (draft.status) setStatus(draft.status);
        if (draft.projectId) setProjectId(draft.projectId);
        if (draft.selectedLabels) setSelectedLabels(draft.selectedLabels);
        if (draft.dueDate) setDueDate(new Date(draft.dueDate));
        if (draft.estimatedTime) setEstimatedTime(draft.estimatedTime);
        if (draft.selectedAssignees) setSelectedAssignees(draft.selectedAssignees);
      } catch (e) {
        console.error('Failed to parse task draft', e);
      }
    }
    setIsHydrated(true);
  }, [taskDialogOpen]);

  // Save draft on fields change
  useEffect(() => {
    if (!taskDialogOpen || typeof window === 'undefined' || !isHydrated) return;
    const draft = {
      title,
      description,
      priority,
      status,
      projectId,
      selectedLabels,
      dueDate: dueDate ? dueDate.toISOString() : null,
      estimatedTime,
      selectedAssignees,
    };
    if (title.trim() || description.trim() || selectedLabels.length > 0 || selectedAssignees.length > 0) {
      localStorage.setItem('kylrix:draft:task', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kylrix:draft:task');
    }
  }, [taskDialogOpen, isHydrated, title, description, priority, status, projectId, selectedLabels, dueDate, estimatedTime, selectedAssignees]);

  const handleClose = () => {
    setTaskDialogOpen(false);
    resetForm();
    setIsExpanded(false);
    setIsHydrated(false);
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

  const handleMorphToDetail = async () => {
    if (!title.trim()) return;

    const newTask = await addTask({
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
      isPinned: false,
      isArchived: false,
    });

    if (newTask && newTask.id) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:task');
      }
      setActiveDetail({ type: 'goal', id: newTask.id });
    }
    handleClose();
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
      isPinned: false,
      isArchived: false,
    });

    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:draft:task');
    }
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
        ModalProps={{ keepMounted: false }}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 'min(100vw, 640px)',
            maxWidth: '100%',
            height: isMobile ? (isExpanded ? '100dvh' : '60dvh') : '100%',
            transition: 'height 0.3s ease-in-out',
            maxHeight: '100dvh',
            borderTopLeftRadius: isMobile ? '26px' : 0,
            borderTopRightRadius: isMobile ? '26px' : 0,
            backgroundImage: 'none',
            backgroundColor: '#161412',
            borderLeft: isMobile ? 'none' : '1px solid #1C1A18',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.9)',
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
            borderBottom: '1px solid #1C1A18',
            flexShrink: 0,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, letterSpacing: '-0.02em', color: '#F5F2ED' }}>
                NEW GOAL
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'var(--font-satoshi)', color: '#9B9691', fontWeight: 600, letterSpacing: '0.05em' }}>
                INITIALIZE EXECUTION TRACK
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {title.trim().length > 0 && (
              <IconButton onClick={handleMorphToDetail} size="small" sx={{ color: '#F59E0B', '&:hover': { color: 'white' } }} title="Go Full Detail">
                <ArrowUpRight size={20} />
              </IconButton>
            )}
            {isMobile && (
              <IconButton onClick={() => setIsExpanded(!isExpanded)} size="small" sx={{ color: '#9B9691', '&:hover': { color: '#F5F2ED' } }}>
                {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </IconButton>
            )}
            <IconButton onClick={handleClose} size="small" sx={{ color: '#9B9691', '&:hover': { color: '#F5F2ED' } }}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Stack>
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
                    fontFamily: 'var(--font-satoshi)',
                    fontSize: '1.5rem', 
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#F5F2ED',
                    padding: 0,
                    '&::placeholder': {
                        opacity: 0.3,
                    }
                },
              }}
            />

            <Divider sx={{ borderColor: '#1C1A18' }} />

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
                    fontFamily: 'var(--font-satoshi)',
                    fontSize: '0.95rem',
                    color: '#9B9691',
                    lineHeight: 1.6,
                },
              }}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2.5, borderRadius: '24px', bgcolor: '#1C1A18', border: '1px solid #2C2A28' }}>
                {/* Project & Priority Row */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Project */}
                <FormControl variant="filled" fullWidth size="small" sx={{ bgcolor: '#161412', borderRadius: '12px', border: '1px solid #2C2A28', '& .MuiFilledInput-root': { bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent' }, '&.Mui-focused': { bgcolor: 'transparent' } } }}>
                    <InputLabel sx={{ fontFamily: 'var(--font-clash)', fontSize: '0.75rem', fontWeight: 800, color: '#9B9691', letterSpacing: '0.05em' }}>PROJECT</InputLabel>
                    <Select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      disableUnderline
                      sx={{ borderRadius: '12px', bgcolor: 'transparent', color: '#F5F2ED', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}
                      renderValue={(selected) => {
                          const project = projects.find(p => p.id === selected);
                          return (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project?.color }} />
                                  <Typography sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.9rem', fontWeight: 600, color: '#F5F2ED' }}>{project?.name}</Typography>
                              </Box>
                          );
                      }}
                    >
                    {projects.map((project) => (
                        <MenuItem key={project.id} value={project.id} sx={{ py: 1.5, fontFamily: 'var(--font-satoshi)', color: '#F5F2ED' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                              sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  backgroundColor: project.color,
                              }}
                            />
                            <Typography sx={{ fontWeight: 500, fontFamily: 'var(--font-satoshi)' }}>{project.name}</Typography>
                        </Box>
                        </MenuItem>
                    ))}
                    </Select>
                </FormControl>

                {/* Priority */}
                <FormControl variant="filled" fullWidth size="small" sx={{ bgcolor: '#161412', borderRadius: '12px', border: '1px solid #2C2A28', '& .MuiFilledInput-root': { bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent' }, '&.Mui-focused': { bgcolor: 'transparent' } } }}>
                    <InputLabel sx={{ fontFamily: 'var(--font-clash)', fontSize: '0.75rem', fontWeight: 800, color: '#9B9691', letterSpacing: '0.05em' }}>PRIORITY</InputLabel>
                    <Select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      disableUnderline
                      sx={{ borderRadius: '12px', bgcolor: 'transparent', color: '#F5F2ED', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}
                      renderValue={(selected) => (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <FlagIcon sx={{ fontSize: 16, color: priorityOptions.find(p => p.value === selected)?.color }} />
                              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: priorityOptions.find(p => p.value === selected)?.color }}>{priorityOptions.find(p => p.value === selected)?.label.toUpperCase()}</Typography>
                          </Box>
                      )}
                    >
                    {priorityOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value} sx={{ py: 1.5, fontFamily: 'var(--font-satoshi)', color: '#F5F2ED' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <FlagIcon sx={{ fontSize: 18, color: option.color }} />
                            <Typography sx={{ fontWeight: 500, fontFamily: 'var(--font-satoshi)' }}>{option.label}</Typography>
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
                        InputProps: { disableUnderline: true },
                        sx: {
                          bgcolor: '#161412',
                          borderRadius: '12px',
                          border: '1px solid #2C2A28',
                          '& .MuiFilledInput-root': { bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent' }, '&.Mui-focused': { bgcolor: 'transparent' } },
                          '& .MuiInputLabel-root': { fontFamily: 'var(--font-clash)', fontSize: '0.75rem', fontWeight: 800, color: '#9B9691', letterSpacing: '0.05em' },
                          '& .MuiInputBase-input': { fontFamily: 'var(--font-satoshi)', fontWeight: 600, color: '#F5F2ED' }
                        }
                    },
                    }}
                />

                {/* Status */}
                <FormControl variant="filled" fullWidth size="small" sx={{ bgcolor: '#161412', borderRadius: '12px', border: '1px solid #2C2A28', '& .MuiFilledInput-root': { bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent' }, '&.Mui-focused': { bgcolor: 'transparent' } } }}>
                    <InputLabel sx={{ fontFamily: 'var(--font-clash)', fontSize: '0.75rem', fontWeight: 800, color: '#9B9691', letterSpacing: '0.05em' }}>STATUS</InputLabel>
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      disableUnderline
                      sx={{ borderRadius: '12px', bgcolor: 'transparent', color: '#F5F2ED', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}
                    >
                    {statusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value} sx={{ py: 1.5, fontFamily: 'var(--font-satoshi)', color: '#F5F2ED' }}>
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
                  InputLabelProps={{ sx: { fontFamily: 'var(--font-clash)', fontSize: '0.75rem', fontWeight: 800, color: '#9B9691', letterSpacing: '0.05em' } }}
                  InputProps={{ ...params.InputProps, disableUnderline: true, sx: { fontFamily: 'var(--font-satoshi)', color: '#F5F2ED' } }}
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
                      backgroundColor: '#1C1A18',
                      color: option.color,
                      fontWeight: 800,
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '6px',
                      border: `1px solid ${option.color}`,
                    }}
                  />
                ))
              }
              renderOption={(props, option) => (
                <Box
                  component="li"
                  {...props}
                  key={option.id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, fontFamily: 'var(--font-satoshi)', color: '#F5F2ED' }}
                >
                  <Box sx={{ width: 4, height: 16, borderRadius: 1, bgcolor: option.color }} />
                  <Typography sx={{ fontWeight: 500, fontFamily: 'var(--font-satoshi)' }}>{option.name}</Typography>
                </Box>
              )}
            />

            <Divider sx={{ borderColor: '#1C1A18' }} />

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

        <Box sx={{ px: 3, py: 3, gap: 2, display: 'flex', borderTop: '1px solid #1C1A18', flexShrink: 0 }}>
          <Button 
            onClick={handleClose} 
            sx={{ 
                color: '#9B9691',
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 700,
                letterSpacing: '0.05em',
                fontSize: '0.75rem',
                textTransform: 'none',
                '&:hover': { color: '#F5F2ED' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!title.trim()}
            sx={{
                px: 3,
                py: 1.2,
                borderRadius: '12px',
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'none',
                bgcolor: '#A855F7',
                color: '#0A0908',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)',
                '&:hover': {
                    bgcolor: '#9333EA',
                },
                '&.Mui-disabled': {
                    bgcolor: '#1C1A18',
                    color: '#34322F',
                    boxShadow: 'none'
                }
            }}
          >
            Create Goal
          </Button>
        </Box>
      </Drawer>
    </LocalizationProvider>
  );
}
