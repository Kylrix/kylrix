'use client';

import { createTheme, ThemeOptions, alpha, PaletteMode } from '@mui/material/styles';

const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'dark' ? {
      primary: {
        main: '#EC4899', // Muted V3 Pink
        contrastText: '#000000',
      },
      secondary: {
        main: '#F2F2F2', // Titanium
      },
      background: {
        default: '#0A0908', // Deep Earth
        paper: '#161412',   // Surface
      },
      text: {
        primary: '#F2F2F2',   // Titanium
        secondary: '#A1A1AA', // Zinc
        disabled: '#404040',
      },
      divider: 'rgba(255, 255, 255, 0.08)',
    } : {
      primary: {
        main: '#6366F1',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#18181B',
      },
      background: {
        default: '#FDFCFB',
        paper: '#FFFFFF',
      },
      text: {
        primary: '#09090B',
        secondary: '#52525B',
        disabled: '#A1A1AA',
      },
      divider: 'rgba(0, 0, 0, 0.08)',
    }),
  },
  typography: {
    fontFamily: '"Satoshi Variable", "Satoshi", sans-serif',
    h1: {
      fontFamily: '"Clash Display Variable", "Clash Display", sans-serif',
      fontSize: 'clamp(3rem, 10vw, 5.5rem)',
      fontWeight: 900,
      letterSpacing: '-0.05em',
      lineHeight: 1.05,
      color: mode === 'dark' ? '#F2F2F2' : '#09090B',
    },
    h2: {
      fontFamily: '"Clash Display Variable", "Clash Display", sans-serif',
      fontSize: 'clamp(2.5rem, 8vw, 4rem)',
      fontWeight: 900,
      letterSpacing: '-0.04em',
      lineHeight: 1.1,
    },
    h3: {
      fontFamily: '"Clash Display Variable", "Clash Display", sans-serif',
      fontSize: 'clamp(2rem, 6vw, 2.5rem)',
      fontWeight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1.2,
    },
    h4: {
      fontFamily: '"Clash Display Variable", "Clash Display", sans-serif',
      fontSize: '1.75rem',
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    subtitle1: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.6,
      color: mode === 'dark' ? '#A1A1AA' : '#52525B',
    },
      subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.4em', // Enhanced for premium look
        color: '#EC4899',
      },
    body1: {
      fontSize: '1.125rem',
      fontWeight: 400,
      lineHeight: 1.7,
    },
    body2: {
      fontSize: '1rem',
      fontWeight: 400,
      color: mode === 'dark' ? '#A1A1AA' : '#52525B',
      lineHeight: 1.6,
    },
    button: {
      fontFamily: '"Clash Display Variable", "Clash Display", sans-serif',
      textTransform: 'none',
      fontWeight: 700,
      letterSpacing: '0.05em',
    }
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: '24px',
          paddingRight: '24px',
          '@media (min-width: 900px)': {
            paddingLeft: '64px',
            paddingRight: '64px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          padding: '12px 28px',
          fontSize: '1rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        },
        containedPrimary: {
          backgroundColor: '#EC4899',
          color: mode === 'dark' ? '#000000' : '#FFFFFF',
          '&:hover': {
            backgroundColor: '#D946EF',
            boxShadow: '0 0 30px rgba(236, 72, 153, 0.4)',
          },
        },
        outlined: {
          borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          color: mode === 'dark' ? '#F2F2F2' : '#09090B',
          '&:hover': {
            backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#161412' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(30px) saturate(180%)',
          border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 24,
          backgroundImage: 'none',
          boxShadow: mode === 'dark' ? '0 1px 0 rgba(0,0,0,0.4)' : 'none',
          '&::before': mode === 'dark' ? {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '24px',
            pointerEvents: 'none'
          } : {},
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: mode === 'dark' ? '#0A0908' : '#FDFCFB',
          color: mode === 'dark' ? '#F2F2F2' : '#09090B',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: mode === 'dark' ? '#222' : '#DDD',
            borderRadius: '10px',
          },
        },
      },
    },
  },
});

export { getDesignTokens };
