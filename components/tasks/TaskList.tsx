'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  SwapVert as SortIcon,
  FilterList as FilterIcon,
  List as ListIcon,
  Dashboard as BoardIcon,
  CalendarMonth as CalendarIcon,
  ArrowUpward as AscIcon,
  ArrowDownward as DescIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useMediaQuery } from '@mui/material';
import TaskItem from './TaskItem';
import { useRouter } from 'next/navigation';
import { useTask } from '@/context/TaskContext';
import { useFAB } from '@/context/FABContext';
import { ViewMode, SortField, TaskStatus } from '@/types';
import { MultiSectionContainer } from '@/context/SectionContext';

export default function TaskList() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const {
    getFilteredTasks,
    viewMode,
    setViewMode,
    sort,
    setSort,
    filter,
    setFilter,
    setTaskDialogOpen,
    projects,
    selectedProjectId,
  } = useTask();
  const { setConfiguration, resetConfiguration } = useFAB();
  const router = React.useRef(useRouter()).current;

  React.useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#10B981',
      actions: [
        { id: 'new-goal', label: 'NEW GOAL', icon: <AddIcon />, onClick: () => setTaskDialogOpen(true) },
        { id: 'focus', label: 'FOCUS MODE', icon: <CalendarIcon />, onClick: () => window.location.href = '/flow/focus' }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, setTaskDialogOpen]);

  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);

  const tasks = getFilteredTasks();
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'dueDate', label: 'Due Date' },
    { field: 'priority', label: 'Priority' },
    { field: 'createdAt', label: 'Created Date' },
    { field: 'updatedAt', label: 'Last Updated' },
    { field: 'title', label: 'Title' },
    { field: 'status', label: 'Status' }];

  const statusFilters: { status: TaskStatus; label: string; color: string }[] = [
    { status: 'todo', label: 'To Do', color: theme.palette.grey[500] },
    { status: 'in-progress', label: 'In Progress', color: theme.palette.info.main },
    { status: 'done', label: 'Done', color: theme.palette.success.main },
    { status: 'blocked', label: 'Blocked', color: theme.palette.error.main }];

  const handleSortClick = (event: React.MouseEvent<HTMLElement>) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleSortClose = () => {
    setSortAnchorEl(null);
  };

  const handleSortChange = (field: SortField) => {
    if (sort.field === field) {
      setSort({ field, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ field, direction: 'asc' });
    }
    handleSortClose();
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleStatusFilterToggle = (status: TaskStatus) => {
    const currentStatuses = filter.status || [];
    if (currentStatuses.includes(status)) {
      setFilter({
        ...filter,
        status: currentStatuses.filter((s) => s !== status),
      });
    } else {
      setFilter({
        ...filter,
        status: [...currentStatuses, status],
      });
    }
  };

  const getViewTitle = () => {
    if (selectedProject) return selectedProject.name;
    if (filter.status?.includes('done')) return 'Completed Goals';
    if (filter.dueDate?.from && filter.dueDate?.to) {
      const from = new Date(filter.dueDate.from);
      const _to = new Date(filter.dueDate.to);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (from.toDateString() === today.toDateString()) return 'Today';
      if (from.toDateString() === tomorrow.toDateString()) return 'Upcoming';
    }
    if (filter.dueDate?.to && !filter.dueDate.from) return 'Overdue';
    return 'All Goals';
  };

  // Group tasks by status for board view
  const groupedTasks = {
    todo: tasks.filter((t) => t.status === 'todo'),
    'in-progress': tasks.filter((t) => t.status === 'in-progress'),
    blocked: tasks.filter((t) => t.status === 'blocked'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  return (
    <Box sx={{ animation: 'fadeIn 0.4s ease-out', minHeight: '100vh', bgcolor: '#0A0908', p: { xs: 2, md: 4 }, pointerEvents: 'auto' }}>
      <MultiSectionContainer panels={['forms', 'huddles', 'projects']}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          mb: isMobile ? 3 : 5,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 2 : 3,
        }}
      >
        <Box>
          <Typography variant={isMobile ? "h4" : "h3"} sx={{ mb: 1, fontFamily: 'var(--font-clash)', fontWeight: 800, letterSpacing: '-0.02em', color: '#F5F2ED' }}>
            {getViewTitle()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            <Typography variant="caption" sx={{ fontFamily: 'var(--font-satoshi)', color: '#9B9691', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {tasks.length} {tasks.length === 1 ? 'Goal' : 'Goals'}
            </Typography>
          </Box>
        </Box>

        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 1 : 2,
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'space-between' : 'flex-end'
          }}
        >
          {/* View Mode Toggle */}
          <Box 
            sx={{ 
                display: 'flex', 
                bgcolor: '#161412', 
                p: 0.5, 
                borderRadius: '12px',
                border: '1px solid #1C1A18'
            }}
          >
            {[
                { id: 'list', icon: ListIcon, label: 'List' },
                { id: 'board', icon: BoardIcon, label: 'Board' },
                { id: 'calendar', icon: CalendarIcon, label: 'Calendar' }
            ].map((mode) => (
                <IconButton
                    key={mode.id}
                    size="small"
                    onClick={() => setViewMode(mode.id as ViewMode)}
                    sx={{
                        borderRadius: '8px',
                        px: isMobile ? 1 : 1.5,
                        color: viewMode === mode.id ? '#10B981' : '#9B9691',
                        bgcolor: viewMode === mode.id ? '#1C1A18' : 'transparent',
                        '&:hover': { bgcolor: '#1C1A18' }
                    }}
                >
                    <mode.icon sx={{ fontSize: isMobile ? 18 : 20 }} />
                </IconButton>
            ))}
          </Box>

          {!isMobile && <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: '#1C1A18' }} />}

          {/* Sort & Filter Group */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
                size="small"
                variant="outlined"
                onClick={handleSortClick}
                sx={{ 
                  borderRadius: '12px',
                  minWidth: isMobile ? 'auto' : 80,
                  px: isMobile ? 1.5 : 2,
                  py: 0.75,
                  bgcolor: '#161412',
                  border: '1px solid #1C1A18',
                  color: '#F5F2ED',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 700,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#1C1A18',
                    borderColor: '#34322F'
                  }
                }}
            >
                {isMobile ? <SortIcon fontSize="small" /> : 'Sort'}
            </Button>

            <Button
                size="small"
                variant="outlined"
                onClick={handleFilterClick}
                sx={{ 
                  borderRadius: '12px',
                  minWidth: isMobile ? 'auto' : 80,
                  px: isMobile ? 1.5 : 2,
                  py: 0.75,
                  bgcolor: '#161412',
                  border: '1px solid #1C1A18',
                  color: '#F5F2ED',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 700,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#1C1A18',
                    borderColor: '#34322F'
                  }
                }}
            >
                {isMobile ? <FilterIcon fontSize="small" /> : 'Filter'}
                {(filter.status?.length || filter.labels?.length) && (
                <Box sx={{ ml: 1, width: 18, height: 18, borderRadius: '50%', bgcolor: '#10B981', color: '#0A0908', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                    {(filter.status?.length || 0) + (filter.labels?.length || 0)}
                </Box>
                )}
            </Button>
          </Box>

          {/* Add Task (Desktop) */}
          {!isMobile && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setTaskDialogOpen(true)}
              sx={{ 
                  borderRadius: '12px',
                  px: 3,
                  py: 1,
                  bgcolor: '#10B981',
                  color: '#0A0908',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                  '&:hover': {
                    bgcolor: '#0D9488',
                    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)'
                  }
              }}
            >
              New Task
            </Button>
          )}
        </Box>
      </Box>

      {/* Sort Menu */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={handleSortClose}
        PaperProps={{
          sx: {
            minWidth: 200,
            mt: 1,
            bgcolor: '#161412',
            border: '1px solid #1C1A18',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
            backgroundImage: 'none',
            p: 1
          }
        }}
      >
        {sortOptions.map((option) => (
          <MenuItem
            key={option.field}
            onClick={() => handleSortChange(option.field)}
            selected={sort.field === option.field}
            sx={{
              borderRadius: '8px',
              gap: 2,
              fontFamily: 'var(--font-satoshi)',
              color: '#F5F2ED',
              mb: 0.5,
              '&:hover': { bgcolor: '#1C1A18' },
              '&.Mui-selected': {
                bgcolor: '#1C1A18',
                color: '#10B981',
                '&:hover': { bgcolor: '#1C1A18' }
              }
            }}
          >
            <ListItemText primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>{option.label}</ListItemText>
            {sort.field === option.field && (
                sort.direction === 'asc' ? <AscIcon sx={{ fontSize: 16 }} /> : <DescIcon sx={{ fontSize: 16 }} />
            )}
          </MenuItem>
        ))}
      </Menu>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={handleFilterClose}
        PaperProps={{
          sx: {
            minWidth: 240,
            mt: 1,
            p: 1.5,
            bgcolor: '#161412',
            border: '1px solid #1C1A18',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
            backgroundImage: 'none'
          }
        }}
      >
        <Typography variant="subtitle2" sx={{ px: 1, mb: 1.5, fontFamily: 'var(--font-clash)', fontWeight: 800, fontSize: '0.75rem', color: '#9B9691', letterSpacing: '0.05em' }}>
          STATUS FILTERS
        </Typography>
        {statusFilters.map((item) => (
          <MenuItem
            key={item.status}
            onClick={() => handleStatusFilterToggle(item.status)}
            sx={{
              borderRadius: '8px',
              mb: 0.5,
              fontFamily: 'var(--font-satoshi)',
              color: '#F5F2ED',
              '&:hover': { bgcolor: '#1C1A18' },
              '&.Mui-selected': {
                bgcolor: '#1C1A18',
                '&:hover': { bgcolor: '#1C1A18' }
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.875rem', fontFamily: 'var(--font-satoshi)' }}>{item.label}</ListItemText>
            {filter.status?.includes(item.status) && (
              <CheckIcon sx={{ fontSize: 18, color: '#10B981' }} />
            )}
          </MenuItem>
        ))}
        <Divider sx={{ my: 1.5, borderColor: '#1C1A18' }} />
        <MenuItem
          onClick={() => setFilter({ ...filter, showCompleted: !filter.showCompleted })}
          sx={{
            borderRadius: '8px',
            fontFamily: 'var(--font-satoshi)',
            color: '#F5F2ED',
            '&:hover': { bgcolor: '#1C1A18' }
          }}
        >
          <ListItemText primaryTypographyProps={{ fontSize: '0.875rem', fontFamily: 'var(--font-satoshi)' }}>Include Completed</ListItemText>
          {filter.showCompleted && <CheckIcon sx={{ fontSize: 18, color: '#10B981' }} />}
        </MenuItem>
        <Divider sx={{ my: 1.5, borderColor: '#1C1A18' }} />
        <MenuItem
          onClick={() => {
            setFilter({ showCompleted: true, showArchived: false });
            handleFilterClose();
          }}
          sx={{
            borderRadius: '8px',
            color: '#EF4444',
            fontFamily: 'var(--font-satoshi)',
            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.05)' }
          }}
        >
          <ListItemText primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>Reset to Defaults</ListItemText>
        </MenuItem>
      </Menu>

      {/* Grid Content */}
      <Box sx={{ minHeight: '60vh' }}>
      {/* Task List View */}
      {viewMode === 'list' && (
        <Box>
          {tasks.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 12,
                color: '#9B9691',
              }}
            >
              <Typography variant="h5" gutterBottom sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, letterSpacing: '-0.02em', color: '#F5F2ED', mb: 1 }}>
                A Clear Void
              </Typography>
              <Typography variant="body2" sx={{ mb: 4, fontFamily: 'var(--font-satoshi)', color: '#9B9691' }}>
                {filter.search
                  ? 'No action items match your parameters.'
                  : 'Establish order. Bring structure to your goals.'}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setTaskDialogOpen(true)}
                sx={{
                  borderRadius: '12px',
                  border: '1px solid #1C1A18',
                  color: '#F5F2ED',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 700,
                  px: 3,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#161412',
                    borderColor: '#34322F'
                  }
                }}
              >
                Add Your First Goal
              </Button>
            </Box>
          ) : (
            tasks.map((task) => <TaskItem key={task.id} task={task} />)
          )}
        </Box>
      )}

      {/* Board View (Kanban) */}
      {viewMode === 'board' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
            gap: 3,
            minHeight: 400,
          }}
        >
          {(['todo', 'in-progress', 'blocked', 'done'] as const).map((status) => (
            <Box
              key={status}
              sx={{
                backgroundColor: '#161412',
                borderRadius: '24px',
                p: 2.5,
                minHeight: 450,
                border: '1px solid #1C1A18',
                boxShadow: '0 4px 4px -4px rgba(0,0,0,0.9)'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor:
                        statusFilters.find((s) => s.status === status)?.color ||
                        theme.palette.grey[500],
                      boxShadow: `0 0 8px ${statusFilters.find((s) => s.status === status)?.color}`
                    }}
                  />
                  <Typography variant="subtitle2" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, color: '#F5F2ED', fontSize: '0.9rem' }}>
                    {statusFilters.find((s) => s.status === status)?.label}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setTaskDialogOpen(true)} sx={{ color: '#9B9691', '&:hover': { color: '#F5F2ED' } }}>
                  <AddIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {groupedTasks[status].map((task) => (
                  <TaskItem key={task.id} task={task} compact />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Calendar View Placeholder */}
      {viewMode === 'calendar' && (
        <Box
          sx={{
            textAlign: 'center',
            py: 12,
            color: '#9B9691',
            backgroundColor: '#161412',
            borderRadius: '24px',
            border: '1px dashed #1C1A18'
          }}
        >
          <Box sx={{ mb: 3, opacity: 0.3 }}>
            <CalendarIcon sx={{ fontSize: 80, color: '#10B981' }} />
          </Box>
          <Typography variant="h5" gutterBottom sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, color: '#F5F2ED', letterSpacing: '-0.02em' }}>
            Time Dimension
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 400, mx: 'auto', color: '#9B9691', fontFamily: 'var(--font-satoshi)' }}>
            The visual calendar interface is currently being optimized for the Kylrix ecosystem. 
          </Typography>
        </Box>
      )}
      </MultiSectionContainer>
    </Box>
  );
}
