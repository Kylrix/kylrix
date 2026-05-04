'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Collapse,
  IconButton,
  Badge,
  alpha,
} from '@mui/material';
import {
  CheckSquare as CheckSquareIcon,
  Calendar as CalendarIcon,
  Zap as ZapIcon,
  Inbox as InboxIcon,
  Clock as ClockIcon,
  CheckCircle2 as CheckCircle2Icon,
  ChevronUp as ChevronUpIcon,
  ChevronDown as ChevronDownIcon,
  Settings as SettingsIcon,
  FileText as FormIcon,
  LayoutList as ListIcon,
  Folder as FolderIcon
} from 'lucide-react';
import { useTask } from '@/context/TaskContext';

const DRAWER_WIDTH = 256;

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  color?: string;
  href?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarOpen,
    projects,
    tasks,
    selectedProjectId,
    selectProject,
    setFilter,
    filter,
  } = useTask();

  const [tasksOpen, setTasksOpen] = useState(true);
  const [smartListsOpen, setSmartListsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  // Calculate stats
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const inboxCount = tasks.filter(
    (t) => t.projectId === 'inbox' && t.status !== 'done' && !t.isArchived
  ).length;

  const todayCount = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done' || t.isArchived) return false;
    const due = new Date(t.dueDate);
    return due >= today && due < tomorrow;
  }).length;

  const upcomingCount = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done' || t.isArchived) return false;
    const due = new Date(t.dueDate);
    return due >= tomorrow && due < nextWeek;
  }).length;

  const overdueCount = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && !t.isArchived
  ).length;

  const completedCount = tasks.filter(
    (t) => t.status === 'done' && !t.isArchived
  ).length;

  const smartLists: NavItem[] = [
    { id: 'inbox', label: 'Inbox', icon: <InboxIcon size={16} />, badge: inboxCount },
    { id: 'today', label: 'Today', icon: <CalendarIcon size={16} />, badge: todayCount, color: '#10b981' },
    { id: 'upcoming', label: 'Upcoming', icon: <ClockIcon size={16} />, badge: upcomingCount, color: '#3b82f6' },
    {
      id: 'overdue',
      label: 'Overdue',
      icon: <CalendarIcon size={16} />,
      badge: overdueCount,
      color: '#ef4444',
    },
    { id: 'completed', label: 'Completed', icon: <CheckCircle2Icon size={16} />, badge: completedCount },
  ];

  const handleSmartListClick = (id: string) => {
    router.push('/tasks');
    switch (id) {
      case 'inbox':
        selectProject('inbox');
        setFilter({ ...filter, projectId: 'inbox' });
        break;
      case 'today':
        selectProject(null);
        setFilter({
          ...filter,
          projectId: undefined,
          dueDate: { from: today, to: tomorrow },
          showCompleted: false,
        });
        break;
      case 'upcoming':
        selectProject(null);
        setFilter({
          ...filter,
          projectId: undefined,
          dueDate: { from: tomorrow, to: nextWeek },
          showCompleted: false,
        });
        break;
      case 'overdue':
        selectProject(null);
        setFilter({
          ...filter,
          projectId: undefined,
          dueDate: { to: now },
          showCompleted: false,
        });
        break;
      case 'completed':
        selectProject(null);
        setFilter({
          ...filter,
          projectId: undefined,
          status: ['done'],
          showCompleted: true,
        });
        break;
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push('/tasks');
    selectProject(projectId);
    setFilter({ ...filter, projectId, status: undefined, dueDate: undefined });
  };

  const getProjectTaskCount = (projectId: string) => {
    return tasks.filter(
      (t) => t.projectId === projectId && t.status !== 'done' && !t.isArchived
    ).length;
  };

  const regularProjects = projects.filter((p) => !p.isFavorite && !p.isArchived && p.id !== 'inbox');

  const navItemStyles = (href?: string, isSelected?: boolean) => ({
    borderRadius: '12px',
    py: 1.5,
    mb: 1.2,
    transition: 'all 0.2s ease',
    ...(isSelected || (href && pathname === href) ? {
      backgroundColor: alpha('#6366F1', 0.1),
      color: 'var(--color-brand)',
      '& .MuiListItemIcon-root': {
        color: 'var(--color-brand)',
      },
      '&:hover': {
        backgroundColor: alpha('#6366F1', 0.15),
      },
    } : {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
      }
    })
  });

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={sidebarOpen}
      sx={{
        width: sidebarOpen ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(11, 9, 8, 0.95)',
          mt: '64px',
          height: 'calc(100% - 64px)',
          backgroundImage: 'none',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', py: 2, px: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Tasks Section with Sub-items */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={Link}
            href="/tasks"
            selected={pathname === '/tasks'}
            sx={navItemStyles('/tasks')}
          >
            <ListItemIcon sx={{ minWidth: 36, color: pathname === '/tasks' ? 'var(--color-brand)' : '#A1A1AA' }}>
              <CheckSquareIcon size={20} />
            </ListItemIcon>
            <ListItemText 
                primary="Tasks" 
                primaryTypographyProps={{ 
                    fontWeight: pathname === '/tasks' ? 900 : 700, 
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-satoshi)'
                }} 
            />
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTasksOpen(!tasksOpen);
              }}
              sx={{ color: 'text.disabled', p: 0 }}
            >
              {tasksOpen ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
            </IconButton>
          </ListItemButton>
        </ListItem>

        <Collapse in={tasksOpen} timeout="auto" unmountOnExit>
          <List dense component="div" disablePadding sx={{ pl: 2 }}>
            {/* Smart Lists Toggle */}
            <ListItemButton 
              onClick={() => setSmartListsOpen(!smartListsOpen)}
              sx={{ borderRadius: '10px', py: 0.8, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: '#A1A1AA' }}>
                <ListIcon size={16} />
              </ListItemIcon>
              <ListItemText primary="Views" primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 700 }} />
              {smartListsOpen ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
            </ListItemButton>
            
            <Collapse in={smartListsOpen} timeout="auto">
              <List dense component="div" disablePadding>
                {smartLists.map((item) => (
                  <ListItemButton
                    key={item.id}
                    selected={pathname === '/tasks' && (filter.projectId === item.id || (item.id === 'completed' && filter.status?.includes('done')))}
                    onClick={() => handleSmartListClick(item.id)}
                    sx={{
                      borderRadius: '10px',
                      py: 0.5,
                      pl: 4,
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        '& .MuiListItemIcon-root': { color: item.color || '#F2F2F2' },
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 24, color: item.color || '#A1A1AA' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 600 }} />
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge badgeContent={item.badge} sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16 } }} />
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Collapse>

            {/* Projects Toggle */}
            <ListItemButton 
              onClick={() => setProjectsOpen(!projectsOpen)}
              sx={{ borderRadius: '10px', py: 0.8, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: '#A1A1AA' }}>
                <FolderIcon size={16} />
              </ListItemIcon>
              <ListItemText primary="Projects" primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 700 }} />
              {projectsOpen ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
            </ListItemButton>

            <Collapse in={projectsOpen} timeout="auto">
              <List dense component="div" disablePadding>
                {regularProjects.map((project) => (
                  <ListItemButton
                    key={project.id}
                    selected={pathname === '/tasks' && selectedProjectId === project.id}
                    onClick={() => handleProjectClick(project.id)}
                    sx={{
                      borderRadius: '10px',
                      py: 0.5,
                      pl: 4,
                      '&.Mui-selected': { backgroundColor: alpha(project.color, 0.1) }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: project.color }} />
                    </ListItemIcon>
                    <ListItemText primary={project.name} primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 600 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                      {getProjectTaskCount(project.id)}
                    </Typography>
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </List>
        </Collapse>

        {/* Forms */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={Link}
            href="/forms"
            selected={pathname === '/forms'}
            sx={navItemStyles('/forms')}
          >
            <ListItemIcon sx={{ minWidth: 36, color: pathname === '/forms' ? 'var(--color-brand)' : '#A1A1AA' }}>
              <FormIcon size={20} />
            </ListItemIcon>
            <ListItemText primary="Forms" primaryTypographyProps={{ fontWeight: pathname === '/forms' ? 900 : 700, fontSize: '0.85rem', fontFamily: 'var(--font-satoshi)' }} />
          </ListItemButton>
        </ListItem>

        {/* Events */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={Link}
            href="/events"
            selected={pathname === '/events'}
            sx={navItemStyles('/events')}
          >
            <ListItemIcon sx={{ minWidth: 36, color: pathname === '/events' ? 'var(--color-app)' : '#A1A1AA' }}>
              <ZapIcon size={20} />
            </ListItemIcon>
            <ListItemText primary="Events" primaryTypographyProps={{ fontWeight: pathname === '/events' ? 900 : 700, fontSize: '0.85rem', fontFamily: 'var(--font-satoshi)' }} />
          </ListItemButton>
        </ListItem>

        {/* Calendar */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={Link}
            href="/calendar"
            selected={pathname === '/calendar'}
            sx={navItemStyles('/calendar')}
          >
            <ListItemIcon sx={{ minWidth: 36, color: pathname === '/calendar' ? 'var(--color-brand)' : '#A1A1AA' }}>
              <CalendarIcon size={20} />
            </ListItemIcon>
            <ListItemText primary="Calendar" primaryTypographyProps={{ fontWeight: pathname === '/calendar' ? 900 : 700, fontSize: '0.85rem', fontFamily: 'var(--font-satoshi)' }} />
          </ListItemButton>
        </ListItem>

        {/* Focus Mode */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={Link}
            href="/focus"
            selected={pathname === '/focus'}
            sx={navItemStyles('/focus')}
          >
            <ListItemIcon sx={{ minWidth: 36, color: pathname === '/focus' ? 'var(--color-brand)' : '#A1A1AA' }}>
              <ClockIcon size={20} />
            </ListItemIcon>
            <ListItemText primary="Focus Mode" primaryTypographyProps={{ fontWeight: pathname === '/focus' ? 900 : 700, fontSize: '0.85rem', fontFamily: 'var(--font-satoshi)' }} />
          </ListItemButton>
        </ListItem>

        {/* Settings */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={Link}
            href="/settings"
            selected={pathname === '/settings'}
            sx={navItemStyles('/settings')}
          >
            <ListItemIcon sx={{ minWidth: 36, color: pathname === '/settings' ? 'var(--color-app)' : '#A1A1AA' }}>
              <SettingsIcon size={20} />
            </ListItemIcon>
            <ListItemText primary="Settings" primaryTypographyProps={{ fontWeight: pathname === '/settings' ? 900 : 700, fontSize: '0.85rem', fontFamily: 'var(--font-satoshi)' }} />
          </ListItemButton>
        </ListItem>
      </Box>
    </Drawer>
  );
}
