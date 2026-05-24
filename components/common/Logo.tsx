'use client';

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { KylrixApp } from '@/lib/sdk';

interface LogoProps {
  sx?: any;
  size?: number;
  app?: KylrixApp;
  variant?: 'full' | 'icon';
  component?: any;
  href?: string;
  animate?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  sx, 
  size = 40, 
  app = 'kylrix', 
  variant = 'full',
  component,
  href,
  animate = false
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // App Specific Colors (Muted V3 Palette)
  const appColors: Record<KylrixApp, { primary: string; secondary: string; label: string }> = {
    root: { primary: "#6366F1", secondary: "#6366F1", label: "KYLRIX" },
    kylrix: { primary: "#6366F1", secondary: "#6366F1", label: "KYLRIX" },
    accounts: { primary: "#6366F1", secondary: "#6366F1", label: "ACCOUNTS" },
    vault: { primary: "#6366F1", secondary: "#10B981", label: "VAULT" }, // Left: Indigo, Right: Emerald
    flow: { primary: "#6366F1", secondary: "#A855F7", label: "FLOW" },   // Left: Indigo, Right: Amethyst
    note: { primary: "#6366F1", secondary: "#EC4899", label: "NOTE" },   // Left: Indigo, Right: Pink
    connect: { primary: "#6366F1", secondary: "#F59E0B", label: "CONNECT" }, // Left: Indigo, Right: Amber
  };

  const current = appColors[app] || appColors.kylrix;

  // Ecosystem brand (root / accounts / kylrix): white or black left, indigo right.
  // Satellite apps: app accent on left, ecosystem indigo on right.
  const ecosystemPrimary = '#6366F1';
  const isEcosystemBrand = app === 'root' || app === 'accounts' || app === 'kylrix';
  const leftColor = isEcosystemBrand
    ? (isDarkMode ? '#FFFFFF' : '#000000')
    : current.secondary;
  const rightColor = isEcosystemBrand ? ecosystemPrimary : current.primary;
  
  // Center cutout color (punches through to background)
  const cutoutColor = isDarkMode ? "#0A0908" : "#FFFFFF";

  // Malleability Framework: Define shapes for the center cutout
  const renderCutout = () => {
    switch (app) {
      case 'note': // Slanted Square (Quadrilateral)
        return (
          <rect 
            x="38" 
            y="38" 
            width="24" 
            height="24" 
            fill={cutoutColor} 
            transform="rotate(45 50 50)"
          />
        );
      case 'vault': // Slanted Square (Quadrilateral)
        return (
          <rect 
            x="38" 
            y="38" 
            width="24" 
            height="24" 
            fill={cutoutColor} 
            transform="rotate(45 50 50)"
          />
        );
      case 'flow': // Slanted Square (Quadrilateral)
        return (
          <rect
            x="38"
            y="38"
            width="24"
            height="24"
            fill={cutoutColor}
            transform="rotate(45 50 50)"
          />
        );
      case 'connect': // Slanted Square (Quadrilateral)
        return (
          <rect 
            x="38" 
            y="38" 
            width="24" 
            height="24" 
            fill={cutoutColor} 
            transform="rotate(45 50 50)"
          />
        );
      case 'root': // Diamond
      case 'accounts': // Diamond (same as KYLRIX mark)
      case 'kylrix': // Diamond
      default:
        return <polygon points="50,38 62,50 50,62 38,50" fill={cutoutColor} />;
    }
  };

  const borderColors: Record<KylrixApp, { left: string; right: string }> = {
    root: { left: isDarkMode ? "#9B9691" : "#1C1A18", right: "#3D3AA9" },
    kylrix: { left: isDarkMode ? "#9B9691" : "#1C1A18", right: "#3D3AA9" },
    accounts: { left: isDarkMode ? "#9B9691" : "#1C1A18", right: "#3D3AA9" },
    vault: { left: "#065F46", right: "#3D3AA9" },
    flow: { left: "#6B21A8", right: "#3D3AA9" },
    note: { left: "#9A1D5A", right: "#3D3AA9" },
    connect: { left: "#92400E", right: "#3D3AA9" },
  };

