'use client';

import { Box, ButtonBase, Stack, Typography, alpha } from '@mui/material';
import { useRouter, usePathname } from 'next/navigation';
import { DESIGN_FLYERS } from './flyers';

interface DesignSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function DesignSidebar({ open = true, onClose }: DesignSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const currentSlug = pathname.split('/')[2] || '';

  const handleNavigate = (slug: string) => {
    router.push(`/designs/${slug}`);
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
      <Stack spacing={1.5}>
        {DESIGN_FLYERS.map((flyer) => {
          const selected = currentSlug === flyer.slug || (!currentSlug && flyer.slug === 'happy-easter');
          const Preview = flyer.preview;

          return (
            <ButtonBase
              key={flyer.slug}
              onClick={() => handleNavigate(flyer.slug)}
              sx={{
                width: '100%',
                borderRadius: 4,
                textAlign: 'left',
                overflow: 'hidden',
                border: `1px solid ${selected ? alpha(flyer.accent, 0.4) : 'rgba(255,255,255,0.06)'}`,
                bgcolor: selected ? alpha(flyer.accent, 0.07) : 'rgba(255,255,255,0.02)',
                transition: 'all 180ms ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  bgcolor: alpha(flyer.accent, 0.08),
                },
              }}
            >
              <Box sx={{ p: 1.5, width: '100%' }}>
                <Preview />
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {flyer.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>
                    {flyer.description}
                  </Typography>
                </Box>
              </Box>
            </ButtonBase>
          );
        })}
      </Stack>
    </Box>
  );
}
