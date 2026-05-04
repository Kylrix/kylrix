import React from 'react';
import { Chip } from '@mui/material';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const getStyles = () => {
    switch (variant) {
      case 'default':
        return {
          bgcolor: 'rgba(99, 102, 241, 0.1)',
          color: '#6366F1',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        };
      case 'secondary':
        return {
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          color: 'rgba(255, 255, 255, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        };
      case 'success':
        return {
          bgcolor: 'rgba(0, 255, 127, 0.1)',
          color: '#00FF7F',
          border: '1px solid rgba(0, 255, 127, 0.2)',
        };
      case 'warning':
        return {
          bgcolor: 'rgba(255, 165, 0, 0.1)',
          color: '#FFA500',
          border: '1px solid rgba(255, 165, 0, 0.2)',
        };
      case 'error':
        return {
          bgcolor: 'rgba(255, 69, 58, 0.1)',
          color: '#FF453A',
          border: '1px solid rgba(255, 69, 58, 0.2)',
        };
      default:
        return {};
    }
  };

  return (
    <Chip 
      label={children} 
      size="small" 
      sx={{ 
        height: 20, 
        fontSize: '0.65rem', 
        fontWeight: 700,
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontFamily: 'var(--font-satoshi), sans-serif',
        ...getStyles()
      }} 
    />
  );
}
