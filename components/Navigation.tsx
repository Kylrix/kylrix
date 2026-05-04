"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/ui/AuthContext';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { createBottomBarSurface, getBottomBarViewportOffset } from '@/lib/sdk/bottombar';

import { 
  Box, 
  List, 
  ListItemButton,
  ListItemIcon, 
  ListItemText, 
  Typography, 
  IconButton, 
  Paper,
  Tooltip
} from '@mui/material';
import {
  FileText,
  Link2,
  Tag,
  Settings,
  Puzzle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const { isDrawerOpen } = useDrawerState();
  const surface = createBottomBarSurface({
    activeHref: pathname || '/note/notes',
    items: [
      { id: 'notes', label: 'Notes', href: '/note/notes' },
      { id: 'shared', label: 'Links', href: '/note/shared' },
      { id: 'tags', label: 'Tags', href: '/note/tags' },
      { id: 'extensions', label: 'Caps', href: '/note/extensions' },
    ],
  });

  if (isDrawerOpen) return null;

  return (
    <Box
      component="footer"
      sx={{
        position: 'fixed',
        bottom: `calc(${getBottomBarViewportOffset()}px + ${surface.mobileInset}px)`,
        left: 20,
        right: 20,
        zIndex: 1300,
        display: { xs: 'block', md: 'none' }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#161412',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          px: 2,
          py: 1.5,
          minHeight: surface.mobileDockHeight,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 20px 40px rgba(0,0,0,0.6)',
          backgroundImage: 'none'
        }}
      >
        {surface.items.map(({ href, active }) => {
          const navIcon = href === '/note/notes' ? FileText : href === '/note/shared' ? Link2 : href === '/note/tags' ? Tag : Puzzle;
          const Icon = navIcon;

          return (
          <IconButton
            key={href}
            component={Link}
            href={href}
            sx={{
              color: active ? '#000' : 'rgba(255, 255, 255, 0.6)',
              bgcolor: active ? '#EC4899' : 'transparent',
              borderRadius: '16px',
              p: 1.5,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                bgcolor: active ? '#EC4899' : 'rgba(255, 255, 255, 0.05)',
                transform: 'translateY(-2px)'
              },
              ...(active && {
                boxShadow: '0 0 15px rgba(236, 72, 153, 0.4)',
                transform: 'translateY(-4px)'
              })
            }}
          >
            <Icon size={24} strokeWidth={1.5} />
          </IconButton>
          );
        })}
      </Paper>
    </Box>
  );
};

export const DesktopSidebar: React.FC = () => {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const pathname = usePathname();
  const { } = useAuth();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path);

  const navItems = [
    { icon: FileText, label: 'Notes', path: '/note/notes' },
    { icon: Link2, label: 'Shared Links', path: '/note/shared' },
    { icon: Tag, label: 'Tags', path: '/note/tags' },
    { icon: Puzzle, label: 'Extensions', path: '/note/extensions' },
    { icon: Settings, label: 'Settings', path: '/note/settings' },
  ];

  return (
    <Box
      component="aside"
      sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        bgcolor: '#0A0908',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '10px 0 30px rgba(0,0,0,0.5), inset -1px 0 0 rgba(0, 0, 0, 0.4)',
        transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        width: isCollapsed ? '80px' : '280px',
        zIndex: 1200,
        pt: '88px'
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between',
        p: 3,
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        {!isCollapsed && (
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.2em', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase' }}>
            Navigation
          </Typography>
        )}
        <IconButton 
          size="small" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          sx={{ 
            color: 'rgba(255, 255, 255, 0.4)',
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)', color: 'white' }
          }}
        >
          {isCollapsed ? <ChevronRight size={18} strokeWidth={1.5} /> : <ChevronLeft size={18} strokeWidth={1.5} />}
        </IconButton>
      </Box>

      <List sx={{ flex: 1, px: 2, py: 3, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Tooltip key={item.path} title={isCollapsed ? item.label : ''} placement="right">
              <ListItemButton
                component={Link}
                href={item.path}
                sx={{
                  borderRadius: '16px',
                  mb: 1.5,
                  px: isCollapsed ? 2 : 2.5,
                  py: 1.75,
                  transition: 'all 0.2s ease',
                  bgcolor: active ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                  color: active ? '#EC4899' : 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid',
                  borderColor: active ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
                  boxShadow: active ? 'inset 0 1px 0 rgba(255, 255, 255, 0.05)' : 'none',
                  '&:hover': {
                    bgcolor: active ? 'rgba(236, 72, 153, 0.15)' : '#161412',
                    transform: 'translateX(4px)',
                    color: active ? '#EC4899' : 'white',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  },
                  justifyContent: isCollapsed ? 'center' : 'flex-start'
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: isCollapsed ? 0 : 40, 
                  color: 'inherit',
                  justifyContent: 'center'
                }}>
                  <Icon size={20} strokeWidth={1.5} />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText 
                    primary={item.label} 
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontWeight: 800,
                      letterSpacing: '-0.01em',
                      fontFamily: 'var(--font-satoshi)'
                    }} 
                  />
                )}
                {active && !isCollapsed && (
                  <Box sx={{ width: 4, height: 20, bgcolor: '#EC4899', borderRadius: '2px', ml: 'auto', boxShadow: '0 0 10px rgba(236, 72, 153, 0.5)' }} />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>
    </Box>
  );
};

export default function Navigation() {
  return (
    <>
      <DesktopSidebar />
      <MobileBottomNav />
    </>
  );
}
