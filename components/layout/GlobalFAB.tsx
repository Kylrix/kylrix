'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Box, 
  Fab, 
  Typography, 
  Backdrop, 
  Zoom,
  alpha,
} from '@mui/material';
import { 
  Plus as PlusIcon,
  CheckSquare as TaskIcon,
  FileText as FormIcon,
  Zap as EventIcon,
} from 'lucide-react';
import { useTask } from '@/context/TaskContext';

export default function GlobalFAB() {
  const pathname = usePathname();
  const router = useRouter();
  const { setTaskDialogOpen } = useTask();
  const [isExpanded, setIsExpanded] = useState(false);

  // Hide FAB on specific pages or conditions
  const isSettingsPage = pathname === '/settings';
  const isFormActive = pathname.startsWith('/forms/') && pathname.split('/').length > 2;
  const isEventActive = pathname.startsWith('/events/') && pathname.split('/').length > 2;
  
  const shouldHide = isSettingsPage || isFormActive || isEventActive;

  if (shouldHide) return null;

  const actions = [
    { 
      icon: <TaskIcon size={22} strokeWidth={2} />, 
      name: 'TASK', 
      onClick: () => {
        setTaskDialogOpen(true);
        setIsExpanded(false);
      },
      color: '#10B981',
    },
    { 
      icon: <FormIcon size={22} strokeWidth={2} />, 
      name: 'FORM', 
      onClick: () => {
        router.push('/forms/new');
        setIsExpanded(false);
      },
      color: '#6366F1',
    },
    { 
      icon: <EventIcon size={22} strokeWidth={2} />, 
      name: 'EVENT', 
      onClick: () => {
        router.push('/events/new');
        setIsExpanded(false);
      },
      color: '#A855F7',
    },
  ];

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 110, // Above BottomNav
        right: 24,
        zIndex: 1400,
        display: { xs: 'flex', md: 'none' }, // Only show on mobile
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <Backdrop
        open={isExpanded}
        onClick={() => setIsExpanded(false)}
        sx={{ 
          zIndex: -1, 
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)'
        }}
      />

      {/* Expanded Actions */}
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1.5, // Closer spacing
          mb: 2,
          pointerEvents: isExpanded ? 'auto' : 'none'
        }}
      >
        {actions.map((action, index) => (
          <Zoom 
            key={action.name} 
            in={isExpanded} 
            style={{ 
                transitionDelay: isExpanded ? `${(actions.length - 1 - index) * 50}ms` : '0ms',
                transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography 
                variant="caption" 
                sx={{ 
                    fontWeight: 900, 
                    color: 'white', 
                    bgcolor: 'rgba(25, 22, 20, 0.8)', 
                    px: 1.5, 
                    py: 0.5, 
                    borderRadius: '8px', 
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    letterSpacing: '0.1em',
                    fontSize: '0.65rem'
                }}
              >
                {action.name}
              </Typography>
              <Fab
                size="medium"
                onClick={action.onClick}
                sx={{
                  bgcolor: 'rgba(15, 13, 12, 0.9)',
                  backdropFilter: 'blur(10px)',
                  color: action.color,
                  border: `1px solid ${alpha(action.color, 0.3)}`,
                  width: 48,
                  height: 48,
                  '&:hover': { 
                    bgcolor: 'rgba(25, 22, 20, 1)',
                    borderColor: action.color,
                    boxShadow: `0 0 20px ${alpha(action.color, 0.4)}`
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                {action.icon}
              </Fab>
            </Box>
          </Zoom>
        ))}
      </Box>

      {/* Main Trigger FAB */}
      <Fab
        onClick={() => setIsExpanded(!isExpanded)}
        sx={{
          width: 64,
          height: 64,
          bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.05)' : '#A855F7',
          color: isExpanded ? 'white' : 'black',
          borderRadius: '20px',
          border: isExpanded ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
          backdropFilter: isExpanded ? 'blur(10px)' : 'none',
          boxShadow: isExpanded ? 'none' : `0 8px 32px ${alpha('#A855F7', 0.4)}`,
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isExpanded ? 'rotate(45deg)' : 'none',
          '&:hover': {
            bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.1)' : '#A855F7',
            transform: isExpanded ? 'rotate(45deg) scale(1.05)' : 'translateY(-4px)',
            boxShadow: isExpanded ? 'none' : `0 12px 40px ${alpha('#A855F7', 0.5)}`,
          }
        }}
      >
        <PlusIcon size={32} strokeWidth={2} />
      </Fab>
    </Box>
  );
}
