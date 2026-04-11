'use client';

import { forwardRef } from 'react';
import { Box, Stack, Typography, alpha } from '@mui/material';
import Logo from '@/components/Logo';
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
            radial-gradient(circle at 16% 18%, rgba(236,72,153,0.12) 0%, transparent 34%),
            radial-gradient(circle at 84% 76%, rgba(99,102,241,0.12) 0%, transparent 36%),
            linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 48%)
          `,
          zIndex: 0,
        }}
      />

      <MuralPattern />

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          p: { xs: 3, md: 5 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography
              sx={{
                fontSize: 12,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: alpha('#ffffff', 0.52),
                fontWeight: 900,
              }}
            >
              Design Frame 01
            </Typography>
            <Typography
              sx={{
                mt: 1,
                fontSize: { xs: '2.1rem', md: '3.2rem' },
                lineHeight: 0.95,
                fontWeight: 900,
                letterSpacing: '-0.05em',
                color: 'white',
                maxWidth: 540,
              }}
            >
              Code-first mural field
            </Typography>
            <Typography
              sx={{
                mt: 1.5,
                maxWidth: 520,
                color: alpha('#ffffff', 0.66),
                fontSize: { xs: '0.95rem', md: '1rem' },
                lineHeight: 1.7,
              }}
            >
              A reusable frame for building tiny background objects in layers, so we can extend the pattern
              step by step without changing the dark canvas.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#EC4899', boxShadow: '0 0 12px rgba(236,72,153,0.5)' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: alpha('#ffffff', 0.72) }}>
              Mural Draft
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            alignSelf: 'center',
            width: 'min(100%, 760px)',
            aspectRatio: '3 / 2',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.025)',
            boxShadow: '0 30px 100px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(18px)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
              `,
              backgroundSize: '56px 56px',
              opacity: 0.35,
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 18,
              borderRadius: 4,
              border: '1px dashed rgba(255,255,255,0.14)',
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 36,
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(10,9,8,0.34)',
              overflow: 'hidden',
            }}
          >
            <MuralPattern />

            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 220px', gap: 0 }}>
              <Box sx={{ position: 'relative', p: 3, display: 'flex', alignItems: 'flex-end' }}>
                <Box sx={{ maxWidth: 420 }}>
                  <Typography sx={{ fontSize: 12, letterSpacing: '0.3em', fontWeight: 800, textTransform: 'uppercase', color: alpha('#fff', 0.48) }}>
                    Incremental layer space
                  </Typography>
                  <Typography sx={{ mt: 1, fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                    Add more tiny objects here as the mural evolves.
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: 'rgba(255,255,255,0.02)',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: alpha('#fff', 0.45), fontWeight: 900 }}>
                    Object families
                  </Typography>
                  <Stack spacing={1.1} sx={{ mt: 1.5 }}>
                    {['dot', 'diamond', 'dash', 'cross', 'ring'].map((item) => (
                      <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: item === 'dot' ? '50%' : item === 'ring' ? '50%' : '2px', border: item === 'ring' ? '1px solid rgba(255,255,255,0.5)' : 'none', bgcolor: item === 'dot' ? 'rgba(255,255,255,0.8)' : item === 'ring' ? 'transparent' : 'rgba(255,255,255,0.8)', transform: item === 'diamond' ? 'rotate(45deg)' : 'none' }} />
                        <Typography sx={{ fontSize: 12, color: alpha('#fff', 0.7), fontWeight: 700, textTransform: 'capitalize' }}>{item}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ p: 1.5, borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', color: alpha('#fff', 0.45), fontWeight: 900 }}>
                    Guide
                  </Typography>
                  <Typography sx={{ mt: 0.8, fontSize: 12.5, lineHeight: 1.6, color: alpha('#fff', 0.72) }}>
                    The mural should stay subtle, bright, and code-driven.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Logo app="root" variant="icon" size={46} />
            <Box>
              <Typography sx={{ fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: alpha('#fff', 0.46), fontWeight: 900 }}>
                Kylrix Designs
              </Typography>
              <Typography sx={{ mt: 0.6, fontSize: 13, color: alpha('#fff', 0.7) }}>
                Add, edit, and export the mural in code.
              </Typography>
            </Box>
          </Box>

          <Typography
            sx={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: alpha('#fff', 0.52),
            }}
          >
            tiny objects / subtle glow / dark field
          </Typography>
        </Stack>
      </Box>
    </FlyerShell>
  );
});

export default MuralFrameFlyer;
