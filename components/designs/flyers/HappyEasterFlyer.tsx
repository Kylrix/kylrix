'use client';

import { forwardRef } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import Logo from '@/components/Logo';
import FlyerShell from './FlyerShell';
import type { DesignFlyerProps } from '../types';

const HappyEasterFlyer = forwardRef<HTMLDivElement, DesignFlyerProps>(function HappyEasterFlyer(props, ref) {
  return (
    <FlyerShell
      ref={ref}
      {...props}
      variant="raw"
      accent="#6366F1"
      backgroundA="#0A0908"
      backgroundB="#0A0908"
      eyebrow=""
      title=""
      subtitle=""
    >
      {/* 1. Macro Stone Texture Field (Full Coverage) */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/designs/stone-tomb.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'grayscale(1) brightness(0.4) contrast(1.2)',
          zIndex: 1,
        }}
      />

      {/* 2. Diagonal Composition: Text High-Left */}
      <Box
        sx={{
          position: 'absolute',
          left: '8%',
          top: '12%',
          zIndex: 10,
          maxWidth: '70%',
        }}
      >
        <Typography
          sx={{
            fontFamily: 'serif', // Distressed Serif feel
            fontSize: { xs: '5rem', md: '10rem' },
            fontWeight: 900,
            lineHeight: 0.85,
            color: 'white',
            letterSpacing: '-0.04em',
            textShadow: `
              0 0 20px rgba(99, 102, 241, 0.4),
              2px 2px 0px rgba(0,0,0,0.8)
            `,
            filter: 'contrast(1.5) brightness(1.2)',
            mixBlendMode: 'difference',
          }}
        >
          HE IS
          <br />
          RISEN
        </Typography>
      </Box>

      {/* 3. The Prismatic Ascension Burst (Bottom-Right) */}
      <Box
        sx={{
          position: 'absolute',
          right: '-10%',
          bottom: '-15%',
          width: '100%',
          height: '100%',
          zIndex: 5,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        }}
      >
        {/* The Geometric Prism Burst */}
        <Box
          component="img"
          src="/designs/ascension-prism.svg"
          sx={{
            width: '120%',
            height: '120%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 60px rgba(168, 85, 247, 0.4))',
            transform: 'rotate(-15deg)',
          }}
        />
      </Box>

      {/* 4. Etched Sub-Text (Subtle & Challenging) */}
      <Box
        sx={{
          position: 'absolute',
          left: '10%',
          bottom: '22%',
          zIndex: 6,
          opacity: 0.85,
        }}
      >
        <Typography
          sx={{
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: '0.5em',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
          }}
        >
          AWAKEN YOUR PRODUCTIVITY
        </Typography>
      </Box>

      {/* 5. Architectural Branding (Bottom Base) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '5%',
          left: '8%',
          right: '8%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <Box sx={{ opacity: 0.7, filter: 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.4))' }}>
          <Logo app="root" variant="icon" size={76} />
        </Box>
        
        <Typography
          sx={{
            fontFamily: 'var(--font-mono)',
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: '0.6em',
            color: 'white',
          }}
        >
          kylrix.space
        </Typography>
      </Box>

      {/* 6. Dynamic Light Bleed & Overlays */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
            linear-gradient(45deg, rgba(0,0,0,0.8) 0%, transparent 100%)
          `,
          zIndex: 4,
          pointerEvents: 'none',
        }}
      />

      {/* Premium Visible Grain/Texture Overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.08,
          pointerEvents: 'none',
          zIndex: 25,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </FlyerShell>
  );
});

export default HappyEasterFlyer;
