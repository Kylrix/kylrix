'use client';

import React, { useState } from 'react';
import {
  Box,
  Fab,
  Typography,
  Backdrop,
  Zoom,
  alpha,
  useMediaQuery,
  useTheme,
} from '@/lib/openbricks/primitives';
import { Plus, X } from 'lucide-react';
import { useFAB } from '@/context/FABContext';
import { usePathname } from 'next/navigation';
import { useLocalContext } from '@/lib/context-engine';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';

const FAB_BOTTOM = {
  landing: 32,
  app: { xs: 'calc(104px + env(safe-area-inset-bottom))', md: 32 },
} as const;

export default function UniversalFAB() {
  const { config } = useFAB();
  const { isDrawerOpen } = useDrawerState();
  const { isOpen: isAgenticDrawerOpen } = useAgenticDrawer();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const { isRecording, startRecording, stopRecording, currentWorkflow } = useLocalContext();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const isLandingPage = pathname === '/';

  const isAppRoute = pathname && (
    pathname.startsWith('/projects') ||
    pathname.startsWith('/app') ||
    (pathname.startsWith('/flow') && !pathname.startsWith('/flow/form/')) ||
    pathname.startsWith('/vault') ||
    (pathname.startsWith('/connect') && !pathname.includes('/invite/'))
  );

  if (isDrawerOpen || isAgenticDrawerOpen) return null;
  if (!config.isVisible && !isAppRoute) return null;

  const actions = config.actions || [];
  const mainIcon = config.mainIcon;
  const mainColor = config.mainColor || '#6366F1';
  const onMainClick = config.onMainClick;

  // Speed-dial stays mobile-only; direct-action FABs (onMainClick) work on desktop too.
  if (isDesktop && !onMainClick) return null;

  const anchorSx = {
    position: 'fixed' as const,
    bottom: isLandingPage ? FAB_BOTTOM.landing : (isDesktop ? 32 : FAB_BOTTOM.app),
    right: { xs: 16, md: 32 },
    zIndex: 1505,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: 1.5,
    pointerEvents: 'none' as const,
  };

  const childPointerEvents = { pointerEvents: 'auto' as const };

  if (onMainClick) {
    return (
      <Box sx={anchorSx}>
        <Zoom in>
          <Fab
            onClick={onMainClick}
            sx={{
              ...childPointerEvents,
              width: 64,
              height: 64,
              bgcolor: mainColor,
              color: '#000',
              borderRadius: '20px',
              boxShadow: `0 10px 34px ${alpha(mainColor, 0.45)}`,
              backdropFilter: 'blur(14px) saturate(170%)',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              '&:hover': {
                bgcolor: mainColor,
                transform: 'translateY(-4px)',
                boxShadow: `0 14px 42px ${alpha(mainColor, 0.52)}`,
              },
            }}
          >
            {mainIcon || <Plus size={32} strokeWidth={2} />}
          </Fab>
        </Zoom>
      </Box>
    );
  }

  const speedDialActions = actions;

  return (
    <>
      <Backdrop open={isExpanded} onClick={() => setIsExpanded(false)} />

      <Box sx={anchorSx}>
        {speedDialActions.map((action, index) => {
          const delay = `${index * 0.055}s`;
          return (
            <Box
              key={action.id}
              component="button"
              type="button"
              onClick={() => {
                action.onClick();
                setIsExpanded(false);
              }}
              aria-label={action.label}
              sx={{
                ...childPointerEvents,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 0.5,
                py: 0.25,
                border: 'none',
                background: 'transparent',
                cursor: isExpanded ? 'pointer' : 'default',
                textAlign: 'right',
                opacity: isExpanded ? 1 : 0,
                visibility: isExpanded ? 'visible' : 'hidden',
                pointerEvents: isExpanded ? 'auto' : 'none',
                transform: isExpanded ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.9)',
                transition: `opacity 0.32s ease ${delay}, transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}, visibility 0.32s ${delay}`,
              }}
            >
              <Box
                sx={{
                  px: 1.75,
                  py: 1,
                  borderRadius: '12px',
                  bgcolor: 'rgba(10, 10, 10, 0.94)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}
                >
                  {action.label}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '16px',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  bgcolor: '#0A0908',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.88)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.5)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  '&:active': { transform: 'scale(0.92)' },
                }}
              >
                {action.icon}
              </Box>
            </Box>
          );
        })}

        <Fab
          onClick={() => setIsExpanded((open) => !open)}
          aria-label={isExpanded ? 'Close actions' : 'Open actions'}
          sx={{
            ...childPointerEvents,
            width: 64,
            height: 64,
            bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.08)' : mainColor,
            color: isExpanded ? '#fff' : '#000',
            borderRadius: '20px',
            border: isExpanded ? '1px solid rgba(255, 255, 255, 0.18)' : 'none',
            boxShadow: isExpanded ? '0 12px 40px rgba(0,0,0,0.55)' : `0 10px 34px ${alpha(mainColor, 0.45)}`,
            backdropFilter: 'blur(14px) saturate(170%)',
            transform: isExpanded ? 'rotate(0deg)' : 'none',
            transition: 'all 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '&:active': { transform: 'scale(0.94)' },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {isExpanded ? <X size={28} strokeWidth={2} /> : (mainIcon || <Plus size={28} strokeWidth={2} />)}
          </Box>
        </Fab>
      </Box>
    </>
  );
}
