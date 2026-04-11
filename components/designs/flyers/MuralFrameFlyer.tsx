'use client';

import { forwardRef } from 'react';
import { Box } from '@mui/material';
import FlyerShell from './FlyerShell';
import MuralPattern from './MuralPattern';
import type { DesignFlyerProps } from '../types';

const MuralFrameFlyer = forwardRef<HTMLDivElement, DesignFlyerProps>(function MuralFrameFlyer(props, ref) {
  return (
    <FlyerShell
      ref={ref}
      {...props}
      variant="raw"
      accent="#EC4899"
      backgroundA="#0A0908"
      backgroundB="#0A0908"
      eyebrow=""
      title=""
      subtitle=""
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at 18% 16%, rgba(255,255,255,0.05) 0%, transparent 28%),
            radial-gradient(circle at 78% 82%, rgba(255,255,255,0.04) 0%, transparent 30%),
            radial-gradient(circle at 42% 54%, rgba(255,255,255,0.02) 0%, transparent 40%)
          `,
          zIndex: 0,
        }}
      />

      <MuralPattern />

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          opacity: 0.24,
          backgroundImage: `
            radial-gradient(circle at 30% 30%, rgba(255,255,255,0.05) 0 1px, transparent 1.4px),
            radial-gradient(circle at 70% 30%, rgba(255,255,255,0.03) 0 1px, transparent 1.4px),
            radial-gradient(circle at 55% 72%, rgba(255,255,255,0.04) 0 1px, transparent 1.4px)
          `,
          backgroundSize: '210px 210px, 240px 240px, 180px 180px',
        }}
      />
    </FlyerShell>
  );
});

export default MuralFrameFlyer;
