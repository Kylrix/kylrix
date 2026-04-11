'use client';

import { Box } from '@mui/material';

const TILE_SIZE = 280;
const STROKE = '#f3f0ea';

type Motif = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
  width: number;
  type: 'poly' | 'phone' | 'screen' | 'stick' | 'laugh' | 'run' | 'spark' | 'slash';
};

const createRng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const rng = createRng(0x8c21b33);

const motifTypes: Motif['type'][] = [
  'poly',
  'phone',
  'screen',
  'stick',
  'laugh',
  'run',
  'spark',
  'slash',
];

const makeMotif = (index: number): Motif => {
  const col = index % 5;
  const row = Math.floor(index / 5);
  const baseX = col * 56 + 28;
  const baseY = row * 56 + 28;
  const type = motifTypes[index % motifTypes.length];

  return {
    x: baseX + (rng() - 0.5) * 18,
    y: baseY + (rng() - 0.5) * 18,
    rotate: (rng() - 0.5) * 46,
    scale: 0.75 + rng() * 0.7,
    opacity: 0.34 + rng() * 0.46,
    width: 0.9 + rng() * 1.5,
    type,
  };
};

const motifs = Array.from({ length: 36 }, (_, index) => makeMotif(index));

const line = (x1: number, y1: number, x2: number, y2: number, strokeWidth: number, opacity: number, dash?: string) => `
  <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${STROKE}" stroke-width="${strokeWidth.toFixed(2)}" stroke-opacity="${opacity.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;

const poly = (points: string, strokeWidth: number, opacity: number) => `
  <polygon points="${points}" fill="none" stroke="${STROKE}" stroke-width="${strokeWidth.toFixed(2)}" stroke-opacity="${opacity.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round" />`;

const path = (d: string, strokeWidth: number, opacity: number, dash?: string) => `
  <path d="${d}" fill="none" stroke="${STROKE}" stroke-width="${strokeWidth.toFixed(2)}" stroke-opacity="${opacity.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;

const polyCluster = () => [
  poly('10 2 20 8 18 19 9 22 2 14 3 6', 1.3, 0.8),
  poly('6 5 16 3 22 12 16 21 5 18 2 10', 1.05, 0.6),
  line(3, 11, 22, 11, 1, 0.48),
  line(10, 2, 10, 22, 1, 0.38),
  line(4, 5, 20, 19, 1, 0.34),
];

const phoneOutline = () => [
  poly('6 2 18 2 21 5 21 21 18 24 6 24 3 21 3 5', 1.3, 0.8),
  line(6, 6, 18, 6, 1, 0.42),
  line(6, 9, 18, 9, 1, 0.28),
  line(6, 12, 18, 12, 1, 0.25, '2 2'),
  line(6, 16, 11, 16, 1, 0.42),
  line(13, 16, 18, 16, 1, 0.42),
  line(10, 21, 14, 21, 1.1, 0.7),
];

const screenOutline = () => [
  poly('3 4 21 4 21 19 17 23 3 23', 1.25, 0.75),
  line(3, 8, 21, 8, 1, 0.38),
  line(6, 12, 18, 12, 1, 0.3),
  line(6, 16, 16, 16, 1, 0.28),
  line(14, 19, 19, 23, 1, 0.42),
];

const stickFigure = (mood: 'smile' | 'laugh' | 'wave') => [
  poly('10 2 14 4 15 8 12 11 8 11 5 8 6 4', 1.15, 0.74),
  line(11, 11, 11, 19, 1.35, 0.82),
  line(11, 13, 6, 16, 1.15, 0.72),
  line(11, 13, 16, 16, 1.15, 0.72),
  line(11, 19, 7, 24, 1.15, 0.72),
  line(11, 19, 15, 24, 1.15, 0.72),
  ...(mood === 'wave'
    ? [line(16, 10, 21, 6, 1.15, 0.76), line(18, 7, 22, 4, 1.05, 0.6)]
    : []),
  ...(mood === 'laugh'
    ? [line(8, 6, 9, 6, 1, 0.55), line(13, 6, 14, 6, 1, 0.55), line(8, 9, 14, 9, 1, 0.55, '1 1')]
    : [line(8, 6, 9, 6, 1, 0.48), line(13, 6, 14, 6, 1, 0.48), line(8, 9, 14, 9, 1, 0.38)]),
];

