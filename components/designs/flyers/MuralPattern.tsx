'use client';

import { Box } from '@mui/material';

const TILE_WIDTH = 720;
const TILE_HEIGHT = 528;
const STROKE = '#f3f0ea';

type MotifType =
  | 'note'
  | 'chat'
  | 'phone'
  | 'screen'
  | 'wifi'
  | 'battery'
  | 'cloud'
  | 'camera'
  | 'music'
  | 'heart'
  | 'link'
  | 'cursor'
  | 'window'
  | 'plane'
  | 'gift'
  | 'pin'
  | 'calendar'
  | 'stick'
  | 'laugh'
  | 'run'
  | 'spark'
  | 'slash'
  | 'poly'
  | 'mic'
  | 'headphones'
  | 'mail'
  | 'paperclip'
  | 'play'
  | 'record'
  | 'bell'
  | 'lock'
  | 'tag'
  | 'upload'
  | 'download'
  | 'code'
  | 'reply';

type Motif = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
  width: number;
  type: MotifType;
  variant: number;
};

const createRng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const rng = createRng(0x8c21b33);

const motifTypes: MotifType[] = [
  'note',
  'chat',
  'phone',
  'screen',
  'wifi',
  'battery',
  'cloud',
  'camera',
  'music',
  'heart',
  'link',
  'cursor',
  'window',
  'plane',
  'gift',
  'pin',
  'calendar',
  'poly',
  'stick',
  'laugh',
  'run',
  'spark',
  'slash',
  'mic',
  'headphones',
  'mail',
  'paperclip',
  'play',
  'record',
  'bell',
  'lock',
  'tag',
  'upload',
  'download',
  'code',
  'reply',
  'note',
  'chat',
  'heart',
  'camera',
];

const makeMotifs = (): Motif[] => {
  const cols = 14;
  const rows = 10;
  const stepX = TILE_WIDTH / cols;
  const stepY = TILE_HEIGHT / rows;
  const items: Motif[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const type = motifTypes[index % motifTypes.length];
      const offset = (row % 2) * (stepX * 0.32);
      const x = col * stepX + stepX / 2 + offset + (rng() - 0.5) * stepX * 0.24;
      const y = row * stepY + stepY / 2 + (rng() - 0.5) * stepY * 0.22;

      items.push({
        x,
        y,
        rotate: (rng() - 0.5) * 22,
        scale: 0.72 + rng() * 0.52,
        opacity: 0.34 + rng() * 0.38,
        width: 0.88 + rng() * 1.12,
        type,
        variant: Math.floor(rng() * 3),
      });
    }
  }

  return items;
};

const motifs = makeMotifs();

const line = (x1: number, y1: number, x2: number, y2: number, strokeWidth: number, opacity: number, dash?: string) => `
  <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${STROKE}" stroke-width="${strokeWidth.toFixed(2)}" stroke-opacity="${opacity.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;

const poly = (points: string, strokeWidth: number, opacity: number) => `
  <polygon points="${points}" fill="none" stroke="${STROKE}" stroke-width="${strokeWidth.toFixed(2)}" stroke-opacity="${opacity.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round" />`;

const path = (d: string, strokeWidth: number, opacity: number, dash?: string) => `
  <path d="${d}" fill="none" stroke="${STROKE}" stroke-width="${strokeWidth.toFixed(2)}" stroke-opacity="${opacity.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;

const noteMotif = (variant: number) => [
  poly(variant === 0 ? '6 3 16 3 20 7 20 21 6 21 6 3' : variant === 1 ? '5 3 17 3 19 6 19 20 5 20 5 3' : '7 3 18 4 18 21 7 20 4 16 4 7', 1.15, 0.76),
  line(16, 3, 20, 7, 1.02, 0.64),
  line(8, 8, 16, 8, 0.98, 0.4),
  line(8, 11, 16, 11, 0.98, 0.34),
  line(8, 14, 13, 14, 0.95, 0.3),
  line(13, 14, 17, 18, 0.95, 0.5),
];

