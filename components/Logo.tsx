import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

export type KylrixApp = 'root' | 'vault' | 'flow' | 'note' | 'connect';

interface LogoProps {
  sx?: any;
  size?: number;
  app?: KylrixApp;
  variant?: 'full' | 'icon';
  component?: any;
  href?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  sx, 
  size = 40, 
  app = 'root', 
  variant = 'full',
  component,
  href
}) => {
  const configs = {
    root: { color1: "#00F5FF", color2: "#00A3FF", name: "KYLRIX", desc: "Assembly Root" },
    vault: { color1: "#00F5FF", color2: "#3B82F6", name: "VAULT", desc: "Data Monolith" },
    flow: { color1: "#00F5FF", color2: "#00FF94", name: "FLOW", desc: "Kinetic Vector" },
    note: { color1: "#00F5FF", color2: "#A855F7", name: "NOTE", desc: "Synthesis Prism" },
    connect: { color1: "#00F5FF", color2: "#F43F5E", name: "CONNECT", desc: "Signal Pulse" }
  };

  const current = configs[app];

  return (
    <Box 
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        textDecoration: 'none',
        ...sx
      }} 
      component={component} 
      href={href}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`grad-${app}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={current.color1} />
            <stop offset="100%" stopColor={current.color2} />
          </linearGradient>
        </defs>

        {/* ROOT: The Kinetic Sigil (Abstract K) */}
        {app === 'root' && (
          <g stroke={`url(#grad-${app})`} strokeWidth="12" strokeLinecap="round">
            <path d="M30 20V80" /> {/* Pillar */}
            <path d="M45 50L80 20" opacity="0.8" /> {/* Ascender */}
            <path d="M45 50L80 80" opacity="0.6" /> {/* Descender */}
          </g>
        )}

        {/* VAULT: The Monolith (Collapsed K) */}
        {app === 'vault' && (
          <g fill={`url(#grad-${app})`}>
            <rect x="25" y="15" width="15" height="70" rx="2" /> {/* Pillar */}
            <rect x="45" y="15" width="8" height="70" rx="2" opacity="0.7" /> {/* Ascender (Folded) */}
            <rect x="58" y="15" width="4" height="70" rx="2" opacity="0.4" /> {/* Descender (Folded) */}
          </g>
        )}

        {/* FLOW: The Vector (Shifted K) */}
        {app === 'flow' && (
          <g stroke={`url(#grad-${app})`} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20V80" opacity="0.3" /> {/* Pillar (Rail) */}
            <path d="M40 30L65 50L40 70" /> {/* Ascender (Chevron 1) */}
            <path d="M65 30L90 50L65 70" opacity="0.5" /> {/* Descender (Chevron 2) */}
          </g>
        )}

        {/* NOTE: The Prism (Segmented K) */}
        {app === 'note' && (
          <g stroke={`url(#grad-${app})`} strokeWidth="10" strokeLinecap="round">
            <path d="M30 20V80" /> {/* Pillar */}
            <path d="M50 25H80" opacity="0.8" /> {/* Ascender (Layer 1) */}
            <path d="M50 50H80" opacity="0.6" /> {/* Layer 2 */}
            <path d="M50 75H80" opacity="0.4" /> {/* Descender (Layer 3) */}
          </g>
        )}

        {/* CONNECT: The Signal (Radiant K) */}
        {app === 'connect' && (
          <g stroke={`url(#grad-${app})`} strokeWidth="8" strokeLinecap="round">
            <path d="M50 20V80" strokeWidth="12" /> {/* Pillar (Antenna) */}
            <path d="M30 40A25 25 0 0 1 70 40" opacity="0.7" /> {/* Ascender (Wave 1) */}
            <path d="M20 60A40 40 0 0 0 80 60" opacity="0.4" /> {/* Descender (Wave 2) */}
          </g>
        )}
      </svg>
      
      {variant === 'full' && (
        <Box>
          <Typography sx={{ fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', fontSize: `${size * 0.7}px`, lineHeight: 1, textTransform: 'uppercase', fontFamily: '"Clash Display", sans-serif' }}>
            {current.name}
          </Typography>
          <Typography sx={{ fontSize: `${size * 0.22}px`, color: current.color2, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {current.desc}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Logo;
