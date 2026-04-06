'use client';

import { Box, alpha } from '@mui/material';

interface CodeOrnamentSceneProps {
  accent: string;
  secondary: string;
  tertiary: string;
}

const Egg = ({
  color,
  left,
  top,
  size,
  rotate,
  blur = 0,
  glow,
}: {
  color: string;
  left: string;
  top: string;
  size: number;
  rotate: number;
  blur?: number;
  glow: string;
}) => (
  <Box
    sx={{
      position: 'absolute',
      left,
      top,
      width: size,
      height: size * 1.28,
      borderRadius: '52% 52% 46% 46% / 58% 58% 42% 42%',
      transform: `rotate(${rotate}deg)`,
      background: `
        radial-gradient(circle at 30% 22%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.34) 10%, transparent 18%),
        radial-gradient(circle at 40% 28%, ${alpha(color, 0.98)} 0%, ${alpha(color, 0.92)} 42%, ${alpha(glow, 0.88)} 100%)
      `,
      boxShadow: `
        0 28px 70px rgba(0,0,0,0.52),
        inset 0 1px 0 rgba(255,255,255,0.4),
        inset 0 -18px 24px rgba(0,0,0,0.14),
        0 0 48px ${alpha(glow, 0.32)}
      `,
      filter: `blur(${blur}px)`,
      border: '1px solid rgba(255,255,255,0.14)',
    }}
  />
);

export default function CodeOrnamentScene({ accent, secondary, tertiary }: CodeOrnamentSceneProps) {
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <Box
        sx={{
          position: 'absolute',
          inset: '-12%',
          background: `
            radial-gradient(circle at 50% 28%, ${alpha(accent, 0.28)} 0%, transparent 26%),
            radial-gradient(circle at 70% 18%, ${alpha(secondary, 0.2)} 0%, transparent 20%),
            radial-gradient(circle at 34% 82%, ${alpha(tertiary, 0.18)} 0%, transparent 24%)
          `,
          filter: 'blur(24px)',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          inset: '10% 14%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 36%, transparent 70%)',
          filter: 'blur(14px)',
          opacity: 0.5,
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          left: '14%',
          top: '18%',
          width: '44%',
          height: '54%',
          borderRadius: '55% 45% 50% 50% / 65% 60% 40% 35%',
          background: `
            linear-gradient(145deg, ${alpha(accent, 0.95)} 0%, ${alpha('#fff', 0.15)} 22%, ${alpha(accent, 0.9)} 58%, ${alpha('#160d0d', 0.7)} 100%)
          `,
          transform: 'rotate(-7deg) skewX(-2deg)',
          boxShadow: `
            0 50px 120px rgba(0,0,0,0.56),
            inset 0 1px 0 rgba(255,255,255,0.32),
            inset -18px -26px 36px rgba(0,0,0,0.18),
            0 0 80px ${alpha(accent, 0.22)}
          `,
          border: '1px solid rgba(255,255,255,0.16)',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          left: '56%',
          top: '24%',
          width: '30%',
          height: '40%',
          borderRadius: '52% 48% 50% 50% / 60% 58% 42% 40%',
          background: `
            linear-gradient(160deg, ${alpha(secondary, 0.98)} 0%, ${alpha('#fff', 0.28)} 24%, ${alpha(secondary, 0.88)} 64%, ${alpha('#7a5206', 0.82)} 100%)
          `,
          transform: 'rotate(13deg)',
          boxShadow: `
            0 38px 90px rgba(0,0,0,0.42),
            inset 0 1px 0 rgba(255,255,255,0.38),
            inset -16px -22px 28px rgba(0,0,0,0.14),
            0 0 70px ${alpha(secondary, 0.18)}
          `,
          border: '1px solid rgba(255,255,255,0.14)',
        }}
      />

      <Egg color="#fff4d6" glow={tertiary} left="73%" top="58%" size={148} rotate={-16} />
      <Egg color="#fb8bb1" glow={accent} left="8%" top="64%" size={112} rotate={15} blur={0} />
      <Egg color="#f8dd9c" glow={secondary} left="18%" top="70%" size={76} rotate={-8} blur={0} />

      <Box
        sx={{
          position: 'absolute',
          left: '8%',
          bottom: '12%',
          width: '22%',
          height: '12%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,0,0,0.34) 0%, transparent 72%)',
          filter: 'blur(18px)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          right: '11%',
          bottom: '14%',
          width: '18%',
          height: '10%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,0,0,0.34) 0%, transparent 72%)',
          filter: 'blur(16px)',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
          opacity: 0.22,
          maskImage: 'radial-gradient(circle at center, black 45%, transparent 82%)',
        }}
      />
    </Box>
  );
}
