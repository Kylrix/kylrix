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
    root: { primary: "#6366F1", secondary: "#6366F1", label: "KYLRIX" },
    vault: { primary: "#6366F1", secondary: "#10B981", label: "VAULT" }, // Left: Indigo, Right: Emerald
    flow: { primary: "#6366F1", secondary: "#A855F7", label: "FLOW" },   // Left: Indigo, Right: Amethyst
    note: { primary: "#6366F1", secondary: "#EC4899", label: "NOTE" },   // Left: Indigo, Right: Pink
    connect: { primary: "#6366F1", secondary: "#F59E0B", label: "CONNECT" } // Left: Indigo, Right: Amber
  };

  const current = appColors[app] || appColors.root;

  // The Identity Split:
  // Left Hemisphere = Application Specific Color
  // Right Hemisphere = Ecosystem Indigo (#6366F1)
  const leftColor = current.secondary;
  const rightColor = app === 'root' ? (isDarkMode ? "#FFFFFF" : "#000000") : current.primary;
  
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
      case 'vault': // Slanted Square (Quadrilateral) - Same as Note but Emerald
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
      case 'flow': // Triangle (forward-pointing)
        return <polygon points="42,38 62,50 42,62" fill={cutoutColor} />;
      case 'connect': // Slanted Square (Quadrilateral) - Same as Note/Vault but Amber
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
