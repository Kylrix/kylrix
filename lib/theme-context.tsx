'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { colorsDark, colorsLight } from './colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  isDark: boolean;
  colors: typeof colorsDark;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [prefsCache, setPrefsCache] = useState<Record<string, any>>({});

  // Detect system theme preference
  const getSystemTheme = useCallback((): boolean => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, []);

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);
    const initTheme = async () => {
      try {
        const { account } = await import('@/lib/appwrite');
        const prefs = await account.getPrefs();
        setPrefsCache(prefs || {});
        const savedTheme = (prefs?.theme as ThemeMode) || 'system';
        setThemeState(savedTheme);
        
        if (savedTheme === 'system') {
          setIsDark(getSystemTheme());
        } else {
          setIsDark(savedTheme === 'dark');
        }
      } catch {
        setThemeState('system');
        setIsDark(getSystemTheme());
      } finally {
        setIsLoading(false);
      }
    };

    initTheme();
  }, [getSystemTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system' || !mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDark(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    try {
      const { account } = await import('@/lib/appwrite');
      const nextPrefs = { ...prefsCache, theme: newTheme };
      await account.updatePrefs(nextPrefs);
      setPrefsCache(nextPrefs);
      setThemeState(newTheme);
      
      if (newTheme === 'system') {
        setIsDark(getSystemTheme());
      } else {
        setIsDark(newTheme === 'dark');
      }
    } catch (_error: unknown) {
      const error = _error as any;
      console.error('Failed to update theme preference:', error);
      throw error;
    }
  }, [getSystemTheme, prefsCache]);

  const currentColors = isDark ? colorsDark : colorsLight;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, colors: currentColors, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export function useColors() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default colors if context is not available
    return colorsDark;
  }
  return context.colors;
}
