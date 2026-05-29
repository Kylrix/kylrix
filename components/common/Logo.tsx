'use client';

import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
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

  // App labels for full variant
  const appLabels: Record<KylrixApp, string> = {
    root: "KYLRIX",
    kylrix: "KYLRIX",
    accounts: "ACCOUNTS",
    vault: "VAULT",
    flow: "FLOW",
    note: "NOTE",
    connect: "CONNECT",
    send: "SEND",
  };

  const label = appLabels[app] || appLabels.kylrix;

  // Unified Ecosystem Primary Color
  const primaryColor = '#6366F1'; // Indigo
  
  // Secondary Colors for Edges (Canonical Ecosystem Palette)
  const colors = {
    pink: '#EC4899',
    emerald: '#10B981',
    purple: '#A855F7',
    amber: '#F59E0B',
    indigo: '#6366F1'
  };

  const WireframeCube = (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      animate={animate ? { rotate: 360 } : {}}
      transition={animate ? { repeat: Infinity, duration: 20, ease: "linear" } : {}}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
    >
      {/* Outer Boundary Edges (Stickly Skeleton) */}
      <line x1="15" y1="30" x2="50" y2="10" stroke={colors.pink} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="50" y1="10" x2="85" y2="30" stroke={colors.emerald} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="85" y1="30" x2="85" y2="70" stroke={colors.pink} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="85" y1="70" x2="50" y2="90" stroke={colors.purple} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="50" y1="90" x2="15" y2="70" stroke={colors.pink} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="15" y1="70" x2="15" y2="30" stroke={colors.amber} strokeWidth="3.5" strokeLinecap="round" />

      {/* Inner Seam Edges */}
      <line x1="50" y1="50" x2="15" y2="30" stroke={colors.purple} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="85" y2="30" stroke={colors.amber} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="50" y2="90" stroke={colors.emerald} strokeWidth="3.5" strokeLinecap="round" />

      {/* Vertices (Unified Ecosystem Color) */}
      <circle cx="50" cy="10" r="4" fill={primaryColor} stroke="#000000" strokeWidth="1.5" />
      <circle cx="15" cy="30" r="4" fill={primaryColor} stroke="#000000" strokeWidth="1.5" />
      <circle cx="85" cy="30" r="4" fill={primaryColor} stroke="#000000" strokeWidth="1.5" />
      <circle cx="15" cy="70" r="4" fill={primaryColor} stroke="#000000" strokeWidth="1.5" />
      <circle cx="50" cy="90" r="4" fill={primaryColor} stroke="#000000" strokeWidth="1.5" />
      <circle cx="85" cy="70" r="4" fill={primaryColor} stroke="#000000" strokeWidth="1.5" />

      {/* Core Hub */}
      <circle 
        cx="50" 
        cy="50" 
        r="5.5" 
        fill={primaryColor} 
        stroke="#000000" 
        strokeWidth={2}
      />
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
      {WireframeCube}
      
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
            {label}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Logo;
export { Logo };