  const borders = borderColors[app] || borderColors.kylrix;

  const renderCarvedCutout = () => {
    const isDiamond = app === 'root' || app === 'accounts' || app === 'kylrix';
    if (isDiamond) {
      return (
        <>
          {/* Hard tactile recess shadow (offset diamond) */}
          <polygon points="51,40 63,52 51,64 39,52" fill="#000000" />
          {/* Main solid cutout diamond */}
          <polygon points="50,38 62,50 50,62 38,50" fill={cutoutColor} />
          {/* Solid dark carved border */}
          <polygon points="50,38 62,50 50,62 38,50" fill="none" stroke="#000000" strokeWidth="1.8" />
        </>
      );
    } else {
      return (
        <>
          {/* Hard tactile recess shadow (offset rotated square) */}
          <rect 
            x="39" 
            y="40" 
            width="24" 
            height="24" 
            fill="#000000" 
            transform="rotate(45 50 50)"
          />
          {/* Main solid cutout */}
          <rect 
            x="38" 
            y="38" 
            width="24" 
            height="24" 
            fill={cutoutColor} 
            transform="rotate(45 50 50)"
          />
          {/* Solid dark carved border */}
          <rect 
            x="38" 
            y="38" 
            width="24" 
            height="24" 
            fill="none" 
            stroke="#000000" 
            strokeWidth="1.8" 
            transform="rotate(45 50 50)"
          />
        </>
      );
    }
  };

  const Hexagon = (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      animate={animate ? { rotate: 360 } : {}}
      transition={animate ? { repeat: Infinity, duration: 8, ease: "linear" } : {}}
      style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.35))' }}
    >
      {/* Heavy Outer Solid Black Contour (Gives massive structural presence) */}
      <polygon 
        points="50,9 14,29 14,71 50,91 86,71 86,29" 
        fill="none" 
        stroke="#000000" 
        strokeWidth="3" 
        strokeLinejoin="round"
      />

      {/* Solid Base Left Hemisphere */}
      <polygon 
        points="50,10 15,30 15,70 50,90" 
        fill={leftColor} 
        style={{ transition: 'fill 0.4s ease' }}
      />
      {/* Solid Base Right Hemisphere */}
      <polygon 
        points="50,10 85,30 85,70 50,90" 
        fill={rightColor} 
        style={{ transition: 'fill 0.4s ease' }}
      />

      {/* Recessed Dark Borders (Pure Solid Depth Shadow Lines) */}
      <polyline 
        points="50,10 15,30 15,70 50,90" 
        fill="none" 
        stroke={borders.left} 
        strokeWidth="1.8" 
        strokeLinecap="round" 
      />
      <polyline 
        points="50,10 85,30 85,70 50,90" 
        fill="none" 
        stroke={borders.right} 
        strokeWidth="1.8" 
        strokeLinecap="round" 
      />

      {/* Heavy Opaque Center Seam Split */}
      <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="2.2" />

      {/* Carved Cutout with hard offset shadow and black inner rim */}
      {renderCarvedCutout()}
    </motion.svg>
  );

  return (
    <Box 
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        textDecoration: 'none',
        ...sx
      }} 
      component={component} 
      href={href}
    >
      {Hexagon}
      
      {variant === 'full' && (
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Typography sx={{ 
            fontWeight: 900, 
            letterSpacing: '-0.04em', 
            color: isDarkMode ? '#fff' : '#000', 
            fontSize: `${size * 0.7}px`, 
            lineHeight: 1, 
            textTransform: 'uppercase', 
            fontFamily: 'var(--font-clash)' 
          }}>
            {current.label}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Logo;
export { Logo };