const chatMotif = (variant: number) => [
  poly(variant === 0 ? '4 4 20 4 20 15 13 15 9 20 9 15 4 15' : variant === 1 ? '4 5 19 5 19 14 14 14 9 19 9 14 4 14' : '5 4 19 4 19 16 12 16 8 20 8 16 5 16', 1.1, 0.78),
  line(7, 8, 17, 8, 0.98, 0.38),
  line(7, 11, 14, 11, 0.96, 0.32),
  line(10, 15, 12, 15, 0.96, 0.36),
];

const phoneMotif = (variant: number) => [
  poly(variant === 0 ? '6 2 18 2 21 5 21 21 18 24 6 24 3 21 3 5' : variant === 1 ? '7 2 17 2 21 6 21 20 17 24 7 24 3 20 3 6' : '6 3 18 3 20 6 20 22 18 24 6 24 4 22 4 6', 1.15, 0.76),
  line(6, 6, 18, 6, 0.98, 0.4),
  line(6, 9, 18, 9, 0.95, 0.27),
  line(6, 12, 18, 12, 0.92, 0.24, '2 2'),
  line(6, 16, 11, 16, 0.95, 0.4),
  line(13, 16, 18, 16, 0.95, 0.4),
  line(10, 21, 14, 21, 1.08, 0.66),
];

const screenMotif = (variant: number) => [
  poly(variant === 0 ? '3 4 21 4 21 19 17 23 3 23' : variant === 1 ? '4 4 20 4 20 20 16 23 4 23' : '3 5 21 5 21 18 18 22 3 22', 1.12, 0.7),
  line(3, 8, 21, 8, 0.98, 0.34),
  line(6, 12, 18, 12, 0.95, 0.28),
  line(6, 16, 16, 16, 0.92, 0.24),
  line(14, 19, 19, 23, 0.95, 0.38),
];

const wifiMotif = () => [
  line(4, 7, 12, 3, 1.02, 0.4),
  line(12, 3, 20, 7, 1.02, 0.4),
  line(7, 11, 12, 8, 0.98, 0.28),
  line(12, 8, 17, 11, 0.98, 0.28),
  line(10, 15, 12, 13, 0.92, 0.6),
  line(12, 13, 14, 15, 0.92, 0.6),
  line(8, 18, 12, 18, 0.92, 0.24),
  line(12, 18, 16, 18, 0.92, 0.24),
];

const batteryMotif = (variant: number) => [
  poly(variant === 0 ? '4 6 18 6 18 18 4 18' : variant === 1 ? '4 7 17 7 17 17 4 17' : '5 6 18 6 18 19 5 19', 1.1, 0.76),
  line(18, 9, 21, 9, 1.02, 0.58),
  line(7, 9, 11, 9, 0.98, 0.44),
  line(11, 9, 15, 9, 0.98, 0.44),
  line(15, 9, 17, 9, 0.98, 0.44),
];

const cloudMotif = () => [
  path('M6 17 C4 17, 2 15, 2 12 C2 9, 4 7, 7 7 C8 4, 11 2, 14 2 C18 2, 21 5, 21 9 C23 9, 25 11, 25 14 C25 17, 23 19, 20 19 H7 C6 19, 6 19, 6 17 Z', 1.02, 0.7),
  line(7, 16, 18, 16, 0.94, 0.28),
];

const cameraMotif = (variant: number) => [
  poly(variant === 0 ? '5 6 9 6 11 4 17 4 19 6 21 6 21 18 5 18' : variant === 1 ? '4 7 8 7 10 5 17 5 20 7 21 7 21 18 4 18' : '5 6 10 6 11 4 16 4 19 6 20 6 20 18 5 18', 1.1, 0.74),
  line(13, 8, 17, 8, 0.95, 0.32),
  line(13, 8, 13, 14, 0.95, 0.26),
  poly('10 10 14 10 16 12 14 16 10 16 8 12', 0.95, 0.46),
];

