'use client';

import { forwardRef } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { Sparkles, Egg, Rabbit } from 'lucide-react';
import FlyerShell from './FlyerShell';
import CodeOrnamentScene from '../CodeOrnamentScene';
import type { DesignFlyerProps } from '../types';

const Orb = ({ size, color, left, top, blur = 0 }: { size: number; color: string; left: string; top: string; blur?: number }) => (
  <Box
    sx={{
      position: 'absolute',
      left,
      top,
      width: size,
      height: size,
      borderRadius: '999px',
      bgcolor: color,
      filter: `blur(${blur}px)`,
      opacity: 0.85,
    }}
  />
);

const HappyEasterFlyer = forwardRef<HTMLDivElement, DesignFlyerProps>(function HappyEasterFlyer(props, ref) {
  return (
    <FlyerShell
      ref={ref}
      {...props}
      accent="#EC4899"
      backgroundA="#241214"
      backgroundB="#F59E0B"
      eyebrow="SEASONAL DROP / HAPPY EASTER"
      title={
        <>
          Happy
          <br />
          Easter
        </>
      }
      subtitle="A bright little release flyer that lives in code, can be edited instantly, and is ready to ship as a visual asset."
    >
      <Box sx={{ position: 'absolute', inset: 0, borderRadius: 5, overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(236,72,153,0.20) 0%, rgba(255,255,255,0.03) 35%, rgba(10,9,8,0.85) 100%)',
          }}
        />

        <CodeOrnamentScene accent="#FBCFE8" secondary="#FEF3C7" tertiary="#F59E0B" />

        <Orb size={220} color={alpha('#EC4899', 0.28)} left="-40px" top="10%" blur={80} />
        <Orb size={170} color={alpha('#F59E0B', 0.22)} left="58%" top="14%" blur={70} />
        <Orb size={120} color={alpha('#FFFFFF', 0.12)} left="72%" top="56%" blur={48} />

        <Box
          sx={{
            position: 'absolute',
            left: 24,
            bottom: 24,
            right: 24,
            display: 'grid',
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.85,
              borderRadius: 999,
              width: 'fit-content',
              bgcolor: alpha('#fff', 0.08),
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Sparkles size={14} />
            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.16em' }}>
              CODE-CRAFTED FLYER
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <Box
              sx={{
                p: 2.25,
                borderRadius: 4,
                bgcolor: alpha('#0a0908', 0.55),
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <Typography variant="subtitle2" sx={{ opacity: 0.52, letterSpacing: '0.14em', mb: 0.8 }}>
                TOOLS
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.75 }}>
                Live edits. Reusable logos. Export-on-demand. All in one design loop.
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2.25,
                borderRadius: 4,
                bgcolor: alpha('#fff', 0.05),
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: '#FDE68A', fontWeight: 900, letterSpacing: '0.16em' }}>
                EASTER ENERGY
              </Typography>
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                {[
                  { icon: Egg, label: 'Pastel' },
                  { icon: Rabbit, label: 'Playful' },
                  { icon: Sparkles, label: '3D' },
                ].map(({ icon: Icon, label }) => (
                  <Box
                    key={label}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.25,
                      py: 0.8,
                      borderRadius: 999,
                      bgcolor: alpha('#fff', 0.08),
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Icon size={14} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </FlyerShell>
  );
});

export default HappyEasterFlyer;
