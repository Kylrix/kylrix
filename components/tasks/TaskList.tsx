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
import { useTask } from '@/context/TaskContext';
import { ViewMode, SortField, TaskStatus } from '@/types';

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
    { field: 'status', label: 'Status' },
  ];

  const statusFilters: { status: TaskStatus; label: string; color: string }[] = [
    { status: 'todo', label: 'To Do', color: theme.palette.grey[500] },
    { status: 'in-progress', label: 'In Progress', color: theme.palette.info.main },
    { status: 'done', label: 'Done', color: theme.palette.success.main },
    { status: 'blocked', label: 'Blocked', color: theme.palette.error.main },
  ];

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
    if (filter.status?.includes('done')) return 'Completed Tasks';
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
    return 'All Tasks';
  };

  // Group tasks by status for board view
  const groupedTasks = {
    todo: tasks.filter((t) => t.status === 'todo'),
    'in-progress': tasks.filter((t) => t.status === 'in-progress'),
    blocked: tasks.filter((t) => t.status === 'blocked'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  return (
    <Box sx={{ animation: 'fadeIn 0.4s ease-out', minHeight: '100vh', bgcolor: '#000000', p: { xs: 2, md: 4 } }}>
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
          <Typography variant={isMobile ? "h4" : "h3"} sx={{ mb: 1, letterSpacing: '-0.03em', fontWeight: 800 }}>
            {getViewTitle()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {tasks.length} {tasks.length === 1 ? 'Action Item' : 'Action Items'}
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
                bgcolor: '#161514', 
                p: 0.5, 
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.05)'
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
                        borderRadius: 1.5,
                        px: isMobile ? 1 : 1.5,
                        color: viewMode === mode.id ? '#10B981' : 'text.disabled',
                        bgcolor: viewMode === mode.id ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                        '&:hover': { bgcolor: '#1F1D1B' }
                    }}
                >
                    <mode.icon sx={{ fontSize: isMobile ? 18 : 20 }} />
                </IconButton>
            ))}
          </Box>

          {!isMobile && <Divider orientation="vertical" flexItem sx={{ mx: 1, opacity: 0.1 }} />}

          {/* Sort & Filter Group */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
                size="small"
                variant="outlined"
                onClick={handleSortClick}
                sx={{ 
                  borderRadius: 2,
                  minWidth: isMobile ? 'auto' : 80,
                  px: isMobile ? 1.5 : 2
                }}
            >
                {isMobile ? <SortIcon fontSize="small" /> : 'Sort'}
            </Button>

            <Button
                size="small"
                variant="outlined"
                onClick={handleFilterClick}
                sx={{ 
                  borderRadius: 2,
                  minWidth: isMobile ? 'auto' : 80,
                  px: isMobile ? 1.5 : 2
                }}
            >
                {isMobile ? <FilterIcon fontSize="small" /> : 'Filter'}
                {(filter.status?.length || filter.labels?.length) && (
                <Box sx={{ ml: 1, width: 16, height: 16, borderRadius: '50%', bgcolor: '#10B981', color: '#000', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                    {(filter.status?.length || 0) + (filter.labels?.length || 0)}
                </Box>
                )}
            </Button>
          </Box>

          {/* Add Task (Desktop) */}
          {!isMobile && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setTaskDialogOpen(true)}
              sx={{ 
                  borderRadius: 2,
                  px: 3,
                  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)'
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
        PaperProps={{ sx: { minWidth: 200, mt: 1 } }}
      >
        {sortOptions.map((option) => (
          <MenuItem
            key={option.field}
            onClick={() => handleSortChange(option.field)}
            selected={sort.field === option.field}
            sx={{ gap: 2 }}
          >
            <ListItemText primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}>{option.label}</ListItemText>
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
        PaperProps={{ sx: { minWidth: 240, mt: 1, p: 1.5 } }}
      >
        <Typography variant="subtitle2" sx={{ px: 1, mb: 2, scale: '0.8', originX: 0 }}>
          STATUS FILTERS
        </Typography>
        {statusFilters.map((item) => (
          <MenuItem
            key={item.status}
            onClick={() => handleStatusFilterToggle(item.status)}
            sx={{ borderRadius: 1.5, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.85rem' }}>{item.label}</ListItemText>
            {filter.status?.includes(item.status) && (
              <CheckIcon sx={{ fontSize: 18, color: '#10B981' }} />
            )}
          </MenuItem>
        ))}
        <Divider sx={{ my: 1.5, opacity: 0.05 }} />
        <MenuItem
          onClick={() => setFilter({ ...filter, showCompleted: !filter.showCompleted })}
          sx={{ borderRadius: 1.5 }}
        >
          <ListItemText primaryTypographyProps={{ fontSize: '0.85rem' }}>Include Completed</ListItemText>
          {filter.showCompleted && <CheckIcon sx={{ fontSize: 18, color: '#10B981' }} />}
        </MenuItem>
        <Divider sx={{ my: 1.5, opacity: 0.05 }} />
        <MenuItem
          onClick={() => {
            setFilter({ showCompleted: true, showArchived: false });
            handleFilterClose();
          }}
          sx={{ borderRadius: 1.5, color: 'text.secondary' }}
        >
          <ListItemText primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}>Reset to Defaults</ListItemText>
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
                color: 'text.secondary',
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 800 }}>
                Clean Slate
              </Typography>
              <Typography variant="body2" sx={{ mb: 4, opacity: 0.6 }}>
                {filter.search
                  ? 'No action items matching your search.'
                  : 'You have no pending tasks in this view.'}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setTaskDialogOpen(true)}
              >
                Add Your First Task
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
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 3,
                p: 2,
                minHeight: 400,
                border: '1px solid rgba(255, 255, 255, 0.04)'
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
                  <Typography variant="subtitle2" sx={{ color: '#F2F2F2' }}>
                    {statusFilters.find((s) => s.status === status)?.label}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setTaskDialogOpen(true)} sx={{ color: 'text.disabled' }}>
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
            color: 'text.secondary',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 4,
            border: '1px dashed rgba(255, 255, 255, 0.1)'
          }}
        >
          <Box sx={{ mb: 3, opacity: 0.2 }}>
            <CalendarIcon sx={{ fontSize: 80 }} />
          </Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 800, color: '#F2F2F2' }}>
            Time Dimension
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 400, mx: 'auto', opacity: 0.6 }}>
            The visual calendar interface is currently being optimized for the Kylrix ecosystem. 
          </Typography>
        </Box>
      )}
      </Box>
    </Box>
  );
}
