'use client';

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

export type KylrixApp = 'root' | 'accounts' | 'kylrix' | 'vault' | 'flow' | 'note' | 'connect';

interface LogoProps {
  sx?: any;
  size?: number;
  app?: KylrixApp;
  variant?: 'full' | 'icon';
  component?: any;
  href?: string;
  animate?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  sx, 
  size = 40, 
  app = 'root', 
  variant = 'full',
  component,
  href,
  animate = false,
  className
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const appColors: Record<KylrixApp, { accent: string; label: string }> = {
    root: { accent: "#6366F1", label: "KYLRIX" },
    accounts: { accent: "#6366F1", label: "ACCOUNTS" },
    kylrix: { accent: "#6366F1", label: "KYLRIX" },
    vault: { accent: "#10B981", label: "VAULT" },
    flow: { accent: "#A855F7", label: "FLOW" },
    note: { accent: "#EC4899", label: "NOTE" },
    connect: { accent: "#F59E0B", label: "CONNECT" }
  };

  const current = appColors[app] || appColors.root;

  const ecosystemPrimary = '#6366F1';
  const isEcosystemBrand = app === 'root' || app === 'accounts' || app === 'kylrix';
  const leftColor = isEcosystemBrand ? (isDarkMode ? '#FFFFFF' : '#000000') : ecosystemPrimary;
  const rightColor = isEcosystemBrand ? ecosystemPrimary : current.accent;
  
  const cutoutColor = isDarkMode ? '#000000' : '#FFFFFF';

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
      aria-hidden="true"
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
      className={className}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
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
export { Logo };