const musicMotif = (variant: number) => [
  line(variant === 0 ? 8 : 7, 3, variant === 0 ? 8 : 7, 17, 1.05, 0.74),
  line(variant === 0 ? 8 : 7, 3, variant === 0 ? 18 : 17, 5, 1.05, 0.68),
  poly('6 16 8 14 11 14 13 16 11 18 8 18', 0.95, 0.58),
  poly('16 18 18 16 21 16 23 18 21 20 18 20', 0.95, 0.58),
];

const heartMotif = () => [
  path('M12 22 C12 22, 4 16, 4 10 C4 6, 7 3, 10 3 C11 3, 12 4, 12 5 C12 4, 13 3, 14 3 C17 3, 20 6, 20 10 C20 16, 12 22, 12 22 Z', 1.02, 0.7),
  line(8, 8, 10, 10, 0.92, 0.3),
  line(16, 8, 14, 10, 0.92, 0.3),
];

const linkMotif = () => [
  path('M8 8 C5 8, 3 10, 3 13 C3 16, 5 18, 8 18 H11', 1.02, 0.68),
  path('M15 10 H17 C20 10, 22 12, 22 15 C22 18, 20 20, 17 20 H14', 1.02, 0.68),
  line(9, 13, 16, 13, 0.96, 0.4),
];

const cursorMotif = () => [
  poly('4 3 19 12 11 14 14 21 11 22 8 15 4 18', 1.02, 0.76),
  line(9, 11, 14, 16, 0.92, 0.3),
];

const windowMotif = (variant: number) => [
  poly(variant === 0 ? '4 4 20 4 20 20 4 20' : variant === 1 ? '4 5 20 5 20 21 4 21' : '5 4 20 4 20 20 5 20', 1.05, 0.7),
  line(4, 8, 20, 8, 0.96, 0.34),
  line(9, 4, 9, 20, 0.92, 0.28),
  line(15, 4, 15, 20, 0.92, 0.28),
  line(4, 14, 20, 14, 0.9, 0.22, '2 2'),
];

const planeMotif = () => [
  poly('3 12 22 3 15 22 12 14 3 12', 1.02, 0.74),
  line(12, 14, 8, 18, 0.92, 0.34),
  line(12, 14, 13, 20, 0.92, 0.34),
];

const giftMotif = () => [
  poly('4 7 20 7 20 21 4 21', 1.08, 0.72),
  line(12, 7, 12, 21, 0.98, 0.38),
  line(4, 12, 20, 12, 0.98, 0.38),
  line(8, 7, 7, 4, 0.92, 0.28),
  line(16, 7, 17, 4, 0.92, 0.28),
  line(8, 12, 8, 21, 0.9, 0.22),
  line(16, 12, 16, 21, 0.9, 0.22),
];

const pinMotif = () => [
  path('M12 3 C8 3, 5 6, 5 10 C5 15, 12 22, 12 22 C12 22, 19 15, 19 10 C19 6, 16 3, 12 3 Z', 1.02, 0.72),
  poly('10 8 14 8 14 12 10 12', 0.92, 0.38),
];

const calendarMotif = (variant: number) => [
  poly(variant === 0 ? '4 5 20 5 20 21 4 21' : variant === 1 ? '4 4 20 4 20 20 4 20' : '5 5 20 5 20 21 5 21', 1.05, 0.74),
  line(4, 9, 20, 9, 0.96, 0.34),
  line(8, 3, 8, 7, 1.02, 0.46),
  line(16, 3, 16, 7, 1.02, 0.46),
  line(7, 13, 13, 13, 0.92, 0.28),
  line(15, 13, 17, 13, 0.92, 0.28),
  line(7, 17, 10, 17, 0.92, 0.28),
];

