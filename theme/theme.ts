import { createTheme, ThemeOptions, alpha } from '@mui/material/styles';

const SURFACE_BACKGROUND = '#000000';
const SURFACE = '#161514';
/**
 * KYLRIX ECOSYSTEM DESIGN SYSTEM v3
 * Intelligent Theme Architecture
 * 
 * Concept: 
 * 1. Semantic Tokens: We use standard MUI palette names but bind them to Ecosystem roles.
 * 2. Primary = Ecosystem Identity (Indigo/Flow)
 * 3. Secondary = App Identity (Pink/Note)
 * 4. Surface System = Glassmorphic layers that adapt to background luminance.
 */

const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: '#6366F1', // Ecosystem Indigo
      light: '#818CF8',
      dark: '#4F46E5',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#EC4899', // App Pink
      light: '#F472B6',
      dark: '#DB2777',
      contrastText: '#FFFFFF',
    },
    background: {
      default: mode === 'dark' ? SURFACE_BACKGROUND : '#F1F5F9',
      paper: mode === 'dark' ? SURFACE : '#FFFFFF',
    },
    text: {
      primary: mode === 'dark' ? '#F8FAFC' : '#0F172A',
      secondary: mode === 'dark' ? '#94A3B8' : '#475569',
    },
    divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
  },
  typography: {
    fontFamily: 'var(--font-satoshi), "Satoshi", sans-serif',
    h1: { fontFamily: 'var(--font-clash), sans-serif', fontWeight: 900 },
    h2: { fontFamily: 'var(--font-clash), sans-serif', fontWeight: 900 },
    h3: { fontFamily: 'var(--font-clash), sans-serif', fontWeight: 900 },
    h4: { fontFamily: 'var(--font-clash), sans-serif', fontWeight: 900 },
    button: { fontFamily: 'var(--font-clash), sans-serif', fontWeight: 700, textTransform: 'none' },
  },
  shape: { borderRadius: 16 },
  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.4)',
    '0px 4px 8px rgba(0,0,0,0.4)',
    '0px 8px 16px rgba(0,0,0,0.5)',
    '0px 12px 24px rgba(0,0,0,0.5)',
    '0px 16px 32px rgba(0,0,0,0.6)',
    '0px 20px 40px rgba(0,0,0,0.6)',
    '0px 24px 48px rgba(0,0,0,0.7)',
    '0px 28px 56px rgba(0,0,0,0.7)',
    '0px 32px 64px rgba(0,0,0,0.8)',
    ...Array(15).fill('0px 32px 64px rgba(0,0,0,0.8)')
  ] as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        body: {
          backgroundColor: theme.palette.background.default,
          backgroundImage: mode === 'dark'
            ? `radial-gradient(circle at 50% -20%, ${alpha('#6366F1', 0.1)} 0%, transparent 70%),\n               linear-gradient(180deg, ${alpha(SURFACE, 0.35)} 0%, transparent 100%)`
            : `radial-gradient(circle at 50% -20%, ${alpha('#6366F1', 0.05)} 0%, transparent 70%)`,
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        },
      }),
    },
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 14,
          padding: '10px 24px',
          fontWeight: 700,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: mode === 'dark' ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: mode === 'dark' 
              ? `0 12px 24px -10px ${alpha(theme.palette.primary.main, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.1)` 
              : `0 8px 20px -8px ${alpha(theme.palette.primary.main, 0.4)}`,
          },
        }),
        containedPrimary: ({ theme }) => ({
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        }),
        containedSecondary: ({ theme }) => ({
          background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
          boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 28,
          background: mode === 'dark' 
            ? `linear-gradient(165deg, ${SURFACE} 0%, ${SURFACE_BACKGROUND} 100%)`
            : `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`,
          border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : theme.palette.divider}`,
          boxShadow: mode === 'dark'
            ? `0 20px 40px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0,0,0,0.5)`
            : `0 10px 30px -10px ${alpha(theme.palette.text.primary, 0.1)}, inset 0 1px 1px ${alpha('#FFFFFF', 0.8)}`,
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            transform: 'translateY(-8px) scale(1.01)',
            borderColor: alpha(theme.palette.secondary.main, 0.4),
            boxShadow: mode === 'dark'
              ? `0 40px 80px -20px rgba(0,0,0,0.9), 0 0 20px ${alpha(theme.palette.primary.main, 0.15)}, inset 0 1px 1px ${alpha('#FFFFFF', 0.1)}`
              : `0 25px 50px -12px ${alpha(theme.palette.primary.main, 0.2)}`,
          },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          backgroundColor: mode === 'dark' ? SURFACE : alpha(theme.palette.background.paper, 0.8),
          border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : theme.palette.divider}`,
          boxShadow: mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)' : 'none',
        }),
      },
    },
  },
});

export const darkTheme = createTheme(getDesignTokens('dark'));
export const lightTheme = createTheme(getDesignTokens('light'));

export default darkTheme;
