'use client';

import React from 'react';

function hashUserId(str: string): number[] {
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

const IDENTICON_COLORS = [
  '#818CF8', // Indigo
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#6366F1', // Violet
  '#14B8A6', // Teal
  '#F43F5E', // Rose
];

export interface UserIdenticonProps {
  value?: string | null;
  userId?: string | null;
  username?: string | null;
  size?: number;
  className?: string;
  rounded?: boolean;
  style?: React.CSSProperties;
}

export function UserIdenticon({
  value,
  userId,
  username,
  size = 40,
  className = '',
  rounded = true,
  style = {},
}: UserIdenticonProps) {
  const seed = value || userId || username || 'kylrix_user';
  const bytes = hashUserId(seed);
  const primaryColor = IDENTICON_COLORS[bytes[0] % IDENTICON_COLORS.length];
  const secondaryColor = IDENTICON_COLORS[(bytes[1] + 3) % IDENTICON_COLORS.length];

  const cellSize = Math.max(1, Math.round(size * 0.138));
  const gap = Math.max(1, Math.round(size * 0.03));
  const totalGrid = 5 * cellSize + 4 * gap;
  const offset = Math.max(0, Math.round((size - totalGrid) / 2));

  const cells: Array<{ x: number; y: number; fill: string; opacity: number }> = [];

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
        });
      } else {
        cells.push({
          x: posX,
          y: posY,
          fill: 'rgba(255,255,255,0.04)',
          opacity: 0.4,
        });
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      style={{
        display: 'inline-block',
        borderRadius: rounded ? (size > 80 ? '24px' : '9999px') : '8px',
        background: '#13110F',
        border: `1.5px solid ${primaryColor}40`,
        ...style,
      }}
    >
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={cellSize}
          height={cellSize}
          rx={Math.max(1, Math.round(cellSize * 0.22))}
          ry={Math.max(1, Math.round(cellSize * 0.22))}
          fill={c.fill}
          opacity={c.opacity}
        />
      ))}
    </svg>
  );
}

export default UserIdenticon;
