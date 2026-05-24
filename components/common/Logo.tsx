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

  const isNote = app === 'note';

  const Hexagon = (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      animate={animate ? { rotate: 360 } : {}}
      transition={animate ? { repeat: Infinity, duration: 8, ease: "linear" } : {}}
      style={{ filter: isNote ? 'drop-shadow(0 3px 5px rgba(0,0,0,0.35))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    >
      {isNote ? (
        <>
          <defs>
            <linearGradient id="noteLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="35%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#BE185D" />
            </linearGradient>
            <linearGradient id="noteRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="35%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#4338CA" />
            </linearGradient>
            <filter id="recessShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.85" />
            </filter>
          </defs>

          {/* Left Hemisphere */}
          <polygon 
            points="50,10 15,30 15,70 50,90" 
            fill="url(#noteLeftGrad)" 
            style={{ transition: 'fill 0.4s ease' }}
          />
          {/* Right Hemisphere */}
          <polygon 
            points="50,10 85,30 85,70 50,90" 
            fill="url(#noteRightGrad)" 
            style={{ transition: 'fill 0.4s ease' }}
          />

          {/* Specular Bevel Highlights */}
          <polyline 
            points="50,10 15,30 15,70 50,90" 
            fill="none" 
            stroke="#FFA6D9" 
            strokeWidth="1.5" 
            opacity="0.75" 
            strokeLinecap="round" 
          />
          <polyline 
            points="50,10 85,30 85,70 50,90" 
            fill="none" 
            stroke="#A5B4FC" 
            strokeWidth="1.5" 
            opacity="0.75" 
            strokeLinecap="round" 
          />

          {/* Center Seam */}
          <line x1="50" y1="10" x2="50" y2="90" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />

          {/* Cutout (Physical Recessed Opening) */}
          <rect 
            x="38" 
            y="38" 
            width="24" 
            height="24" 
            fill={cutoutColor} 
            transform="rotate(45 50 50)"
            filter="url(#recessShadow)"
          />
          <rect 
            x="38" 
            y="38" 
            width="24" 
            height="24" 
            fill="none" 
            stroke="rgba(255,255,255,0.18)" 
            strokeWidth="1" 
            transform="rotate(45 50 50)"
          />
        </>
      ) : (
        <>
          {/* Left Hemisphere */}
          <polygon 
            points="50,10 15,30 15,70 50,90" 
            fill={leftColor} 
            style={{ transition: 'fill 0.4s ease' }}
          />
          {/* Right Hemisphere */}
          <polygon 
            points="50,10 85,30 85,70 50,90" 
            fill={rightColor} 
            style={{ transition: 'fill 0.4s ease' }}
          />
          {/* Center Cutout */}
          {renderCutout()}
        </>
      )}
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
