'use client';

import { Box, Typography } from '@mui/material';

type GlyphKind = 'emoji' | 'diamond' | 'triangle' | 'hex' | 'circle' | 'ring' | 'star' | 'pill';

interface MuralGlyph {
  kind: GlyphKind;
  top: string;
  left: string;
  size: number;
  opacity: number;
  rotation?: number;
  text?: string;
}

const GLYPHS: MuralGlyph[] = [
  { kind: 'emoji', text: '✨', top: '10%', left: '12%', size: 28, opacity: 0.34, rotation: -14 },
  { kind: 'diamond', top: '14%', left: '16%', size: 16, opacity: 0.28, rotation: 18 },
  { kind: 'star', top: '18%', left: '21%', size: 18, opacity: 0.3, rotation: -8 },
  { kind: 'triangle', top: '11%', left: '28%', size: 16, opacity: 0.22, rotation: 12 },
  { kind: 'emoji', text: '🫧', top: '19%', left: '33%', size: 24, opacity: 0.25, rotation: 5 },
  { kind: 'hex', top: '13%', left: '39%', size: 18, opacity: 0.24, rotation: 28 },
  { kind: 'circle', top: '17%', left: '45%', size: 10, opacity: 0.3 },
  { kind: 'ring', top: '11%', left: '51%', size: 16, opacity: 0.22, rotation: -14 },
  { kind: 'pill', top: '16%', left: '58%', size: 18, opacity: 0.24, rotation: 24 },
  { kind: 'emoji', text: '🕊️', top: '9%', left: '65%', size: 26, opacity: 0.28, rotation: -20 },
  { kind: 'diamond', top: '15%', left: '71%', size: 17, opacity: 0.26, rotation: 45 },
  { kind: 'star', top: '20%', left: '77%', size: 17, opacity: 0.24, rotation: 14 },
  { kind: 'triangle', top: '12%', left: '85%', size: 16, opacity: 0.22, rotation: -22 },
  { kind: 'emoji', text: '🌸', top: '24%', left: '10%', size: 24, opacity: 0.24, rotation: 10 },
  { kind: 'hex', top: '28%', left: '17%', size: 16, opacity: 0.2, rotation: 12 },
  { kind: 'circle', top: '22%', left: '24%', size: 12, opacity: 0.28 },
  { kind: 'pill', top: '27%', left: '30%', size: 20, opacity: 0.22, rotation: -32 },
  { kind: 'star', top: '29%', left: '36%', size: 16, opacity: 0.28, rotation: 6 },
  { kind: 'emoji', text: '🍃', top: '24%', left: '43%', size: 24, opacity: 0.22, rotation: -8 },
  { kind: 'triangle', top: '31%', left: '49%', size: 17, opacity: 0.23, rotation: 22 },
  { kind: 'diamond', top: '26%', left: '56%', size: 18, opacity: 0.24, rotation: 12 },
  { kind: 'ring', top: '30%', left: '62%', size: 15, opacity: 0.2, rotation: 0 },
  { kind: 'emoji', text: '💫', top: '23%', left: '69%', size: 25, opacity: 0.28, rotation: -15 },
  { kind: 'hex', top: '29%', left: '76%', size: 18, opacity: 0.23, rotation: 28 },
  { kind: 'circle', top: '25%', left: '83%', size: 11, opacity: 0.27 },
  { kind: 'emoji', text: '🤍', top: '21%', left: '89%', size: 23, opacity: 0.24, rotation: 6 },
  { kind: 'triangle', top: '37%', left: '11%', size: 15, opacity: 0.2, rotation: -18 },
  { kind: 'pill', top: '41%', left: '17%', size: 18, opacity: 0.22, rotation: 8 },
  { kind: 'diamond', top: '35%', left: '23%', size: 16, opacity: 0.25, rotation: -12 },
  { kind: 'emoji', text: '✨', top: '40%', left: '29%', size: 24, opacity: 0.3, rotation: 12 },
  { kind: 'circle', top: '36%', left: '36%', size: 10, opacity: 0.28 },
  { kind: 'star', top: '42%', left: '41%', size: 18, opacity: 0.24, rotation: -6 },
  { kind: 'hex', top: '38%', left: '47%', size: 17, opacity: 0.22, rotation: 4 },
  { kind: 'emoji', text: '🌙', top: '41%', left: '54%', size: 25, opacity: 0.22, rotation: -18 },
  { kind: 'triangle', top: '36%', left: '60%', size: 16, opacity: 0.2, rotation: 34 },
  { kind: 'ring', top: '42%', left: '67%', size: 15, opacity: 0.22, rotation: 10 },
  { kind: 'diamond', top: '38%', left: '73%', size: 17, opacity: 0.24, rotation: 45 },
  { kind: 'pill', top: '44%', left: '79%', size: 19, opacity: 0.18, rotation: -24 },
  { kind: 'emoji', text: '🫧', top: '39%', left: '86%', size: 23, opacity: 0.22, rotation: -8 },
  { kind: 'circle', top: '46%', left: '12%', size: 12, opacity: 0.24 },
  { kind: 'hex', top: '49%', left: '18%', size: 17, opacity: 0.22, rotation: 12 },
  { kind: 'emoji', text: '✨', top: '47%', left: '25%', size: 26, opacity: 0.3, rotation: -10 },
  { kind: 'diamond', top: '50%', left: '32%', size: 17, opacity: 0.22, rotation: 26 },
  { kind: 'triangle', top: '45%', left: '38%', size: 16, opacity: 0.2, rotation: 18 },
  { kind: 'emoji', text: '🍃', top: '51%', left: '45%', size: 24, opacity: 0.22, rotation: 8 },
  { kind: 'star', top: '48%', left: '51%', size: 17, opacity: 0.25, rotation: -6 },
  { kind: 'ring', top: '53%', left: '58%', size: 16, opacity: 0.21 },
  { kind: 'pill', top: '47%', left: '65%', size: 20, opacity: 0.23, rotation: 22 },
  { kind: 'emoji', text: '🌸', top: '52%', left: '72%', size: 23, opacity: 0.24, rotation: -14 },
  { kind: 'hex', top: '48%', left: '79%', size: 18, opacity: 0.22, rotation: 33 },
  { kind: 'diamond', top: '54%', left: '86%', size: 16, opacity: 0.2, rotation: 0 },
  { kind: 'emoji', text: '🫧', top: '61%', left: '13%', size: 24, opacity: 0.22, rotation: 8 },
  { kind: 'triangle', top: '65%', left: '19%', size: 16, opacity: 0.18, rotation: -20 },
  { kind: 'diamond', top: '59%', left: '26%', size: 16, opacity: 0.22, rotation: 45 },
  { kind: 'circle', top: '63%', left: '33%', size: 11, opacity: 0.25 },
  { kind: 'emoji', text: '✨', top: '60%', left: '40%', size: 25, opacity: 0.28, rotation: -8 },
  { kind: 'hex', top: '66%', left: '47%', size: 17, opacity: 0.22, rotation: 18 },
  { kind: 'star', top: '61%', left: '54%', size: 17, opacity: 0.24, rotation: 14 },
  { kind: 'ring', top: '65%', left: '61%', size: 15, opacity: 0.2 },
  { kind: 'pill', top: '59%', left: '68%', size: 20, opacity: 0.22, rotation: -26 },
  { kind: 'emoji', text: '🕊️', top: '64%', left: '75%', size: 26, opacity: 0.24, rotation: 12 },
  { kind: 'triangle', top: '61%', left: '82%', size: 16, opacity: 0.18, rotation: 38 },
  { kind: 'diamond', top: '67%', left: '89%', size: 16, opacity: 0.21, rotation: 0 },
  { kind: 'circle', top: '76%', left: '11%', size: 12, opacity: 0.24 },
  { kind: 'emoji', text: '🤍', top: '81%', left: '17%', size: 22, opacity: 0.22, rotation: -6 },
  { kind: 'hex', top: '77%', left: '23%', size: 16, opacity: 0.2, rotation: 21 },
  { kind: 'star', top: '80%', left: '30%', size: 18, opacity: 0.25, rotation: -12 },
  { kind: 'triangle', top: '74%', left: '36%', size: 16, opacity: 0.18, rotation: 6 },
  { kind: 'emoji', text: '🍃', top: '79%', left: '43%', size: 24, opacity: 0.21, rotation: 12 },
  { kind: 'diamond', top: '76%', left: '50%', size: 17, opacity: 0.22, rotation: 45 },
  { kind: 'ring', top: '82%', left: '57%', size: 15, opacity: 0.19 },
  { kind: 'pill', top: '77%', left: '64%', size: 19, opacity: 0.2, rotation: 28 },
  { kind: 'emoji', text: '✨', top: '81%', left: '71%', size: 24, opacity: 0.28, rotation: -16 },
  { kind: 'hex', top: '75%', left: '78%', size: 18, opacity: 0.22, rotation: 12 },
  { kind: 'circle', top: '79%', left: '84%', size: 10, opacity: 0.22 },
  { kind: 'triangle', top: '83%', left: '90%', size: 16, opacity: 0.18, rotation: -28 },
];

