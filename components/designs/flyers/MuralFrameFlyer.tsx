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
          backgroundColor: '#0A0908',
          zIndex: 0,
        }}
      />

      <MuralPattern />

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          backgroundColor: 'transparent',
        }}
      />
    </FlyerShell>
  );
});

export default MuralFrameFlyer;
