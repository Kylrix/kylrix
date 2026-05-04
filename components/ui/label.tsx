import React from 'react';
import { InputLabel, InputLabelProps } from '@mui/material';

export interface LabelProps extends InputLabelProps {
  children: React.ReactNode;
}

export function Label({ children, sx, ...props }: LabelProps) {
  return (
    <InputLabel 
      sx={{ 
        fontSize: '0.8rem', 
        fontWeight: 700, 
        mb: 1,
        color: 'rgba(255, 255, 255, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontFamily: '"Space Grotesk", sans-serif',
        ...sx
      }}
      {...props}
    >
      {children}
    </InputLabel>
  );
}