const polyCluster = (variant: number) => [
  poly(variant === 0 ? '10 2 20 8 18 19 9 22 2 14 3 6' : variant === 1 ? '8 3 19 7 21 16 12 22 3 17 4 6' : '9 2 19 6 18 18 8 22 2 15 3 6', 1.08, 0.78),
  poly(variant === 0 ? '6 5 16 3 22 12 16 21 5 18 2 10' : variant === 1 ? '5 4 17 4 21 13 16 22 5 18 3 9' : '6 4 16 4 21 11 15 21 4 18 2 10', 0.98, 0.56),
  line(3, 11, 22, 11, 0.92, 0.44),
  line(10, 2, 10, 22, 0.9, 0.32),
  line(4, 5, 20, 19, 0.9, 0.28),
];

const stickFigure = (variant: number) => [
  poly('10 2 14 4 15 8 12 11 8 11 5 8 6 4', 1.02, 0.72),
  line(11, 11, 11, 19, 1.14, 0.8),
  line(11, 13, 6, 16, 1, 0.68),
  line(11, 13, 16, 16, 1, 0.68),
  line(11, 19, 7, 24, 1, 0.68),
  line(11, 19, 15, 24, 1, 0.68),
  ...(variant === 1 ? [line(16, 10, 21, 6, 1, 0.7), line(18, 7, 22, 4, 0.94, 0.56)] : []),
  ...(variant === 2
    ? [line(8, 6, 9, 6, 0.92, 0.5), line(13, 6, 14, 6, 0.92, 0.5), line(8, 9, 14, 9, 0.9, 0.34, '1 1')]
    : [line(8, 6, 9, 6, 0.9, 0.44), line(13, 6, 14, 6, 0.9, 0.44), line(8, 9, 14, 9, 0.88, 0.34)]),
];

const runningKid = (variant: number) => [
  poly(variant === 0 ? '6 2 11 4 13 9 10 12 5 11 3 7' : variant === 1 ? '8 2 13 4 15 9 12 12 7 11 5 7' : '7 2 12 4 14 9 11 12 6 11 4 7', 1.02, 0.74),
  line(variant === 1 ? 10 : 8, 12, variant === 1 ? 14 : 12, 15, 1.1, 0.76),
  line(variant === 1 ? 14 : 12, 15, variant === 1 ? 19 : 17, 13, 1, 0.68),
  line(variant === 1 ? 12 : 10, 15, variant === 1 ? 8 : 6, 20, 1, 0.68),
  line(variant === 1 ? 12 : 10, 15, variant === 1 ? 16 : 20, 19, 1, 0.68),
  line(variant === 1 ? 15 : 13, 8, variant === 1 ? 20 : 18, 5, 0.96, 0.62),
  line(variant === 1 ? 18 : 16, 5, variant === 1 ? 22 : 20, 8, 0.92, 0.48),
];

const laughFace = (variant: number) => [
  poly(variant === 0 ? '9 2 15 4 18 10 16 17 9 20 4 17 2 10 4 4' : variant === 1 ? '8 2 15 3 19 9 17 17 9 20 4 16 2 10 4 4' : '9 3 15 4 18 9 16 18 9 20 4 17 2 10 4 4', 1.02, 0.7),
  line(7, 8, 9, 9, 0.92, 0.42),
  line(13, 8, 15, 9, 0.92, 0.42),
  path('M6 13 C8 16, 13 16, 16 13', 0.98, 0.68),
  line(7, 14, 8.5, 15.5, 0.9, 0.38),
  line(14, 14, 12.5, 15.5, 0.9, 0.38),
];

const spark = (variant: number) => [
  line(12, 2, 12, 22, 1, 0.68),
  line(2, 12, 22, 12, 1, 0.68),
  line(5, 5, 19, 19, 1, 0.54),
  line(19, 5, 5, 19, 1, 0.54),
  ...(variant === 0 ? [line(7, 2, 17, 22, 0.92, 0.36), line(17, 2, 7, 22, 0.92, 0.36)] : []),
];

const slashField = (variant: number) => [
  line(2, 5, 22, 19, 1, 0.58),
  line(4, 2, 18, 24, 0.96, 0.38, variant === 0 ? '3 3' : '4 2'),
  line(2, 21, 20, 4, 1, 0.5),
  line(5, 9, 23, 9, 0.92, 0.24),
];

