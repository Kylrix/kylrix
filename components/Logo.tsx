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
  const leftColor = isEcosystemBrand ? (isDarkMode ? '#FFFFFF' : '#000000') : current.accent;
  const rightColor = isEcosystemBrand ? ecosystemPrimary : ecosystemPrimary;
  
  const cutoutColor = isDarkMode ? '#0A0908' : '#FFFFFF';

  const borderColors: Record<KylrixApp, { left: string; right: string }> = {
    root: { left: isDarkMode ? "#9B9691" : "#1C1A18", right: "#3D3AA9" },
    kylrix: { left: isDarkMode ? "#9B9691" : "#1C1A18", right: "#3D3AA9" },
    accounts: { left: isDarkMode ? "#9B9691" : "#1C1A18", right: "#3D3AA9" },
    vault: { left: "#065F46", right: "#3D3AA9" },
    flow: { left: "#6B21A8", right: "#3D3AA9" },
    note: { left: "#9A1D5A", right: "#3D3AA9" },
    connect: { left: "#92400E", right: "#3D3AA9" },
  };

  const borders = borderColors[app] || borderColors.root;

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
      aria-hidden="true"
      style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.35))' }}
    >
      {/* Heavy Outer Solid Black Contour */}
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

      {/* Recessed Dark Borders */}
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

      {/* Carved Cutout */}
      {renderCarvedCutout()}
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