const runningKid = (flip = false) => [
  poly(flip ? '8 2 13 4 15 9 12 12 7 11 5 7' : '6 2 11 4 13 9 10 12 5 11 3 7', 1.1, 0.78),
  line(flip ? 10 : 8, 12, flip ? 14 : 12, 15, 1.25, 0.8),
  line(flip ? 14 : 12, 15, flip ? 19 : 17, 13, 1.15, 0.72),
  line(flip ? 12 : 10, 15, flip ? 8 : 6, 20, 1.15, 0.72),
  line(flip ? 12 : 10, 15, flip ? 16 : 20, 19, 1.15, 0.72),
  line(flip ? 15 : 13, 8, flip ? 20 : 18, 5, 1.05, 0.68),
  line(flip ? 18 : 16, 5, flip ? 22 : 20, 8, 1.0, 0.52),
];

const laughFace = () => [
  poly('9 2 15 4 18 10 16 17 9 20 4 17 2 10 4 4', 1.1, 0.72),
  line(7, 8, 9, 9, 1, 0.45),
  line(13, 8, 15, 9, 1, 0.45),
  path('M6 13 C8 16, 13 16, 16 13', 1.1, 0.7),
  line(7, 14, 8.5, 15.5, 1, 0.42),
  line(14, 14, 12.5, 15.5, 1, 0.42),
];

const spark = () => [
  line(12, 2, 12, 22, 1.1, 0.7),
  line(2, 12, 22, 12, 1.1, 0.7),
  line(5, 5, 19, 19, 1.1, 0.58),
  line(19, 5, 5, 19, 1.1, 0.58),
  line(7, 2, 17, 22, 0.95, 0.42),
  line(17, 2, 7, 22, 0.95, 0.42),
];

const slashField = () => [
  line(2, 5, 22, 19, 1.2, 0.62),
  line(4, 2, 18, 24, 1, 0.42, '3 3'),
  line(2, 21, 20, 4, 1.1, 0.56),
  line(5, 9, 23, 9, 1, 0.28),
];

const renderMotif = (motif: Motif) => {
  const body = (() => {
    switch (motif.type) {
      case 'poly':
        return polyCluster();
      case 'phone':
        return phoneOutline();
      case 'screen':
        return screenOutline();
      case 'stick':
        return stickFigure(motif.opacity > 0.62 ? 'laugh' : motif.opacity > 0.5 ? 'wave' : 'smile');
      case 'laugh':
        return laughFace();
      case 'run':
        return runningKid(motif.opacity > 0.58);
      case 'spark':
        return spark();
      case 'slash':
      default:
        return slashField();
    }
  })();

  return `
  <g transform="translate(${motif.x.toFixed(2)} ${motif.y.toFixed(2)}) rotate(${motif.rotate.toFixed(2)} 12 12) scale(${motif.scale.toFixed(2)})" stroke-width="${motif.width.toFixed(2)}" opacity="${motif.opacity.toFixed(2)}">
    ${body.join('')}
  </g>`;
};

const borderLines = [
  line(-4, 16, 284, 16, 1.1, 0.16, '8 7'),
  line(-4, 264, 284, 264, 1.1, 0.14, '6 8'),
  line(18, -4, 18, 284, 1.0, 0.12, '5 10'),
  line(262, -4, 262, 284, 1.0, 0.13, '9 6'),
];

const muralTileSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}" shape-rendering="geometricPrecision">
  <rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="#0A0908"/>
  <g fill="none" stroke="${STROKE}" stroke-linecap="round" stroke-linejoin="round">
    ${borderLines.join('')}
    ${motifs.map(renderMotif).join('')}
    ${motifs
      .slice(0, 8)
      .map((motif, index) =>
        renderMotif({
          ...motif,
          x: motif.x - 20 + (index % 3) * 6,
          y: motif.y - 18 + (index % 2) * 8,
          rotate: motif.rotate + 18,
          scale: motif.scale * 0.92,
          opacity: motif.opacity * 0.52,
          width: motif.width * 0.84,
        }),
      )
      .join('')}
  </g>
</svg>
`);

export default function MuralPattern() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundColor: '#0A0908',
        backgroundImage: `url("data:image/svg+xml,${muralTileSvg}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
        filter: 'grayscale(1) brightness(1.05) contrast(0.9) opacity(0.92)',
      }}
    />
  );
}
