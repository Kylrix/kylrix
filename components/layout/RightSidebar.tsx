'use client';

import React from 'react';
import { Drawer, Box, IconButton, useTheme, useMediaQuery, alpha } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useLayout } from '@/context/LayoutContext';
import TaskDetails from '@/components/tasks/TaskDetails';

export default function RightSidebar() {
  const { secondarySidebar, closeSecondarySidebar } = useLayout();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const getContent = () => {
    switch (secondarySidebar.type) {
      case 'task':
        return <TaskDetails taskId={secondarySidebar.itemId || ''} />;
      // Add other cases (event, focus) as they are implemented
      default:
        return null;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={secondarySidebar.isOpen}
      onClose={closeSecondarySidebar}
      variant="temporary"
      ModalProps={{
        keepMounted: false,
        disableScrollLock: false,
      }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400, md: 500 },
          bgcolor: '#161412',
          borderLeft: '1px solid #34322F',
          backgroundImage: 'none',
          boxShadow: '-20px 0 50px rgba(0,0,0,0.5)',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {getContent()}
      </Box>
    </Drawer>
  );
}
