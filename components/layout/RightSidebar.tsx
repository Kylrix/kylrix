'use client';

import React from 'react';
import { Drawer, Box, IconButton, useTheme, useMediaQuery, alpha } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useLayout } from '@/context/LayoutContext';
import TaskDetails from '../tasks/TaskDetails';
import EventDetails from '@/components/events/EventDetails';

const DRAWER_WIDTH = 440;

export default function RightSidebar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { secondarySidebar, closeSecondarySidebar } = useLayout();
  const { isOpen, type, itemId, data } = secondarySidebar;

  const content = React.useMemo(() => {
    if (!type || !itemId) return null;

    switch (type) {
      case 'task':
        return <TaskDetails taskId={itemId} />;
      case 'event':
        return <EventDetails eventId={itemId} initialData={data} />;
      default:
        return null;
    }
  }, [type, itemId, data]);

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={closeSecondarySidebar}
      variant="temporary"
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : DRAWER_WIDTH,
          maxWidth: '100vw',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
          backgroundColor: '#050505',
          backgroundImage: 'none',
          zIndex: theme.zIndex.drawer + 2,
          backdropFilter: 'blur(20px)',
        },
      }}
      sx={{
        width: isOpen && !isMobile ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        transition: theme.transitions.create(['width'], {
          easing: theme.transitions.easing.easeInOut,
          duration: theme.transitions.duration.standard,
        }),
      }}
    >
      {/* Close button for mobile */}
      {isMobile && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1,
          }}
        >
          <IconButton
            onClick={closeSecondarySidebar}
            sx={{
              bgcolor: alpha(theme.palette.text.primary, 0.05),
              '&:hover': {
                bgcolor: alpha(theme.palette.text.primary, 0.1),
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      )}
      
      {/* Spacer for AppBar if persistent */}
      {!isMobile && <Box sx={{ ...theme.mixins.toolbar }} />}
      
      {/* Content with fade animation */}
      <Box
        sx={{
          height: '100%',
          overflow: 'auto',
          animation: isOpen ? 'fadeIn 0.2s ease-out' : 'none',
          '@keyframes fadeIn': {
            from: { opacity: 0, transform: 'translateX(20px)' },
            to: { opacity: 1, transform: 'translateX(0)' },
          },
        }}
      >
        {content}
      </Box>
    </Drawer>
  );
}

