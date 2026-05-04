'use client';

import React from 'react';
import { useLastActiveApp } from '@/lib/sdk/ecosystem';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { SourceProvider } from '@/lib/source-context';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/lib/theme-context';
import { useEcosystemNode } from '@/lib/use-ecosystem-node';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { AppwriteService, getCurrentUser } from '@/lib/appwrite';
import { AuthProvider } from '@/context/AuthContext';
import { SubscriptionProvider } from '@/context/subscription/SubscriptionContext';
import { DataNexusProvider } from '@/context/DataNexusContext';
import TwoFactorReminderHost from '@/components/TwoFactorReminderHost';

const SURFACE_BACKGROUND = '#000000';
const SURFACE = '#161514';
const SURFACE_ELEVATED = '#1F1D1B';

const getDesignTokens = (_isDark: boolean): any => ({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366F1', // Electric Teal
      contrastText: '#000000',
    },
    secondary: {
      main: '#F2F2F2', // Titanium
    },
    background: {
      default: SURFACE_BACKGROUND,
      paper: SURFACE,
    },
    text: {
      primary: '#F2F2F2',   // Titanium
      secondary: '#A1A1AA', // Gunmetal
      disabled: '#404040',  // Carbon
    },
    divider: 'rgba(255, 255, 255, 0.1)', // Subtle Border
  },
  typography: {
    fontFamily: '"Satoshi", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontFamily: '"Clash Display", "Satoshi", sans-serif',
      fontSize: '3.5rem',
      fontWeight: 900,
      letterSpacing: '-0.04em',
      color: '#F2F2F2',
    },
    h2: {
      fontFamily: '"Clash Display", "Satoshi", sans-serif',
      fontSize: '2.5rem',
      fontWeight: 900,
      letterSpacing: '-0.03em',
    },
    h3: {
      fontFamily: '"Clash Display", "Satoshi", sans-serif',
      fontSize: '2rem',
      fontWeight: 900,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontFamily: '"Clash Display", "Satoshi", sans-serif',
      fontSize: '1.5rem',
      fontWeight: 900,
    },
    button: {
      fontFamily: '"Clash Display", "Satoshi", sans-serif',
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: SURFACE_BACKGROUND,
          color: '#F2F2F2',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          padding: '10px 24px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          '&:hover': {
            borderColor: 'rgba(99, 102, 241, 0.5)',
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
            transform: 'translateY(-2px)',
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
        containedPrimary: {
          backgroundColor: '#6366F1',
          color: '#000000',
          border: 'none',
          '&:hover': {
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: SURFACE,
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          backgroundColor: SURFACE_ELEVATED,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundImage: 'none',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        },
      },
    },
  },
});

function MuiThemeWrapper({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  useEcosystemNode('id');
  
  React.useEffect(() => {
    ecosystemSecurity.init('id');
    
    // Proactive Global Sync
      (async () => {
        try {
          const u = await getCurrentUser(true);
          if (u) await AppwriteService.ensureGlobalProfile(u);
        } catch (_e: unknown) {
          // No session
      }
    })();
  }, []);

  const theme = createTheme(getDesignTokens(isDark));

  React.useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(isDark ? 'dark' : 'light');
    localStorage.setItem('id-theme-mode', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  useLastActiveApp();
  
  return (
    <DataNexusProvider>
      <SubscriptionProvider>
        <AppThemeProvider>
          <AuthProvider>
            <MuiThemeWrapper>
              <SourceProvider>
                {children}
                <TwoFactorReminderHost />
              </SourceProvider>
            </MuiThemeWrapper>
          </AuthProvider>
        </AppThemeProvider>
      </SubscriptionProvider>
    </DataNexusProvider>
  );
}
