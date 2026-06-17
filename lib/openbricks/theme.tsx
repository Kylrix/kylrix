'use client';

// Helper function to stretch colors with alpha opacity
export function alpha(color: string, value: number): string {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${value})`;
  }
  if (color.startsWith('rgba')) {
    return color.replace(/[^,]+(?=\))/, String(value));
  }
  return color;
}

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

export function useCreateTheme(options: any = {}) {
  const defaultTheme = useTheme();
  return {
    ...defaultTheme,
    ...options,
    palette: {
      ...defaultTheme.palette,
      ...options.palette,
    },
  };
}

export const ThemeProvider = ({ children, theme }: any) => {
  return <>{children}</>;
};
ThemeProvider.displayName = 'ThemeProvider';

export const styled = (Component: any) => {
  return (stylesOrFn: any) => {
    const StyledComponent = (props: any) => {
      // Return Component with styles applied or forwarded
      return <Component {...props} />;
    };
    StyledComponent.displayName = `Styled(${Component.displayName || Component.name || 'Component'})`;
    return StyledComponent;
  };
};