const paperclipMotif = (variant: number) => [
  path(
    variant === 0
      ? 'M8 9 C8 6, 11 5, 13 7 L18 12 C20 14, 20 17, 18 19 C16 21, 13 21, 11 19 L6 14 C4 12, 4 9, 6 7 C8 5, 11 5, 13 7'
      : variant === 1
        ? 'M9 8 C9 5, 12 4, 14 6 L18 10 C20 12, 20 16, 18 18 C16 20, 12 20, 10 18 L7 15 C5 13, 5 10, 7 8 C9 6, 12 6, 14 8'
        : 'M7 9 C7 6, 10 5, 13 7 L17 11 C19 13, 19 17, 17 19 C15 21, 11 21, 9 19 L6 16 C4 14, 4 10, 6 8 C8 6, 11 6, 13 8',
    1,
    0.72,
  ),
  line(8, 11, 15, 18, 0.9, 0.28),
];

const micMotif = (variant: number) => [
  path(variant === 0 ? 'M8 6 C8 4, 10 3, 12 3 C14 3, 16 4, 16 6 V13 C16 15, 14 17, 12 17 C10 17, 8 15, 8 13 Z' : 'M7 7 C7 4, 10 3, 12 3 C14 3, 17 4, 17 7 V13 C17 16, 14 18, 12 18 C10 18, 7 16, 7 13 Z', 1.02, 0.74),
  line(12, 17, 12, 21, 0.95, 0.36),
  line(9, 21, 15, 21, 0.92, 0.34),
];

const headphonesMotif = (variant: number) => [
  path(variant === 0 ? 'M6 13 C6 8, 8 4, 12 4 C16 4, 18 8, 18 13' : 'M5 13 C5 8, 8 4, 12 4 C16 4, 19 8, 19 13', 1.02, 0.74),
  line(6, 13, 6, 18, 0.96, 0.44),
  line(18, 13, 18, 18, 0.96, 0.44),
  poly('4 13 7 13 7 18 4 18', 0.9, 0.38),
  poly('17 13 20 13 20 18 17 18', 0.9, 0.38),
];

const mailMotif = (variant: number) => [
  poly(variant === 0 ? '4 5 20 5 20 19 4 19' : '5 6 19 6 19 20 5 20', 1.08, 0.76),
  line(4, 6, 12, 13, 0.96, 0.44),
  line(20, 6, 12, 13, 0.96, 0.44),
  line(4, 19, 10, 12, 0.94, 0.28),
  line(20, 19, 14, 12, 0.94, 0.28),
];

const playMotif = (variant: number) => [
  poly(variant === 0 ? '5 4 20 12 5 20' : '6 4 21 12 6 20', 1.02, 0.76),
  line(5, 4, 5, 20, 0.88, 0.24),
];

const recordMotif = () => [
  poly('4 4 20 4 20 20 4 20', 0.98, 0.3),
  poly('8 8 16 8 16 16 8 16', 1.02, 0.7),
  poly('11 11 13 11 13 13 11 13', 0.92, 0.5),
];

const bellMotif = () => [
  path('M8 17 H16 C16 15, 17 14, 17 12 V10 C17 7, 15 5, 12 5 C9 5, 7 7, 7 10 V12 C7 14, 8 15, 8 17 Z', 1.02, 0.74),
  line(10, 17, 10, 19, 0.92, 0.36),
  line(14, 17, 14, 19, 0.92, 0.36),
  line(9, 4, 15, 4, 0.9, 0.28),
];

const lockMotif = () => [
  poly('6 11 18 11 18 21 6 21', 1.02, 0.74),
  path('M8 11 V8 C8 5, 10 3, 12 3 C14 3, 16 5, 16 8 V11', 1, 0.62),
  poly('11 15 13 15 13 17 11 17', 0.9, 0.4),
];

const tagMotif = () => [
  poly('4 7 14 7 21 14 14 21 4 21 4 7', 1.02, 0.74),
  poly('7 10 10 10 10 13 7 13', 0.92, 0.34),
];

