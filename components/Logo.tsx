'use client';

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

export type KylrixApp = 'root' | 'vault' | 'flow' | 'note' | 'connect';

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
  app = 'root', 
  variant = 'full',
  component,
  href,
  animate = false
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // App Specific Colors (Muted V3 Palette)
  const appColors: Record<KylrixApp, { primary: string; secondary: string; label: string }> = {
    root: { primary: "#6366F1", secondary: "#000000", label: "KYLRIX" },
    vault: { primary: "#F59E0B", secondary: "#161412", label: "VAULT" }, // Amber/Gold
    flow: { primary: "#10B981", secondary: "#161412", label: "FLOW" },   // Emerald
    note: { primary: "#EC4899", secondary: "#161412", label: "NOTE" },   // Pink
    connect: { primary: "#6366F1", secondary: "#161412", label: "CONNECT" } // Indigo (Connect stays Indigo for now)
  };

  const current = appColors[app] || appColors.root;

  // Logic for the dynamic "Left Hemisphere" and "Center Cutout"
  // 1. For specialized apps (note, flow, etc.), the left hemisphere assumes the app's secondary color.
  // 2. For Root/Accounts, it depends on Light/Dark mode.
  let leftColor = current.secondary;
  if (app === 'root') {
    leftColor = isDarkMode ? "#FFFFFF" : "#000000";
  }

  // Right hemisphere is ALWAYS the app's primary brand color
  const rightColor = current.primary;

  // Center cutout color (punches through to background)
  // Usually matches the background of the container it's in.
  const cutoutColor = isDarkMode ? "#0A0908" : "#FFFFFF";

  // Malleability Framework: Define shapes for the center cutout
  const renderCutout = () => {
    switch (app) {
      case 'vault': // Circle
        return <circle cx="50" cy="50" r="14" fill={cutoutColor} />;
      case 'flow': // Triangle (forward-pointing)
        return <polygon points="42,38 62,50 42,62" fill={cutoutColor} />;
      case 'connect': // Two vertical rectangles
        return (
          <>
            <rect x="43" y="38" width="5" height="24" fill={cutoutColor} />
            <rect x="52" y="38" width="5" height="24" fill={cutoutColor} />
          </>
        );
      case 'note': // Square
        return <rect x="38" y="38" width="24" height="24" fill={cutoutColor} />;
      case 'root': // Diamond
      default:
        return <polygon points="50,38 62,50 50,62 38,50" fill={cutoutColor} />;
    }
  };

  const Hexagon = (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      animate={animate ? { rotate: 360 } : {}}
      transition={animate ? { repeat: Infinity, duration: 8, ease: "linear" } : {}}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    >
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
        <Box>
          <Typography sx={{ 
            fontWeight: 900, 
            letterSpacing: '-0.04em', 
            color: isDarkMode ? '#fff' : '#000', 
            fontSize: `${size * 0.7}px`, 
            lineHeight: 1, 
            textTransform: 'uppercase', 
            fontFamily: '"Clash Display Variable", "Clash Display", sans-serif' 
          }}>
            {current.label}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Logo;
