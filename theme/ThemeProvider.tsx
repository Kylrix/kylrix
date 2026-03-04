'use client';

import { ThemeModeProvider } from '../context/ThemeContext';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeModeProvider>
        <CssBaseline />
        {children}
      </ThemeModeProvider>
    </AppRouterCacheProvider>
  );
}
