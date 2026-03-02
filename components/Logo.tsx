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

const pulse = keyframes`
  0% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.1); }
  100% { opacity: 0.4; transform: scale(1); }
`;

const flowOffset = keyframes`
  0% { stroke-dashoffset: 200; }
  100% { stroke-dashoffset: 0; }
`;

const LogoContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  transition: 'all 0.3s ease',
  textDecoration: 'none'
});

const Logo: React.FC<LogoProps> = ({ 
  sx, 
  size = 40, 
  app = 'root', 
  variant = 'full',
  component,
  href
}) => {
  // CHROMODYNAMICS: Ecosystem Root (Cyan) blends into App Specific Hue
  const configs = {
    root: {
      color1: "#00F5FF", color2: "#00A3FF", // Neon Cyan to Blue
      name: "KYLRIX",
      desc: "Ecosystem Hub"
    },
    vault: {
      color1: "#00F5FF", color2: "#3B82F6", // Cyan to Glacier Steel
      name: "VAULT",
      desc: "Zero-Knowledge Storage"
    },
    flow: {
      color1: "#00F5FF", color2: "#00FF94", // Cyan to Cyber Lime
      name: "FLOW",
      desc: "AI Orchestration"
    },
    note: {
      color1: "#00F5FF", color2: "#A855F7", // Cyan to Amethyst Purple
      name: "NOTE",
      desc: "Structured Intelligence"
    },
    connect: {
      color1: "#00F5FF", color2: "#F43F5E", // Cyan to Electric Rose
      name: "CONNECT",
      desc: "P2P Encryption"
    }
  };

  const current = configs[app];

  return (
    <LogoContainer 
      sx={sx} 
      component={component} 
      href={href}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id={`grad-${app}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={current.color1} />
            <stop offset="100%" stopColor={current.color2} />
          </linearGradient>
          
          <filter id="grain" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feComposite operator="in" in="noise" in2="SourceGraphic" result="composite" />
            <feBlend mode="overlay" in="composite" in2="SourceGraphic" />
          </filter>

          <filter id="glow-heavy" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* VAULT: Monolith + Protected Shell */}
        {app === 'vault' && (
          <>
            <rect x="25" y="15" width="12" height="70" rx="4" fill={`url(#grad-${app})`} />
            <path
              d="M75 15L45 50L75 85"
              stroke={current.color2}
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
            <path
              d="M85 25L55 50L85 75"
              stroke={current.color1}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: `${pulse} 3s infinite ease-in-out` }}
            />
          </>
        )}

        {/* FLOW: Kinetic Orchestration */}
        {app === 'flow' && (
          <>
            <path d="M30 20V80" stroke={current.color1} strokeWidth="8" strokeLinecap="round" />
            <path
              d="M70 20L35 50L70 80"
              stroke={`url(#grad-${app})`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="10 5"
              style={{ animation: `${flowOffset} 5s linear infinite` }}
            />
            <path
              d="M85 30L60 50L85 70"
              stroke={current.color2}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.4"
            />
          </>
        )}

        {/* NOTE: Synthesis Blocks */}
        {app === 'note' && (
          <>
            <path d="M30 20V45M30 55V80" stroke={current.color1} strokeWidth="10" strokeLinecap="round" />
            <path d="M70 20L50 37" stroke={current.color2} strokeWidth="8" strokeLinecap="round" />
            <path d="M35 50L55 67L75 84" stroke={`url(#grad-${app})`} strokeWidth="8" strokeLinecap="round" />
            <circle cx="30" cy="50" r="4" fill={current.color1} />
            <circle cx="70" cy="20" r="4" fill={current.color2} />
          </>
        )}

        {/* CONNECT: Radiant Signal Center */}
        {app === 'connect' && (
          <>
            <path d="M30 20V80" stroke={current.color1} strokeWidth="6" strokeLinecap="round" opacity="0.3" />
            <path d="M70 20L35 50L70 80" stroke={current.color2} strokeWidth="6" strokeLinecap="round" opacity="0.3" />
            <circle cx="30" cy="20" r="8" fill={current.color1} filter="url(#glow-heavy)" />
            <circle cx="30" cy="80" r="8" fill={current.color1} filter="url(#glow-heavy)" />
            <circle cx="70" cy="20" r="8" fill={current.color2} filter="url(#glow-heavy)" />
            <circle cx="70" cy="80" r="8" fill={current.color2} filter="url(#glow-heavy)" />
            <circle cx="35" cy="50" r="12" fill="#fff" filter="url(#glow-heavy)" />
          </>
        )}

        {/* ROOT: High-Fidelity K */}
        {app === 'root' && (
          <g filter="url(#grain)">
            <path d="M30 20V80" stroke={`url(#grad-${app})`} strokeWidth="10" strokeLinecap="round" />
            <path d="M70 20L35 50L70 80" stroke={`url(#grad-${app})`} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="30" cy="20" r="5" fill="#fff" />
            <circle cx="30" cy="80" r="5" fill="#fff" />
            <circle cx="70" cy="20" r="5" fill="#fff" />
            <circle cx="70" cy="80" r="5" fill="#fff" />
            <circle cx="35" cy="50" r="5" fill="#fff" />
          </g>
        )}
      </svg>
      
      {variant === 'full' && (
        <Box>
          <Typography 
            sx={{ 
              fontWeight: 900, 
              letterSpacing: '-0.04em', 
              color: '#fff',
              fontSize: { xs: `${size * 0.7}px`, md: `${size * 0.8}px` },
              lineHeight: 1,
              textTransform: 'uppercase',
              fontFamily: '"Clash Display", sans-serif'
            }}
          >
            {current.name}
          </Typography>
          <Typography 
            sx={{ 
              fontSize: `${size * 0.25}px`, 
              color: current.color2,
              opacity: 0.8, 
              fontWeight: 700, 
              letterSpacing: '0.1em',
              textTransform: 'uppercase'
            }}
          >
            {current.desc}
          </Typography>
        </Box>
      )}
    </LogoContainer>
  );
};

export default Logo;
