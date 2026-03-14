import React from 'react';
import { Box, Typography } from '@mui/material';

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
  const configs: Record<KylrixApp, { color1: string; color2: string; name: string; desc: string }> = {
    root: { color1: "#6366F1", color2: "#00A3FF", name: "KYLRIX", desc: "Home" },
    vault: { color1: "#6366F1", color2: "#3B82F6", name: "VAULT", desc: "Vault" },
    flow: { color1: "#6366F1", color2: "#00FF94", name: "FLOW", desc: "Workflows" },
    note: { color1: "#6366F1", color2: "#A855F7", name: "NOTE", desc: "Notes" },
    connect: { color1: "#6366F1", color2: "#F43F5E", name: "CONNECT", desc: "Connect" }
  };

  const current = configs[app] || configs.root;

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
      <Box 
        component="img" 
        src="/logo.jpg" 
        alt="Kylrix Logo" 
        sx={{ 
          width: size, 
          height: size, 
          borderRadius: '20%',
          objectFit: 'cover'
        }} 
      />
      
      {variant === 'full' && (
        <Box>
          <Typography sx={{ fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', fontSize: `${size * 0.7}px`, lineHeight: 1, textTransform: 'uppercase', fontFamily: '"Space Grotesk", sans-serif' }}>
            {current.name}
          </Typography>
          <Typography sx={{ fontSize: `${size * 0.22}px`, color: current.color2, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: '"Space Grotesk", sans-serif' }}>
            {current.desc}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Logo;
