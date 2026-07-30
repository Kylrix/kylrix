'use client';

// Helper function to stretch colors with alpha opacity

export function useTheme() {
  return {
    palette: {
      mode: 'dark',
      primary: { main: '#6366F1', light: '#818CF8', dark: '#4F46E5', contrastText: '#FFFFFF' },
      secondary: { main: '#EC4899', light: '#F472B6', dark: '#DB2777', contrastText: '#FFFFFF' },
      background: { default: '#000000', paper: '#141211' },
      text: { primary: '#F8FAFC', secondary: '#9B9691' },
      divider: '#23211F',
    },
    shape: { borderRadius: 16 },
    spacing: (val: number) => `${val * 4}px`,
  };
}


const ThemeProvider = ({ children}: any) => {
  return <>{children}</>;
};
ThemeProvider.displayName = 'ThemeProvider';

