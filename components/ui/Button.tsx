import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, CircularProgress } from '@mui/material';

export interface ButtonProps extends MuiButtonProps {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ isLoading, children, disabled, variant = 'contained', size = 'medium', sx, ...props }, ref) => {
    const getVariantStyles = () => {
      if (variant === 'contained') {
        return {
          bgcolor: '#6366F1',
          color: '#000000',
          fontWeight: 700,
          fontFamily: '"Space Grotesk", sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
          '&:hover': {
            bgcolor: '#00D1DA',
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.5)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        };
      }
      if (variant === 'outlined') {
        return {
          border: '1px solid rgba(99, 102, 241, 0.5)',
          color: '#6366F1',
          bgcolor: 'transparent',
          backdropFilter: 'blur(10px)',
          fontWeight: 600,
          '&:hover': {
            border: '1px solid #6366F1',
            bgcolor: 'rgba(99, 102, 241, 0.1)',
          },
        };
      }
      return {
        color: '#6366F1',
        '&:hover': {
          bgcolor: 'rgba(99, 102, 241, 0.05)',
        },
      };
    };

    return (
      <MuiButton
        ref={ref}
        variant={variant as any}
        size={size}
        disabled={isLoading || disabled}
        startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : props.startIcon}
        sx={{
          borderRadius: '12px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          ...getVariantStyles(),
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiButton>
    );
  }
);
Button.displayName = 'Button';

export { Button };

