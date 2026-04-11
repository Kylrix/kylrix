'use client';

import { Box, ButtonBase, Stack, Typography, alpha } from '@mui/material';
import { DESIGN_FLYERS } from './flyers';

interface DesignSidebarProps {
  open?: boolean;
  onClose?: () => void;
  selectedSlug?: string;
  onSelect?: (slug: string) => void;
}

export default function DesignSidebar({ open = true, onClose, selectedSlug, onSelect }: DesignSidebarProps) {
  const currentSlug = selectedSlug || '';

  const handleNavigate = (slug: string) => {
    onSelect?.(slug);
    onClose?.();
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        width: { xs: '100%', md: 380 },
        height: '100%',
        borderRight: { xs: 'none', md: '1px solid rgba(255,255,255,0.06)' },
        borderBottom: { xs: '1px solid rgba(255,255,255,0.06)', md: 'none' },
        bgcolor: 'rgba(7, 6, 6, 0.72)',
        backdropFilter: 'blur(24px)',
        p: 2.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 2,
          color: 'rgba(255,255,255,0.32)',
          fontWeight: 900,
          letterSpacing: '0.22em',
        }}
      >
        FLYER LIBRARY
      </Typography>
      <Stack spacing={1}>
        {DESIGN_FLYERS.map((flyer) => {
          const selected = currentSlug === flyer.slug || (!currentSlug && flyer.slug === 'happy-easter');

          return (
            <ButtonBase
              key={flyer.slug}
              onClick={() => handleNavigate(flyer.slug)}
              sx={{
                width: '100%',
                borderRadius: 2.5,
                textAlign: 'left',
                px: 2,
                py: 1.75,
                border: `1px solid ${selected ? alpha(flyer.accent, 0.3) : 'rgba(255,255,255,0.04)'}`,
                bgcolor: selected ? alpha(flyer.accent, 0.06) : 'transparent',
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  bgcolor: alpha(flyer.accent, 0.08),
                  border: `1px solid ${alpha(flyer.accent, 0.4)}`,
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: selected ? flyer.accent : 'rgba(255,255,255,0.12)',
                    boxShadow: selected ? `0 0 12px ${flyer.accent}` : 'none',
                  }}
                />
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: selected ? 900 : 600,
                    color: selected ? 'white' : 'rgba(255,255,255,0.54)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {flyer.title}
                </Typography>
              </Stack>
            </ButtonBase>
          );
        })}
      </Stack>
    </Box>
  );
}
