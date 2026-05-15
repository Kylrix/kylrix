"use client";

import React, { useState, useRef } from 'react';
import { 
  Drawer,
  Box, 
  Fade, 
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useOverlay } from './OverlayContext';

const Overlay: React.FC = () => {
  const { isOpen, content, closeOverlay } = useOverlay();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isExpanded, setIsExpanded] = useState(false);
  const dragStartY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartY.current = e.clientY;
    startHeight.current = isExpanded ? window.innerHeight : window.innerHeight * 0.6;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStartY.current === 0) return;
    
    const deltaY = dragStartY.current - e.clientY;
    const threshold = 100;
    
    // If dragging up more than threshold, expand
    if (deltaY > threshold && !isExpanded) {
      setIsExpanded(true);
    }
    // If dragging down more than threshold, collapse
    if (deltaY < -threshold && isExpanded) {
      setIsExpanded(false);
    }
  };

  const handleMouseUp = () => {
    dragStartY.current = 0;
  };

  const drawerHeight = isMobile 
    ? (isExpanded ? '100dvh' : '60dvh')
    : '100%';

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={isOpen}
      onClose={closeOverlay}
      ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 720px)',
          maxWidth: isMobile ? '100%' : '720px',
          height: drawerHeight,
          maxHeight: '100dvh',
          borderTopLeftRadius: isMobile ? '24px' : 0,
          borderTopRightRadius: isMobile ? '24px' : 0,
          borderLeft: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'none',
          bgcolor: '#161412',
          boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'height 0.3s ease-out',
        }
      }}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(10px)',
          }
        }
      }}
    >
      <Fade in={isOpen}>
        <Box
          sx={{
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            minHeight: 0,
            flex: 1,
            maxHeight: '100vh',
            userSelect: 'none',
          }}
          onMouseDown={isMobile ? handleMouseDown : undefined}
          onMouseMove={isMobile ? handleMouseMove : undefined}
          onMouseUp={isMobile ? handleMouseUp : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </Box>
      </Fade>
    </Drawer>
  );
};

export default Overlay;

