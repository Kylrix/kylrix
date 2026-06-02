'use client';

import React, { forwardRef } from 'react';
import { Box, Typography } from '@/lib/mui-tailwind/material';
import Logo from '@/components/Logo';
import type { DesignFlyerProps } from '../types';

interface FlyerShellProps extends DesignFlyerProps {
  accent: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow: string;
  backgroundA: string;
  backgroundB: string;
  children: React.ReactNode;
  variant?: 'standard' | 'raw';
}

const FlyerShell = forwardRef<HTMLDivElement, FlyerShellProps>(function FlyerShell(
  { accent, title, subtitle, variant = 'standard', className, children },
  ref
) {
  if (variant === 'raw') {
    return (
      <Box
        ref={ref}
        className={className}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 5',
          minHeight: { xs: 900, lg: 1080 },
          borderRadius: 0,
          overflow: 'hidden',
          isolation: 'isolate',
          background: '#0A0908', // Raw Matte Black
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      ref={ref}
      className={className}
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 5',
        minHeight: { xs: 900, lg: 1080 },
        borderRadius: 6,
        overflow: 'hidden',
        isolation: 'isolate',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: `
          radial-gradient(circle at 0% 0%, rgba(168, 85, 247, 0.15) 0%, transparent 40%),
          radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.1) 0%, transparent 40%),
          linear-gradient(145deg, #2D2B29 0%, #242220 100%)
        `,
        boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(circle at center, black 40%, transparent 90%)',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          p: { xs: 4, md: 14 },
          pt: { xs: 12, md: 20 },
          pb: { xs: 10, md: 14 },
        }}
      >
        {/* Main Hero Headline Section */}
        <Box sx={{ mb: 8 }}>
          <Typography
            variant="h1"
            sx={{
              fontWeight: 900,
              lineHeight: 0.82,
              letterSpacing: '-0.06em',
              fontSize: { xs: '4rem', md: '8.5rem' },
              color: 'white',
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="h5"
              sx={{
                mt: 3,
                fontWeight: 500,
                letterSpacing: '0.02em',
                color: 'rgba(255,255,255,0.7)',
                maxWidth: 600,
                mx: 'auto'
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>

        <Box sx={{ position: 'relative', flexGrow: 1, width: '100%', mb: 4 }}>
          {children}
        </Box>

        {/* Balanced Split Footer - High Visibility White */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'row', 
            alignItems: 'flex-end', 
            justifyContent: 'space-between',
            pt: 6,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            width: '94%',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Logo app="root" variant="icon" size={56} />
          </Box>

          <Typography
            sx={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '0.4em',
              color: 'white',
              mb: 0.5,
            }}
          >
            kylrix.space
          </Typography>
        </Box>
      </Box>
    </Box>
  );
});

export default FlyerShell;
