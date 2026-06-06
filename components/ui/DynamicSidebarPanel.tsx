'use client';

import React, { useEffect, useState } from 'react';
import { Box, IconButton, Typography } from '@/lib/mui-tailwind/material';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { X as CloseIcon, ArrowLeft as BackIcon } from 'lucide-react';

/** Panels that manage their own fixed header/footer + internal scroll. */
const SELF_CONTAINED_PANEL_KEYS = new Set([
  'project-discussion',
  'note-detail',
  'task-detail',
  'event-detail',
]);

export function DynamicSidebar() {
  const { isOpen, content, closeSidebar, options, activeContentKey } = useDynamicSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
      }
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen && !mounted) return null;

  const isNoteDetail =
    content &&
    React.isValidElement(content) &&
    ((typeof content.type === 'function' && content.type.name === 'NoteDetailSidebar') ||
      (typeof content.type === 'object' &&
        content.type !== null &&
        (content.type as { type?: { name?: string } }).type?.name === 'NoteDetailSidebar') ||
      (content.props as { note?: unknown })?.note !== undefined);

  const shouldHideHeader = options?.hideHeader || isNoteDetail;
  const isSelfContained =
    isNoteDetail ||
    shouldHideHeader ||
    Boolean(activeContentKey && SELF_CONTAINED_PANEL_KEYS.has(activeContentKey));

  return (
    <>
      {/* Openbricks: blur scrim behind focused drawer */}
      <Box
        onClick={closeSidebar}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 9990,
          bgcolor: 'rgba(0, 0, 0, 0.58)',
          backdropFilter: 'blur(10px) saturate(120%)',
          WebkitBackdropFilter: 'blur(10px) saturate(120%)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Side sheet — deep ash on pitch-black stage */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          height: '100dvh',
          width: { xs: '100%', md: 480, lg: 520 },
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9995,
          bgcolor: '#161412',
          borderLeft: '1px solid #1C1A18',
          boxShadow: '-12px 0 48px rgba(0, 0, 0, 0.55)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '1px',
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            pointerEvents: 'none',
          },
        }}
      >
        {!shouldHideHeader && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              flexShrink: 0,
              bgcolor: '#161412',
              borderBottom: '1px solid #1C1A18',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                onClick={closeSidebar}
                sx={{
                  display: { xs: 'inline-flex', md: 'none' },
                  color: 'rgba(255,255,255,0.55)',
                  '&:hover': { color: '#fff', bgcolor: '#1C1A18' },
                }}
                size="small"
              >
                <BackIcon size={20} />
              </IconButton>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontFamily: 'var(--font-clash)',
                  color: '#6366F1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: '0.8rem',
                }}
              >
                Details
              </Typography>
            </Box>
            <IconButton
              onClick={closeSidebar}
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                color: 'rgba(255,255,255,0.55)',
                '&:hover': { color: '#fff', bgcolor: '#1C1A18' },
              }}
              size="small"
            >
              <CloseIcon size={18} />
            </IconButton>
          </Box>
        )}

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#0A0908',
            overflow: isSelfContained ? 'hidden' : 'auto',
          }}
          className={isSelfContained ? undefined : 'scrollbar-thin'}
        >
          {content}
        </Box>
      </Box>
    </>
  );
}
