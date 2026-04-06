'use client';

import React, { forwardRef } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import Logo from '@/components/Logo';
import type { DesignFlyerProps } from '../types';

interface FlyerShellProps extends DesignFlyerProps {
  accent: string;
  title: React.ReactNode;
  subtitle: string;
  eyebrow: string;
  backgroundA: string;
  backgroundB: string;
  children: React.ReactNode;
}

const FlyerShell = forwardRef<HTMLDivElement, FlyerShellProps>(function FlyerShell(
  { accent, title, subtitle, eyebrow, backgroundA, backgroundB, className, children },
  ref
) {
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
        border: `1px solid ${alpha('#fff', 0.08)}`,
        background: `radial-gradient(circle at 20% 15%, ${alpha(accent, 0.32)} 0%, transparent 30%),
          radial-gradient(circle at 82% 20%, ${alpha(backgroundB, 0.3)} 0%, transparent 28%),
          linear-gradient(145deg, ${backgroundA} 0%, #120f0d 52%, #0a0908 100%)`,
        boxShadow: `0 30px 100px ${alpha('#000', 0.55)}`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(circle at center, black 58%, transparent 100%)',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 24%, transparent 55%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 20,
          borderRadius: 5,
          border: '1px solid rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          p: { xs: 4, md: 6 },
          gap: 4,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.7,
                borderRadius: 99,
                bgcolor: alpha(accent, 0.14),
                color: accent,
                border: `1px solid ${alpha(accent, 0.25)}`,
                fontWeight: 900,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {eyebrow}
            </Typography>
            <Typography
              variant="h1"
              sx={{
                mt: 2,
                fontWeight: 900,
                lineHeight: 0.92,
                letterSpacing: '-0.08em',
                fontSize: { xs: '3rem', md: '5.3rem' },
                maxWidth: 520,
              }}
            >
              {title}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'right', maxWidth: 260 }}>
            <Logo app="root" variant="icon" size={72} />
            <Typography sx={{ mt: 1.5, fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.2em', opacity: 0.45 }}>
              LIVE DESIGN CANVAS
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' }, gap: 4, alignItems: 'stretch' }}>
          <Box sx={{ position: 'relative', minHeight: { xs: 420, md: '100%' } }}>{children}</Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderRadius: 5,
              p: 3,
              bgcolor: alpha('#fff', 0.035),
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ color: accent, fontWeight: 900, letterSpacing: '0.18em' }}>
                Kylrix Design Studio
              </Typography>
              <Typography variant="h5" sx={{ mt: 1.5, fontWeight: 800, lineHeight: 1.15 }}>
                {subtitle}
              </Typography>
            </Box>

            <Box sx={{ mt: 3, display: 'grid', gap: 1.5 }}>
              {[
                'Code-defined composition',
                'Realtime canvas editing',
                'Export-ready surface',
              ].map((label) => (
                <Box
                  key={label}
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderRadius: 3,
                    bgcolor: alpha('#fff', 0.04),
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.74)',
                    fontWeight: 600,
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.42)', letterSpacing: '0.2em' }}>
            {subtitle}
          </Typography>
          <Typography variant="caption" sx={{ color: accent, fontWeight: 800, letterSpacing: '0.14em' }}>
            {eyebrow}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
});

export default FlyerShell;
