'use client';

import { ThemeModeProvider } from '../context/ThemeContext';

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return <ThemeModeProvider>{children}</ThemeModeProvider>;
}
