'use client';

import React from 'react';

const IDENTICON_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#D946EF', // Fuchsia
  '#E11D48', // Crimson
  '#10B981', // Mint
];

function hashSeed(str: string): number[] {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    const combined = (i % 2 === 0 ? h1 : h2) ^ (i * 0x5bd1e995);
    bytes.push(Math.abs(combined >> ((i % 4) * 8)) & 0xff);
  }
  return bytes;
}

export interface IdenticonProps {
  seed?: string | null;
  size?: number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Identicon({
  seed = 'kylrix',
  size = 32,
  borderRadius,
  className = '',
  style,
}: IdenticonProps) {
  const safeSeed = (seed && String(seed).trim()) || 'kylrix_user';
  const bytes = hashSeed(safeSeed);
  const primaryColor = IDENTICON_COLORS[bytes[0] % IDENTICON_COLORS.length];
  const secondaryColor = IDENTICON_COLORS[(bytes[1] + 3) % IDENTICON_COLORS.length];

  const cellSize = Math.max(1, Math.round(size * 0.145));
  const gap = Math.max(1, Math.round(size * 0.035));
  const totalGrid = 5 * cellSize + 4 * gap;
  const offset = Math.round((size - totalGrid) / 2);
  const cellRadius = Math.max(1, Math.round(cellSize * 0.22));

  const cells: Array<{ x: number; y: number; fill: string; opacity: number; rx: number }> = [];

  for (let col = 0; col < 5; col++) {
    const sourceCol = col < 3 ? col : 4 - col;
    for (let row = 0; row < 5; row++) {
      const bitIndex = sourceCol * 5 + row;
      const byte = bytes[Math.floor(bitIndex / 8) + 1] || 0;
      const isFilled = ((byte >> (bitIndex % 8)) & 1) === 1;
      const isCenter = col === 2 && row === 2;
      const filled = isFilled || isCenter;

      const posX = offset + col * (cellSize + gap);
      const posY = offset + row * (cellSize + gap);

      if (filled) {
        const useSecondary = ((bytes[2] >> (row % 8)) & 1) === 1 && (col === 1 || col === 3);
        cells.push({
          x: posX,
          y: posY,
          fill: useSecondary ? secondaryColor : primaryColor,
          opacity: 1,
          rx: cellRadius,
        });
      } else {
        cells.push({
          x: posX,
          y: posY,
          fill: 'rgba(255,255,255,0.04)',
          opacity: 0.35,
          rx: cellRadius,
        });
      }
    }
  }

  const borderStyle = borderRadius !== undefined
    ? (typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius)
    : '50%';

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={`inline-block shrink-0 select-none overflow-hidden ${className}`}
      style={{
        borderRadius: borderStyle,
        backgroundColor: '#0E0D0C',
        border: '1px solid rgba(255,255,255,0.08)',
        ...style,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} fill="#0E0D0C" />
      {cells.map((cell, idx) => (
        <rect
          key={idx}
          x={cell.x}
          y={cell.y}
          width={cellSize}
          height={cellSize}
          rx={cell.rx}
          fill={cell.fill}
          opacity={cell.opacity}
        />
      ))}
    </svg>
  );
}

export default Identicon;
