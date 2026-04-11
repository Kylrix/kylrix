'use client';

import { Box, alpha } from '@mui/material';

type MuralGlyphKind = 'dot' | 'diamond' | 'dash' | 'cross' | 'arc' | 'ring';

interface MuralGlyph {
  kind: MuralGlyphKind;
  top: string;
  left: string;
  size: number;
  opacity: number;
  rotation?: number;
}

const GLYPHS: MuralGlyph[] = [
  { kind: 'dot', top: '8%', left: '12%', size: 5, opacity: 0.4 },
  { kind: 'dot', top: '12%', left: '26%', size: 4, opacity: 0.32 },
  { kind: 'diamond', top: '7%', left: '42%', size: 7, opacity: 0.28, rotation: 45 },
  { kind: 'dash', top: '14%', left: '58%', size: 10, opacity: 0.3, rotation: 18 },
  { kind: 'ring', top: '10%', left: '75%', size: 9, opacity: 0.22 },
  { kind: 'cross', top: '18%', left: '86%', size: 8, opacity: 0.24, rotation: 8 },
  { kind: 'dot', top: '22%', left: '8%', size: 4, opacity: 0.24 },
  { kind: 'dash', top: '24%', left: '18%', size: 8, opacity: 0.28, rotation: -22 },
  { kind: 'arc', top: '20%', left: '34%', size: 11, opacity: 0.2, rotation: 0 },
  { kind: 'dot', top: '27%', left: '48%', size: 5, opacity: 0.35 },
  { kind: 'diamond', top: '24%', left: '67%', size: 6, opacity: 0.26, rotation: 20 },
  { kind: 'ring', top: '30%', left: '81%', size: 8, opacity: 0.22 },
  { kind: 'cross', top: '35%', left: '15%', size: 7, opacity: 0.22 },
  { kind: 'dot', top: '38%', left: '30%', size: 4, opacity: 0.3 },
  { kind: 'dash', top: '36%', left: '43%', size: 11, opacity: 0.26, rotation: 13 },
  { kind: 'arc', top: '40%', left: '60%', size: 12, opacity: 0.18, rotation: -8 },
  { kind: 'dot', top: '42%', left: '73%', size: 5, opacity: 0.28 },
  { kind: 'diamond', top: '39%', left: '89%', size: 7, opacity: 0.2, rotation: 45 },
  { kind: 'ring', top: '49%', left: '10%', size: 8, opacity: 0.18 },
  { kind: 'dash', top: '47%', left: '23%', size: 9, opacity: 0.25, rotation: -35 },
  { kind: 'dot', top: '50%', left: '39%', size: 4, opacity: 0.22 },
  { kind: 'cross', top: '53%', left: '56%', size: 8, opacity: 0.18 },
  { kind: 'diamond', top: '49%', left: '69%', size: 6, opacity: 0.25, rotation: 45 },
  { kind: 'ring', top: '55%', left: '84%', size: 10, opacity: 0.18 },
  { kind: 'dot', top: '62%', left: '16%', size: 4, opacity: 0.24 },
  { kind: 'arc', top: '64%', left: '28%', size: 12, opacity: 0.18, rotation: 22 },
  { kind: 'dash', top: '66%', left: '47%', size: 10, opacity: 0.3, rotation: -12 },
  { kind: 'dot', top: '69%', left: '62%', size: 5, opacity: 0.25 },
  { kind: 'cross', top: '66%', left: '77%', size: 7, opacity: 0.18 },
  { kind: 'diamond', top: '73%', left: '88%', size: 7, opacity: 0.24, rotation: 45 },
  { kind: 'ring', top: '79%', left: '10%', size: 9, opacity: 0.18 },
  { kind: 'dot', top: '82%', left: '24%', size: 4, opacity: 0.26 },
  { kind: 'dash', top: '80%', left: '41%', size: 10, opacity: 0.24, rotation: 28 },
  { kind: 'arc', top: '83%', left: '58%', size: 11, opacity: 0.2, rotation: -18 },
  { kind: 'dot', top: '86%', left: '73%', size: 5, opacity: 0.3 },
  { kind: 'cross', top: '84%', left: '91%', size: 8, opacity: 0.22 },
];

const MuralGlyphShape = ({ glyph }: { glyph: MuralGlyph }) => {
  const base = {
    position: 'absolute' as const,
    top: glyph.top,
    left: glyph.left,
    width: glyph.size,
    height: glyph.size,
    opacity: glyph.opacity,
    transform: `translate(-50%, -50%) rotate(${glyph.rotation ?? 0}deg)`,
    color: alpha('#ffffff', 0.82),
    filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.1))',
  };

  switch (glyph.kind) {
    case 'dot':
      return <Box sx={{ ...base, borderRadius: '50%', bgcolor: 'currentColor' }} />;
    case 'diamond':
      return <Box sx={{ ...base, borderRadius: '2px', bgcolor: 'currentColor', transform: `${base.transform} rotate(45deg)` }} />;
    case 'dash':
      return <Box sx={{ ...base, width: glyph.size * 1.8, height: 2, borderRadius: 999, bgcolor: 'currentColor' }} />;
    case 'cross':
      return (
        <Box sx={{ ...base, width: glyph.size, height: glyph.size }}>
          <Box sx={{ position: 'absolute', inset: 0, borderTop: '1px solid currentColor', transform: 'rotate(45deg)' }} />
          <Box sx={{ position: 'absolute', inset: 0, borderTop: '1px solid currentColor', transform: 'rotate(-45deg)' }} />
        </Box>
      );
    case 'arc':
      return (
        <Box
          sx={{
            ...base,
            width: glyph.size * 1.6,
            height: glyph.size * 1.1,
            borderTop: '1px solid currentColor',
            borderLeft: '1px solid currentColor',
            borderRadius: '100% 0 0 0',
            opacity: glyph.opacity * 0.9,
          }}
        />
      );
    case 'ring':
      return (
        <Box
          sx={{
            ...base,
            borderRadius: '50%',
            border: '1px solid currentColor',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
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
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 12%, rgba(255,255,255,0.08) 0 1px, transparent 1.4px),
            radial-gradient(circle at 74% 24%, rgba(255,255,255,0.06) 0 1px, transparent 1.2px),
            radial-gradient(circle at 38% 54%, rgba(255,255,255,0.05) 0 1px, transparent 1.3px),
            radial-gradient(circle at 86% 74%, rgba(255,255,255,0.07) 0 1px, transparent 1.5px),
            radial-gradient(circle at 14% 84%, rgba(255,255,255,0.05) 0 1px, transparent 1.2px)
          `,
          backgroundSize: '280px 280px, 340px 340px, 300px 300px, 260px 260px, 220px 220px',
          opacity: 0.55,
        }}
      />

      {GLYPHS.map((glyph, index) => (
        <MuralGlyphShape key={`${glyph.kind}-${index}`} glyph={glyph} />
      ))}

      <Box
        sx={{
          position: 'absolute',
          inset: '-10%',
          background: `
            linear-gradient(135deg, transparent 0 46%, rgba(255,255,255,0.04) 46.2% 46.6%, transparent 46.8% 100%),
            linear-gradient(45deg, transparent 0 48%, rgba(255,255,255,0.025) 48.2% 48.6%, transparent 48.8% 100%)
          `,
          opacity: 0.35,
          transform: 'rotate(-2deg)',
        }}
      />
    </Box>
  );
}