const MuralGlyphShape = ({ glyph }: { glyph: MuralGlyph }) => {
  const common = {
    position: 'absolute' as const,
    top: glyph.top,
    left: glyph.left,
    opacity: glyph.opacity,
    transform: `translate(-50%, -50%) rotate(${glyph.rotation ?? 0}deg)`,
    color: '#f3f0ea',
    filter: 'grayscale(1) brightness(1.2) contrast(0.85) drop-shadow(0 0 4px rgba(255,255,255,0.08))',
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
  };

  switch (glyph.kind) {
    case 'emoji':
      return (
        <Typography sx={{ ...common, fontSize: glyph.size, lineHeight: 1 }}>
          {glyph.text}
        </Typography>
      );
    case 'diamond':
      return (
        <Box
          sx={{
            ...common,
            width: glyph.size,
            height: glyph.size,
            bgcolor: 'currentColor',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          }}
        />
      );
    case 'triangle':
      return (
        <Box
          sx={{
            ...common,
            width: glyph.size,
            height: glyph.size,
            bgcolor: 'currentColor',
            clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
          }}
        />
      );
    case 'hex':
      return (
        <Box
          sx={{
            ...common,
            width: glyph.size,
            height: glyph.size * 0.9,
            bgcolor: 'currentColor',
            clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)',
          }}
        />
      );
    case 'circle':
      return (
        <Box
          sx={{
            ...common,
            width: glyph.size,
            height: glyph.size,
            borderRadius: '50%',
            bgcolor: 'currentColor',
          }}
        />
      );
    case 'ring':
      return (
        <Box
          sx={{
            ...common,
            width: glyph.size,
            height: glyph.size,
            borderRadius: '50%',
            border: '1.5px solid currentColor',
          }}
        />
      );
    case 'star':
      return (
        <Box
          sx={{
            ...common,
            width: glyph.size,
            height: glyph.size,
            bgcolor: 'currentColor',
            clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 72%, 21% 92%, 32% 57%, 2% 35%, 39% 35%)',
          }}
        />
      );
    case 'pill':
      return (
        <Box
          sx={{
            ...common,
            width: glyph.size * 1.6,
            height: glyph.size * 0.52,
            borderRadius: '999px',
            bgcolor: 'currentColor',
          }}
        />
      );
    default:
      return null;
  }
};

export default function MuralPattern() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: `
          radial-gradient(circle at 20% 22%, rgba(255,255,255,0.05) 0%, transparent 36%),
          radial-gradient(circle at 54% 16%, rgba(255,255,255,0.035) 0%, transparent 34%),
          radial-gradient(circle at 82% 74%, rgba(255,255,255,0.04) 0%, transparent 38%)
        `,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: '-8%',
          opacity: 0.8,
          filter: 'blur(2px)',
        }}
      >
        {GLYPHS.map((glyph, index) => (
          <MuralGlyphShape key={`${glyph.kind}-${index}`} glyph={glyph} />
        ))}
      </Box>

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at 25% 28%, rgba(255,255,255,0.04) 0 2px, transparent 3px),
            radial-gradient(circle at 68% 42%, rgba(255,255,255,0.03) 0 2px, transparent 3px),
            radial-gradient(circle at 44% 68%, rgba(255,255,255,0.03) 0 2px, transparent 3px)
          `,
          opacity: 0.45,
        }}
      />
    </Box>
  );
}