const uploadMotif = () => [
  line(12, 18, 12, 6, 1, 0.7),
  poly('8 9 12 5 16 9', 1.02, 0.68),
  line(5, 19, 19, 19, 0.92, 0.28),
];

const downloadMotif = () => [
  line(12, 6, 12, 18, 1, 0.7),
  poly('8 15 12 19 16 15', 1.02, 0.68),
  line(5, 20, 19, 20, 0.92, 0.28),
];

const codeMotif = () => [
  line(10, 4, 5, 12, 1, 0.74),
  line(5, 12, 10, 20, 1, 0.74),
  line(14, 4, 19, 12, 1, 0.74),
  line(19, 12, 14, 20, 1, 0.74),
];

const replyMotif = () => [
  line(8, 8, 16, 8, 1, 0.44),
  line(8, 8, 8, 5, 1, 0.44),
  line(8, 8, 12, 12, 1, 0.44),
  line(12, 12, 8, 16, 1, 0.44),
];

const renderMotif = (motif: Motif) => {
  const body = (() => {
    switch (motif.type) {
      case 'note':
        return noteMotif(motif.variant);
      case 'chat':
        return chatMotif(motif.variant);
      case 'phone':
        return phoneMotif(motif.variant);
      case 'screen':
        return screenMotif(motif.variant);
      case 'wifi':
        return wifiMotif();
      case 'battery':
        return batteryMotif(motif.variant);
      case 'cloud':
        return cloudMotif();
      case 'camera':
        return cameraMotif(motif.variant);
      case 'music':
        return musicMotif(motif.variant);
      case 'heart':
        return heartMotif();
      case 'link':
        return linkMotif();
      case 'cursor':
        return cursorMotif();
      case 'window':
        return windowMotif(motif.variant);
      case 'plane':
        return planeMotif();
      case 'gift':
        return giftMotif();
      case 'pin':
        return pinMotif();
      case 'calendar':
        return calendarMotif(motif.variant);
      case 'poly':
        return polyCluster(motif.variant);
      case 'stick':
        return stickFigure(motif.variant);
      case 'laugh':
        return laughFace(motif.variant);
      case 'run':
        return runningKid(motif.variant);
      case 'spark':
        return spark(motif.variant);
      case 'slash':
        return slashField(motif.variant);
      case 'mic':
        return micMotif(motif.variant);
      case 'headphones':
        return headphonesMotif(motif.variant);
      case 'mail':
        return mailMotif(motif.variant);
      case 'paperclip':
        return paperclipMotif(motif.variant);
      case 'play':
        return playMotif(motif.variant);
      case 'record':
        return recordMotif();
      case 'bell':
        return bellMotif();
      case 'lock':
        return lockMotif();
      case 'tag':
        return tagMotif();
      case 'upload':
        return uploadMotif();
      case 'download':
        return downloadMotif();
      case 'code':
        return codeMotif();
      case 'reply':
        return replyMotif();
      default:
        return slashField(motif.variant);
    }
  })();

  return `
  <g transform="translate(${motif.x.toFixed(2)} ${motif.y.toFixed(2)}) rotate(${motif.rotate.toFixed(2)} 12 12) scale(${motif.scale.toFixed(2)})" stroke-width="${motif.width.toFixed(2)}" opacity="${motif.opacity.toFixed(2)}">
    ${body.join('')}
  </g>`;
};

const muralTileSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_WIDTH} ${TILE_HEIGHT}" shape-rendering="geometricPrecision">
  <rect width="${TILE_WIDTH}" height="${TILE_HEIGHT}" fill="#0A0908"/>
  <g fill="none" stroke="${STROKE}" stroke-linecap="round" stroke-linejoin="round">
    ${motifs.map(renderMotif).join('')}
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
        backgroundSize: `${TILE_WIDTH}px ${TILE_HEIGHT}px`,
        filter: 'grayscale(1) brightness(1.05) contrast(0.9) opacity(0.93)',
      }}
    />
  );
}
