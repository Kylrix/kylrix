'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Fab, 
  Typography, 
  Backdrop, 
  Zoom,
  alpha,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon
} from '@mui/material';
import { Plus, X } from 'lucide-react';
import { useFAB } from '@/context/FABContext';
import { usePathname } from 'next/navigation';

export default function UniversalFAB() {
  const { config } = useFAB();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  // Landing page has different positioning
  const isLandingPage = pathname === '/';

  if (!config.isVisible) return null;

  const { actions, mainIcon, mainColor, onMainClick } = config;

  // If we have a custom main click handler, don't use SpeedDial behavior
  if (onMainClick && actions.length === 0) {
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: isLandingPage ? 32 : { xs: 104, md: 32 },
          right: { xs: 16, md: 32 },
          zIndex: 1400,
        }}
      >
        <Zoom in={true}>
          <Fab
            onClick={onMainClick}
            sx={{
              width: 64,
              height: 64,
              bgcolor: mainColor || '#6366F1',
              color: '#000',
              borderRadius: '20px',
              boxShadow: `0 8px 32px ${alpha(mainColor || '#6366F1', 0.4)}`,
              '&:hover': {
                bgcolor: mainColor || '#6366F1',
                transform: 'translateY(-4px)',
              }
            }}
          >
            {mainIcon || <Plus size={32} strokeWidth={2} />}
          </Fab>
        </Zoom>
      </Box>
    );
  }

  return (
    <>
      <Backdrop
        open={isExpanded}
        onClick={() => setIsExpanded(false)}
        sx={{ 
          zIndex: 1300, 
          bgcolor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(12px) saturate(180%)',
        }}
      />
      <SpeedDial
        ariaLabel="Universal Actions"
        sx={{
          position: 'fixed',
          bottom: isLandingPage ? 32 : { xs: 'calc(104px + env(safe-area-inset-bottom))', md: 32 },
          right: { xs: 16, md: 32 },
          zIndex: 1310,
          '& .MuiFab-primary': {
            width: 64,
            height: 64,
            bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.05)' : (mainColor || '#6366F1'),
            color: isExpanded ? 'white' : '#000',
            borderRadius: '20px',
            border: isExpanded ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
            boxShadow: isExpanded ? 'none' : `0 8px 32px ${alpha(mainColor || '#6366F1', 0.4)}`,
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            '&:hover': {
              bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.1)' : (mainColor || '#6366F1'),
            }
          },
          '& .MuiSpeedDialAction-fab': {
            bgcolor: 'rgba(10, 10, 10, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.8)',
            width: 48,
            height: 48,
            '&:hover': {
              bgcolor: 'rgba(99, 102, 241, 0.1)',
              color: '#6366F1',
              borderColor: '#6366F1',
            },
          },
          '& .MuiSpeedDialAction-staticTooltipLabel': {
            bgcolor: 'rgba(10, 10, 10, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#FFFFFF',
            fontFamily: 'inherit',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '0.7rem',
            padding: '6px 12px',
            borderRadius: '8px',
            whiteSpace: 'nowrap'
          },
        }}
        icon={<SpeedDialIcon icon={mainIcon || <Plus size={24} />} openIcon={<X size={24} />} />}
        onOpen={() => setIsExpanded(true)}
        onClose={() => setIsExpanded(false)}
        open={isExpanded}
        direction="up"
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.id}
            icon={action.icon}
            tooltipTitle={action.label}
            tooltipOpen
            onClick={() => {
              action.onClick();
              setIsExpanded(false);
            }}
          />
        ))}
      </SpeedDial>
    </>
  );
}
