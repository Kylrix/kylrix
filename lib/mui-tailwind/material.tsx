'use client';

import React from 'react';

const OPENBRICKS_TOKENS = {
  shell: '#000000',
  surface: '#161412',
  surfaceAlt: '#1C1917',
  border: 'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.05)',
  text: '#F5F2ED',
  textMuted: 'rgba(245,242,237,0.68)',
  connectAccent: '#F59E0B',
  primary: '#6366F1',
} as const;

export const alpha = (color: string, value: number) => {
  const a = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
  const input = (color || '').trim();
  if (!input) return `rgba(255,255,255,${a})`;

  if (input.startsWith('#')) {
    const hex = input.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((char) => char + char).join('')
      : hex.length === 6
        ? hex
        : null;
    if (!normalized) return input;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  const rgbMatch = input.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((part) => part.trim());
    if (parts.length >= 3) {
      const r = Number(parts[0]);
      const g = Number(parts[1]);
      const b = Number(parts[2]);
      if ([r, g, b].every((part) => Number.isFinite(part))) {
        return `rgba(${r},${g},${b},${a})`;
      }
    }
  }

  return input;
};
export const createTheme = (theme: any) => theme;
export const ThemeProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const AppRouterCacheProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const styled = (Component: any) => Component;
export const CssBaseline = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const useTheme = () => ({
  palette: {
    mode: 'dark',
    primary: { main: '#6366F1', dark: '#4F46E5' },
    secondary: { main: '#EC4899', dark: '#DB2777' },
    background: { default: '#000000', paper: '#161514' },
    text: { primary: '#F8FAFC', secondary: '#9B9691' },
    divider: 'rgba(255, 255, 255, 0.05)',
  },
  breakpoints: {
    down: (key: string) => {
      const map: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
      return `(max-width: ${map[key] ?? 768}px)`;
    },
    up: (key: string) => {
      const map: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
      return `(min-width: ${map[key] ?? 768}px)`;
    },
    between: (start: string, end: string) => {
      const map: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
      return `(min-width: ${map[start] ?? 768}px) and (max-width: ${map[end] ?? 1280}px)`;
    },
  },
  spacing: (...values: number[]) => values.map((value) => `${value * 8}px`).join(' '),
});
export const useMediaQuery = (query: string, options?: { noSsr?: boolean }) => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(query).matches;
};

const breakpointsPx: Record<string, number> = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 };

const pickResponsiveValue = (value: any) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (typeof window === 'undefined') return value.md ?? value.sm ?? value.xs ?? Object.values(value)[0];
  const width = window.innerWidth;
  let picked: any = value.xs ?? Object.values(value)[0];
  for (const [bp, min] of Object.entries(breakpointsPx)) {
    if (width >= min && value[bp] !== undefined) picked = value[bp];
  }
  return picked;
};

const normalizeStyleValue = (key: string, value: any) => {
  if (value === undefined || value === null) return value;
  const resolved = pickResponsiveValue(value);
  if (typeof resolved === 'number') {
    // Unitless numeric styles (MUI ratios / weights) — never append px.
    if (key === 'lineHeight' || key === 'opacity' || key === 'zIndex' || key === 'fontWeight' || key === 'flex') {
      return resolved;
    }
    if (/(padding|margin|gap)/i.test(key)) {
      return `${resolved * 8}px`;
    }
    // Match dimensional keys exactly; avoid substring hits like lineHeight → "height".
    if (
      /^(width|height|minWidth|minHeight|maxWidth|maxHeight|top|left|right|bottom|fontSize|borderRadius)$/i.test(key) ||
      /(Width|Height|Top|Left|Right|Bottom|Radius)$/i.test(key)
    ) {
      return `${resolved}px`;
    }
  }
  return resolved;
};

const sxKeyMap: Record<string, string> = {
  bgcolor: 'backgroundColor',
  px: 'paddingInline',
  py: 'paddingBlock',
  pt: 'paddingTop',
  pb: 'paddingBottom',
  pl: 'paddingLeft',
  pr: 'paddingRight',
  mx: 'marginInline',
  my: 'marginBlock',
  mt: 'marginTop',
  mb: 'marginBottom',
  ml: 'marginLeft',
  mr: 'marginRight',
};

const splitSx = (sx: any) => {
  const root: any = {};
  const nested: Record<string, any> = {};
  if (!sx || typeof sx !== 'object') return { root: sx, nested };
  for (const key in sx) {
    if (key.startsWith('&')) {
      nested[key] = sx[key];
      continue;
    }
    if (key.startsWith('@')) continue;
    const mappedKey = sxKeyMap[key] || key;
    root[mappedKey] = normalizeStyleValue(mappedKey, sx[key]);
  }
  return { root, nested };
};

const cleanSx = (sx: any) => splitSx(sx).root;

const isRenderableComponentType = (value: any) => {
  if (!value) return false;
  if (typeof value === 'function') return true;
  if (typeof value === 'object' && value.$$typeof) return true;
  return false;
};

// 1. Box Component
export const Box = React.forwardRef(({ children, sx, className, component: Component = 'div', display, alignItems, justifyContent, flexWrap, flexDirection, gap, ...props }: any, ref) => {
  const inlineStyle = {
    ...(display !== undefined ? { display } : {}),
    ...(alignItems !== undefined ? { alignItems } : {}),
    ...(justifyContent !== undefined ? { justifyContent } : {}),
    ...(flexWrap !== undefined ? { flexWrap } : {}),
    ...(flexDirection !== undefined ? { flexDirection } : {}),
    ...(gap !== undefined ? { gap: normalizeStyleValue('gap', gap) } : {}),
    ...cleanSx(sx),
  };
  return (
    <Component
      ref={ref}
      className={className}
      style={inlineStyle}
      {...props}
    >
      {children}
    </Component>
  );
});
Box.displayName = 'Box';

// 2. Button Component
export const Button = React.forwardRef(({ children, className, sx, variant = 'text', color = 'primary', size = 'medium', disabled, startIcon, endIcon, fullWidth, disableElevation, disableRipple, disableFocusRipple, disableTouchRipple, component, ...props }: any, ref) => {
  let baseClass = "inline-flex items-center justify-center font-bold font-clash rounded-xl px-5 py-2.5 transition-all duration-300 border border-[#23211F] text-sm active:scale-95";
  if (disabled) {
    baseClass += " opacity-50 cursor-not-allowed bg-stone-900 text-stone-500 border-stone-800";
  } else if (variant === 'contained') {
    if (color === 'secondary') {
      baseClass += " bg-pink-600 text-white hover:bg-pink-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-lg hover:-translate-y-0.5";
    } else {
      baseClass += " bg-[#6366F1] text-white hover:bg-[#4F46E5] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-lg hover:-translate-y-0.5";
    }
  } else {
    baseClass += " bg-[#0B0A09] text-stone-200 hover:bg-[#131110] hover:-translate-y-0.5";
  }
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`${baseClass} ${fullWidth ? 'w-full' : ''} ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {startIcon ? <span style={{ display: 'inline-flex', marginRight: 8, alignItems: 'center' }}>{startIcon}</span> : null}
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{children}</span>
      {endIcon ? <span style={{ display: 'inline-flex', marginLeft: 8, alignItems: 'center' }}>{endIcon}</span> : null}
    </button>
  );
});
Button.displayName = 'Button';

// 3. IconButton Component
export const IconButton = React.forwardRef(({ children, className, sx, disabled, size, color, edge, ...props }: any, ref) => {
  const baseClass = "inline-flex items-center justify-center p-2 rounded-xl border border-[#23211F] bg-[#0A0908] text-stone-400 hover:text-stone-200 hover:bg-[#141211] active:scale-95 transition-all";
  const sizeMap: Record<string, number> = { small: 32, medium: 40, large: 48 };
  const pixelSize = typeof size === 'string' ? (sizeMap[size] || 40) : 40;
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`${baseClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className || ''}`}
      style={{ width: pixelSize, height: pixelSize, ...cleanSx(sx) }}
      {...props}
    >
      {children}
    </button>
  );
});
IconButton.displayName = 'IconButton';

// 4. Card Component
export const Card = React.forwardRef(({ children, className, sx, ...props }: any, ref) => {
  const hasCustomHover = sx && (sx['&:hover'] || sx.transform || sx.transition);
  const hoverClasses = !hasCustomHover
    ? "hover:border-pink-500/40 hover:-translate-y-1 hover:scale-[1.01] transition-all duration-500"
    : "transition-all duration-300";
  return (
    <div
      ref={ref}
      className={`rounded-3xl bg-[#141211] border border-[#23211F] shadow-[1px_1px_0px_#23211F,2px_2px_0px_#1E1B19,3px_3px_0px_#161412,4px_4px_0px_#0A0908,5px_5px_0px_#000000] p-6 ${hoverClasses} ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

// 5. CardContent & CardActions
export const CardContent = ({ children, className, sx, ...props }: any) => (
  <div className={`p-1 ${className || ''}`} style={cleanSx(sx)} {...props}>{children}</div>
);
export const CardActions = ({ children, className, sx, ...props }: any) => (
  <div className={`flex items-center gap-2 pt-4 ${className || ''}`} style={cleanSx(sx)} {...props}>{children}</div>
);

export const LinearProgress = ({ value = 0, className, ...props }: any) => (
  <div className={`h-2 w-full rounded-full bg-[#23211F] ${className || ''}`} {...props}>
    <div className="h-full rounded-full bg-[#6366F1]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const AppBar = React.forwardRef(({ children, className, sx, position = 'fixed', ...props }: any, ref) => {
  const posClass = position === 'fixed' ? 'fixed top-0 left-0 right-0' : position === 'sticky' ? 'sticky top-0' : '';
  return (
    <header
      ref={ref}
      className={`w-full flex flex-col ${posClass} ${className || ''}`}
      style={{
        borderBottom: `1px solid ${OPENBRICKS_TOKENS.borderSoft}`,
        background: OPENBRICKS_TOKENS.surface,
        ...cleanSx(sx),
      }}
      {...props}
    >
      {children}
    </header>
  );
});
AppBar.displayName = 'AppBar';

export const Toolbar = React.forwardRef(({ children, className, sx, ...props }: any, ref) => (
  <div
    ref={ref}
    className={`flex items-center gap-3 px-4 py-3 ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </div>
));
Toolbar.displayName = 'Toolbar';

export const Tabs = React.forwardRef(({ children, className, sx, value, onChange, variant, ...props }: any, ref) => {
  const { root, nested } = splitSx(sx);
  const tabRootSx = cleanSx(nested['& .MuiTab-root'] || {});
  const tabSelectedSx = cleanSx((nested['& .MuiTab-root'] || {})['&.Mui-selected'] || {});
  const tabHoverSx = cleanSx((nested['& .MuiTab-root'] || {})['&:hover:not(.Mui-selected)'] || {});
  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 ${className || ''}`}
      style={root}
      {...props}
    >
      {React.Children.map(children, (child, idx) => {
        if (!React.isValidElement(child)) return child;
        const childValue = (child.props as any).value ?? idx;
        const selected = childValue === value;
        return React.cloneElement(child as any, {
          selected,
          fullWidth: variant === 'fullWidth',
          __tabRootSx: tabRootSx,
          __tabSelectedSx: tabSelectedSx,
          __tabHoverSx: tabHoverSx,
          onClick: (e: any) => {
            onChange?.(e, childValue);
            (child.props as any).onClick?.(e);
          },
        });
      })}
    </div>
  );
});
Tabs.displayName = 'Tabs';

export const Tab = React.forwardRef(({ label, children, className, sx, icon, iconPosition = 'start', selected, fullWidth, __tabRootSx, __tabSelectedSx, __tabHoverSx, ...props }: any, ref) => (
  <button
    ref={ref}
    className={`rounded-xl px-4 py-2 text-sm font-medium ${selected ? 'text-white bg-[#1E1B19]' : 'text-stone-300 hover:bg-[#1E1B19]'} ${fullWidth ? 'flex-1 min-w-0' : ''} ${className || ''}`}
    style={{
      ...__tabRootSx,
      ...(selected ? __tabSelectedSx : __tabHoverSx),
      ...cleanSx(sx),
    }}
    {...props}
  >
    {icon ? (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          flexDirection: iconPosition === 'end' ? 'row-reverse' : 'row',
        }}
      >
        {icon}
        <span>{label ?? children}</span>
      </span>
    ) : (
      label ?? children
    )}
  </button>
));
Tab.displayName = 'Tab';

export const FormControlLabel = ({ control, label, className, ...props }: any) => (
  <label className={`inline-flex items-center gap-2 ${className || ''}`} {...props}>
    {control}
    <span>{label}</span>
  </label>
);

export const InputAdornment = ({ children, className, ...props }: any) => (
  <span className={`inline-flex items-center text-stone-500 ${className || ''}`} {...props}>{children}</span>
);

export const List = ({ children, className, ...props }: any) => (
  <div className={`flex flex-col ${className || ''}`} {...props}>{children}</div>
);

export const ListItem = ({ children, className, ...props }: any) => (
  <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${className || ''}`} {...props}>{children}</div>
);

export const ListItemAvatar = ({ children, className, ...props }: any) => (
  <div className={`shrink-0 ${className || ''}`} {...props}>{children}</div>
);

export const ListItemButton = ({ children, className, ...props }: any) => (
  <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#1E1B19] ${className || ''}`} {...props}>{children}</button>
);

export const ListItemText = ({ primary, secondary, children, className, ...props }: any) => (
  <div className={`flex min-w-0 flex-1 flex-col ${className || ''}`} {...props}>
    {children ?? (
      <>
        <span className="truncate text-sm text-stone-200">{primary}</span>
        {secondary ? <span className="truncate text-xs text-stone-500">{secondary}</span> : null}
      </>
    )}
  </div>
);

// 6. Paper Component
export const Paper = React.forwardRef(({ children, className, sx, component: Component = 'div', ...props }: any, ref) => {
  const hasPaddingInSx = sx && typeof sx === 'object' && (
    'p' in sx || 'padding' in sx || 'px' in sx || 'py' in sx || 'pt' in sx || 'pb' in sx || 'pl' in sx || 'pr' in sx
  );
  return (
    <Component
      ref={ref}
      className={`rounded-2xl bg-[#0A0908] border border-[#23211F] ${hasPaddingInSx ? '' : 'p-4'} ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </Component>
  );
});
Paper.displayName = 'Paper';

// 7. Typography Component
export const Typography = React.forwardRef(({ children, className, sx, variant = 'body1', component, noWrap, gutterBottom, ...props }: any, ref) => {
  let Component = component;
  let fontClass = "text-stone-200";
  
  if (variant === 'h1' || variant === 'h2' || variant === 'h3' || variant === 'h4' || variant === 'h5' || variant === 'h6') {
    if (!Component) Component = variant;
    fontClass = "font-clash font-extrabold text-stone-100 tracking-tight";
    if (variant === 'h1') fontClass += " text-4xl md:text-5xl";
    if (variant === 'h2') fontClass += " text-3xl md:text-4xl";
    if (variant === 'h3') fontClass += " text-2xl md:text-3xl";
    if (variant === 'h4') fontClass += " text-xl md:text-2xl";
    if (variant === 'h5') fontClass += " text-lg md:text-xl";
    if (variant === 'h6') fontClass += " text-base md:text-lg";
  } else if (variant === 'subtitle1' || variant === 'subtitle2') {
    if (!Component) Component = 'h6';
    fontClass = "font-medium text-stone-300";
  } else if (variant === 'body2') {
    if (!Component) Component = 'p';
    fontClass = "text-sm text-stone-400 font-satoshi";
  } else if (variant === 'caption') {
    if (!Component) Component = 'span';
    fontClass = "text-xs text-stone-500 font-mono";
  } else {
    if (!Component) Component = 'p';
    fontClass = "text-base text-stone-300 font-satoshi";
  }
  
  return (
    <Component
      ref={ref}
      className={`${fontClass} ${className || ''}`}
      style={{
        // MUI Typography does not use browser default paragraph margins.
        margin: 0,
        ...(noWrap ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
        ...(gutterBottom ? { marginBottom: '0.35em' } : {}),
        ...cleanSx(sx),
      }}
      {...props}
    >
      {children}
    </Component>
  );
});
Typography.displayName = 'Typography';

// 8. Grid Component
export const Grid = React.forwardRef(({ children, container, item, size, xs, sm, md, lg, spacing, className, sx, ...props }: any, ref) => {
  let classes = className || '';
  const style: any = { ...cleanSx(sx) };
  if (container) {
    classes += ' grid grid-cols-12';
    style.gap = normalizeStyleValue('gap', spacing ?? 2);
  }
  
  const computedSize = typeof size === 'object' ? size : undefined;
  if (item || computedSize || xs || sm || md || lg) {
    const span = (computedSize?.lg ?? lg) ?? (computedSize?.md ?? md) ?? (computedSize?.sm ?? sm) ?? (computedSize?.xs ?? xs);
    if (span && span !== true && span !== 'auto') {
      style.gridColumn = `span ${span} / span ${span}`;
    }
  }
  
  return (
    <div ref={ref} className={classes} style={style} {...props}>
      {children}
    </div>
  );
});
Grid.displayName = 'Grid';

// 9. Stack Component
export const Stack = React.forwardRef(({ children, direction = 'column', spacing = 2, className, sx, alignItems, justifyContent, flexWrap, useFlexGap, divider, ...props }: any, ref) => {
  const flexDirection = direction === 'row' ? 'row' : 'column';
  return (
    <div
      ref={ref}
      className={`flex ${className || ''}`}
      style={{
        flexDirection,
        gap: normalizeStyleValue('gap', spacing),
        ...(alignItems !== undefined ? { alignItems } : {}),
        ...(justifyContent !== undefined ? { justifyContent } : {}),
        ...(flexWrap !== undefined ? { flexWrap } : {}),
        ...cleanSx(sx),
      }}
      {...props}
    >
      {children}
    </div>
  );
});
Stack.displayName = 'Stack';

// 10. TextField Component
export const TextField = React.forwardRef(({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  fullWidth,
  disabled,
  error,
  helperText,
  className,
  sx,
  inputRef,
  InputProps,
  multiline,
  rows,
  minRows,
  maxRows,
  ...props
}: any, ref) => {
  const inputStyle = cleanSx(InputProps?.sx);
  const inputClass = `w-full bg-[#0A0908] border ${error ? 'border-red-500' : 'border-[#23211F]'} text-stone-200 rounded-xl px-4 py-2.5 text-sm font-space-grotesk outline-none focus:border-indigo-500 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''} ${className || ''}`} style={cleanSx(sx)}>
      {label && (
        <label className="text-xs font-bold text-stone-400 tracking-wide uppercase font-clash">
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          ref={inputRef || ref}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows ?? minRows ?? 3}
          className={inputClass}
          style={inputStyle}
          {...props}
        />
      ) : (
        <input
          ref={inputRef || ref}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClass}
          style={inputStyle}
          {...props}
        />
      )}
      {helperText && (
        <span className={`text-xs ${error ? 'text-red-500' : 'text-stone-500'} font-mono`}>
          {helperText}
        </span>
      )}
    </div>
  );
});
TextField.displayName = 'TextField';

// 11. Dialog Component
export const Dialog = React.forwardRef(({ open, onClose, children, maxWidth = 'sm', fullWidth, sx, className, ...props }: any, ref) => {
  if (!open) return null;
  
  let maxWClass = "max-w-md";
  if (maxWidth === 'xs') maxWClass = "max-w-xs";
  if (maxWidth === 'sm') maxWClass = "max-w-sm";
  if (maxWidth === 'md') maxWClass = "max-w-md";
  if (maxWidth === 'lg') maxWClass = "max-w-lg";
  if (maxWidth === 'xl') maxWClass = "max-w-xl";
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        ref={ref}
        className={`relative z-10 w-full ${maxWClass} bg-[#141211] border border-[#23211F] rounded-3xl p-6 shadow-2xl animate-scale-up ${className || ''}`}
        style={cleanSx(sx)}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
Dialog.displayName = 'Dialog';

export const DialogTitle = ({ children, className, ...props }: any) => (
  <h3 className={`text-xl font-bold font-clash text-stone-100 mb-4 ${className || ''}`} {...props}>
    {children}
  </h3>
);

export const DialogContent = ({ children, className, ...props }: any) => (
  <div className={`text-stone-300 text-sm overflow-y-auto max-h-[60vh] mb-6 ${className || ''}`} {...props}>
    {children}
  </div>
);

export const DialogActions = ({ children, className, ...props }: any) => (
  <div className={`flex items-center justify-end gap-3 ${className || ''}`} {...props}>
    {children}
  </div>
);

// 12. Drawer Component
export const Drawer = React.forwardRef(({ open, onClose, anchor = 'right', children, PaperProps, keepMounted, disablePortal, ModalProps, slotProps, sx, ...props }: any, ref) => {
  if (!open) return null;
  const isBottom = anchor === 'bottom';
  const justifyClass = anchor === 'left' ? 'justify-start' : anchor === 'bottom' ? 'items-end justify-center' : 'justify-end';
  const borderClass = anchor === 'left' ? 'border-r border-[#23211F]' : anchor === 'bottom' ? 'border-t border-[#23211F]' : 'border-l border-[#23211F]';
  const posClass = anchor === 'left' ? 'left-0' : anchor === 'bottom' ? 'bottom-0 left-0 right-0' : 'right-0';
  
  const drawerRootSx = sx || {};
  const nestedPaperSx = drawerRootSx?.['& .MuiDrawer-paper'] || {};
  const paperSx = { ...(PaperProps?.sx || {}), ...nestedPaperSx };
  const paperStyle = cleanSx(paperSx);
  
  return (
    <div className={`fixed inset-0 z-50 flex ${justifyClass} bg-black/70 backdrop-blur-sm`} style={cleanSx(drawerRootSx)}>
      <div className="fixed inset-0" onClick={onClose} />
      <div
        ref={ref}
        className={`relative z-10 ${isBottom ? 'w-full h-auto max-h-[86vh] rounded-t-[24px]' : 'w-80 h-full'} bg-[#161412] ${borderClass} shadow-2xl p-6 overflow-y-auto ${posClass}`}
        style={paperStyle}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
Drawer.displayName = 'Drawer';

// 13. CircularProgress Component
export const CircularProgress = ({ size = 24, className, ...props }: any) => (
  <div
    className={`animate-spin rounded-full border-2 border-stone-800 border-t-indigo-500 ${className || ''}`}
    style={{ width: size, height: size }}
    {...props}
  />
);

// 14. Avatar Component
export const Avatar = ({ src, alt, children, className, sx, ...props }: any) => {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-stone-800 border border-[#23211F] text-stone-200 font-bold overflow-hidden w-10 h-10 ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {src ? <img src={src} alt={alt} className="w-full h-full object-cover" /> : children || alt?.[0]?.toUpperCase()}
    </div>
  );
};

// 15. Divider Component
export const Divider = ({ className, sx, ...props }: any) => (
  <hr className={`border-t border-[#23211F] my-4 ${className || ''}`} style={cleanSx(sx)} {...props} />
);

// 16. Switch Component
export const Switch = ({ checked, onChange, disabled, ...props }: any) => (
  <button
    onClick={() => !disabled && onChange?.({ target: { checked: !checked } })}
    disabled={disabled}
    className={`w-11 h-6 rounded-full transition-all relative ${checked ? 'bg-[#6366F1]' : 'bg-[#23211F]'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    {...props}
  >
    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'translate-x-5' : ''}`} />
  </button>
);

// 17. Checkbox Component
export const Checkbox = ({ checked, onChange, disabled, ...props }: any) => (
  <button
    onClick={() => !disabled && onChange?.({ target: { checked: !checked } })}
    disabled={disabled}
    className={`w-5 h-5 rounded-md border border-[#23211F] bg-[#0A0908] flex items-center justify-center transition-all ${checked ? 'bg-[#6366F1] border-indigo-500' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    {...props}
  >
    {checked && <span className="w-2.5 h-2.5 bg-white rounded-sm" />}
  </button>
);

// 18. Tooltip Component
export const Tooltip = ({ title, children, ...props }: any) => (
  <div className="group relative inline-block">
    {children}
    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#141211] border border-[#23211F] px-2 py-1 text-xs text-stone-200 opacity-0 transition-opacity group-hover:opacity-100">
      {title}
    </span>
  </div>
);

// 19. Chip Component
export const Chip = ({ label, className, color, variant, ...props }: any) => {
  let variantClass = "bg-[#1E1B19] text-stone-300";
  if (color === 'primary') {
    variantClass = "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
  } else if (color === 'secondary') {
    variantClass = "bg-pink-500/20 text-pink-300 border border-pink-500/30";
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-mono ${variantClass} ${className || ''}`} {...props}>
      {label}
    </span>
  );
};

// 20. Badge Component
export const Badge = ({ children, badgeContent, color, ...props }: any) => (
  <div className="relative inline-block">
    {children}
    {badgeContent !== undefined && badgeContent !== null && (
      <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border border-[#141211]">
        {badgeContent}
      </span>
    )}
  </div>
);

// 21. Alert Component
export const Alert = ({ children, severity = 'info', className, ...props }: any) => {
  let bg = "bg-blue-950/40 text-blue-300 border-blue-900/50";
  if (severity === 'error') bg = "bg-red-950/40 text-red-300 border-red-900/50";
  if (severity === 'warning') bg = "bg-amber-950/40 text-amber-300 border-amber-900/50";
  if (severity === 'success') bg = "bg-emerald-950/40 text-emerald-300 border-emerald-900/50";
  return (
    <div className={`p-4 rounded-2xl border text-sm flex gap-3 ${bg} ${className || ''}`} {...props}>
      {children}
    </div>
  );
};

// 22. Menu, MenuItem, Select, FormControl, InputLabel, Radio, RadioGroup, Slider, Collapse, Snackbar
export const Menu = React.forwardRef(({ open, anchorEl, onClose, children, sx, className, ...props }: any, ref) => {
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (open && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
  }, [open, anchorEl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={ref}
        className={`absolute min-w-[12rem] bg-[#141211] border border-[#23211F] rounded-2xl shadow-xl p-2 animate-fade-in ${className || ''}`}
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          ...cleanSx(sx),
        }}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
Menu.displayName = 'Menu';

export const MenuItem = React.forwardRef(({ children, onClick, className, sx, ...props }: any, ref) => (
  <div
    ref={ref}
    onClick={onClick}
    className={`px-4 py-2 text-sm text-stone-300 hover:bg-[#1E1B19] hover:text-stone-100 rounded-xl cursor-pointer transition-colors ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </div>
));
MenuItem.displayName = 'MenuItem';

export const Select = React.forwardRef(({ value, onChange, children, className, sx, ...props }: any, ref) => {
  return (
    <select
      ref={ref}
      value={value}
      onChange={onChange}
      className={`bg-[#0A0908] border border-[#23211F] text-stone-200 rounded-xl px-4 py-2.5 text-sm font-space-grotesk outline-none focus:border-indigo-500 transition-all ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export const FormControl = React.forwardRef(({ children, className, fullWidth, sx, ...props }: any, ref) => (
  <div
    ref={ref}
    className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''} ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </div>
));
FormControl.displayName = 'FormControl';

export const InputLabel = React.forwardRef(({ children, className, sx, ...props }: any, ref) => (
  <label
    ref={ref}
    className={`text-xs font-bold text-stone-400 tracking-wide uppercase font-clash ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </label>
));
InputLabel.displayName = 'InputLabel';

export const Radio = React.forwardRef(({ checked, onChange, disabled, className, sx, ...props }: any, ref) => (
  <button
    ref={ref}
    onClick={() => !disabled && onChange?.({ target: { checked: !checked } })}
    disabled={disabled}
    className={`w-5 h-5 rounded-full border border-[#23211F] bg-[#0A0908] flex items-center justify-center transition-all ${checked ? 'border-indigo-500' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {checked && <span className="w-2.5 h-2.5 bg-[#6366F1] rounded-full" />}
  </button>
));
Radio.displayName = 'Radio';

export const RadioGroup = React.forwardRef(({ children, value, onChange, className, sx, ...props }: any, ref) => (
  <div
    ref={ref}
    className={`flex flex-col gap-2 ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </div>
));
RadioGroup.displayName = 'RadioGroup';

export const Slider = React.forwardRef(({ value, onChange, min = 0, max = 100, className, sx, ...props }: any, ref) => {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div
      ref={ref}
      className={`relative w-full h-2 bg-[#23211F] rounded-full ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      <div className="absolute top-0 left-0 h-full bg-[#6366F1] rounded-full" style={{ width: `${percent}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
});
Slider.displayName = 'Slider';

export const Collapse = React.forwardRef(({ in: isOpen, children, className, sx, ...props }: any, ref) => {
  if (!isOpen) return null;
  return (
    <div
      ref={ref}
      className={className}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </div>
  );
});
Collapse.displayName = 'Collapse';

export const Snackbar = React.forwardRef(({ open, message, autoHideDuration, onClose, className, sx, ...props }: any, ref) => {
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`fixed bottom-6 right-6 z-50 bg-[#141211] border border-[#23211F] text-stone-200 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      <span className="text-sm font-satoshi">{message}</span>
      <button onClick={onClose} className="text-stone-500 hover:text-stone-300 font-bold">×</button>
    </div>
  );
});
Snackbar.displayName = 'Snackbar';

export const Abc = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AccessTime = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Accordion = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AccordionDetails = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AccordionSummary = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AddCircleOutline = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AlertTitle = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AlternateEmail = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Apps = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Archive = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ArrowBackIosNew = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ArrowForwardIos = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Assignment = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AutoAwesome = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AutoFixHigh = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Autocomplete = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AvatarGroup = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Backdrop = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Block = ({ children, ...props }: any) => React.createElement('div', props, children);
export const BottomNavigation = React.forwardRef(({ children, value, onChange, className, sx, showLabels, ...props }: any, ref) => {
  return (
    <div
      ref={ref}
      className={`flex w-full items-center justify-around h-16 ${className || ''}`}
      style={{
        background: OPENBRICKS_TOKENS.surface,
        borderTop: `1px solid ${OPENBRICKS_TOKENS.borderSoft}`,
        ...cleanSx(sx),
      }}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        const childValue = (child.props as any).value ?? (child.props as any).id;
        const selected = childValue === value;
        return React.cloneElement(child, {
          selected,
          onClick: (e: any) => {
            if (onChange) onChange(e, childValue);
            if ((child.props as any).onClick) (child.props as any).onClick(e);
          },
        } as any);
      })}
    </div>
  );
});
BottomNavigation.displayName = 'BottomNavigation';

export const BottomNavigationAction = React.forwardRef(({ label, icon, selected, className, sx, ...props }: any, ref) => {
  return (
    <button
      ref={ref}
      className={`flex flex-col items-center justify-center flex-1 py-1 px-3 text-xs font-medium transition-all duration-300 ${
        selected ? 'scale-110' : 'hover:text-stone-200'
      } ${className || ''}`}
      style={{
        color: selected ? OPENBRICKS_TOKENS.connectAccent : OPENBRICKS_TOKENS.textMuted,
        ...cleanSx(sx),
      }}
      {...props}
    >
      {icon && <span className={`mb-1 transition-transform duration-300 ${selected ? 'scale-110' : ''}`}>{icon}</span>}
      {label && <span>{label}</span>}
    </button>
  );
});
BottomNavigationAction.displayName = 'BottomNavigationAction';
export const Breadcrumbs = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Brush = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ButtonBase = React.forwardRef(({ children, className, sx, component, ...props }: any, ref) => {
  const Component = component || 'button';
  return (
    <Component
      ref={ref}
      className={`${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </Component>
  );
});
ButtonBase.displayName = 'ButtonBase';
export const CalendarMonth = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Campaign = ({ children, ...props }: any) => React.createElement('div', props, children);
export const CardHeader = React.forwardRef(({ avatar, action, title, subheader, children, className, sx, ...props }: any, ref) => (
  <div
    ref={ref}
    className={`flex items-start gap-3 ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {avatar ? <div className="shrink-0">{avatar}</div> : null}
    <div className="min-w-0 flex-1">
      {title != null && title !== false
        ? (React.isValidElement(title) ? title : <div className="text-sm font-semibold text-stone-100">{title}</div>)
        : null}
      {subheader != null && subheader !== false
        ? (React.isValidElement(subheader) ? subheader : <div className="text-xs text-stone-400">{subheader}</div>)
        : null}
      {children}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
));
CardHeader.displayName = 'CardHeader';
export const CardMedia = React.forwardRef(({ component, image, src, alt, className, sx, children, ...props }: any, ref) => {
  const Component = component || 'img';
  if (Component === 'img' || image || src) {
    return (
      <img
        ref={ref as any}
        src={image || src}
        alt={alt || ''}
        className={`w-full h-auto object-cover ${className || ''}`}
        style={cleanSx(sx)}
        {...props}
      />
    );
  }
  return (
    <Component
      ref={ref}
      className={className}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </Component>
  );
});
CardMedia.displayName = 'CardMedia';
export const ChatBubbleOutline = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Circle = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Construction = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Container = React.forwardRef(({ children, className, sx, maxWidth = 'lg', fixed, disableGutters, ...props }: any, ref) => {
  let maxWClass = "max-w-7xl";
  if (maxWidth === 'xs') maxWClass = "max-w-xs";
  if (maxWidth === 'sm') maxWClass = "max-w-sm";
  if (maxWidth === 'md') maxWClass = "max-w-md";
  if (maxWidth === 'lg') maxWClass = "max-w-5xl";
  if (maxWidth === 'xl') maxWClass = "max-w-7xl";
  
  const paddingClass = disableGutters ? "" : "px-4 sm:px-6 lg:px-8";
  
  return (
    <div
      ref={ref}
      className={`mx-auto w-full ${maxWClass} ${paddingClass} ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </div>
  );
});
Container.displayName = 'Container';
export const ContentPaste = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Dashboard = ({ children, ...props }: any) => React.createElement('div', props, children);
export const DataObject = ({ children, ...props }: any) => React.createElement('div', props, children);
export const DeleteOutline = ({ children, ...props }: any) => React.createElement('div', props, children);
export const DragHandle = ({ children, ...props }: any) => React.createElement('div', props, children);
export const EmojiEmotionsOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ErrorOutline = ({ children, ...props }: any) => React.createElement('div', props, children);
export const EventBusy = ({ children, ...props }: any) => React.createElement('div', props, children);
export const EventNote = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ExpandLess = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ExpandMore = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Extension = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Fab = React.forwardRef(({ children, className, sx, color, ...props }: any, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center rounded-full p-3 shadow-xl transition-all active:scale-95 ${className || ''}`}
    style={{
      background: color === 'primary' ? OPENBRICKS_TOKENS.connectAccent : OPENBRICKS_TOKENS.surfaceAlt,
      color: color === 'primary' ? '#111' : OPENBRICKS_TOKENS.text,
      border: `1px solid ${OPENBRICKS_TOKENS.border}`,
      ...cleanSx(sx),
    }}
    {...props}
  >
    {children}
  </button>
));
Fab.displayName = 'Fab';
export const Fade = ({ children, ...props }: any) => React.createElement('div', props, children);
export const FiberPin = ({ children, ...props }: any) => React.createElement('div', props, children);
export const FingerprintOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Flag = ({ children, ...props }: any) => React.createElement('div', props, children);
export const FlagOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const FolderOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const FolderSpecial = ({ children, ...props }: any) => React.createElement('div', props, children);
export const FormGroup = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Fullscreen = ({ children, ...props }: any) => React.createElement('div', props, children);
export const FullscreenExit = ({ children, ...props }: any) => React.createElement('div', props, children);
export const InfoOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const InputBase = React.forwardRef(({ className, sx, inputRef, endAdornment, startAdornment, ...props }: any, ref) => {
  const { root, nested } = splitSx(sx);
  const placeholderStyle = nested['& input::placeholder'] || {};
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${className || ''}`} style={root}>
      {startAdornment}
      <input
        ref={inputRef || ref}
        className="min-w-0 flex-1 bg-transparent text-sm text-stone-100 outline-none placeholder:text-stone-500"
        style={{
          ...(placeholderStyle.color ? { ['--kylrix-placeholder-color' as any]: placeholderStyle.color } : {}),
          ...(placeholderStyle.opacity !== undefined ? { ['--kylrix-placeholder-opacity' as any]: placeholderStyle.opacity } : {}),
        }}
        {...props}
      />
      {endAdornment}
      <style jsx>{`
        input::placeholder {
          color: var(--kylrix-placeholder-color, rgba(255,255,255,0.5));
          opacity: var(--kylrix-placeholder-opacity, 1);
        }
      `}</style>
    </div>
  );
});
InputBase.displayName = 'InputBase';
export const Insights = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Keyboard = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Label = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Launch = ({ children, ...props }: any) => React.createElement('div', props, children);
export const LibraryAdd = ({ children, ...props }: any) => React.createElement('div', props, children);
export const LightbulbOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Link = ({ children, ...props }: any) => React.createElement('div', props, children);
export const LinkOff = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ListItemIcon = React.forwardRef(({ children, className, sx, ...props }: any, ref) => (
  <div
    ref={ref}
    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </div>
));
ListItemIcon.displayName = 'ListItemIcon';
export const LocalOffer = ({ children, ...props }: any) => React.createElement('div', props, children);
export const LocalOfferOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const LocationOn = ({ children, ...props }: any) => React.createElement('div', props, children);
export const LockOpen = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Login = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Logout = ({ children, ...props }: any) => React.createElement('div', props, children);
export const MarkEmailRead = ({ children, ...props }: any) => React.createElement('div', props, children);
export const MarkEmailUnread = ({ children, ...props }: any) => React.createElement('div', props, children);
export const NoteAdd = ({ children, ...props }: any) => React.createElement('div', props, children);
export const NoteOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Notes = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Numbers = ({ children, ...props }: any) => React.createElement('div', props, children);
export const OpenInFull = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Pagination = React.forwardRef(
  (
    {
      count,
      page,
      onChange,
      size,
      renderItem,
      className,
      sx,
      ...props
    }: any,
    ref
  ) => {
    const safeCount = Number(count ?? 0);
    const safePage = Number(page ?? 1);
    if (!safeCount || safeCount <= 1) return null;

    const makeItem = (item: any) => {
      const handleClick = () => {
        if (item?.disabled) return;
        onChange?.(undefined as any, item.page);
      };
      return { ...item, onClick: handleClick };
    };

    const items: any[] = [];
    items.push(
      makeItem({
        type: 'previous',
        page: Math.max(1, safePage - 1),
        selected: false,
        disabled: safePage <= 1,
      })
    );
    for (let i = 1; i <= safeCount; i++) {
      items.push(makeItem({ type: 'page', page: i, selected: i === safePage, disabled: false }));
    }
    items.push(
      makeItem({
        type: 'next',
        page: Math.min(safeCount, safePage + 1),
        selected: false,
        disabled: safePage >= safeCount,
      })
    );

    return (
      <div
        ref={ref}
        className={`flex items-center gap-2 ${className || ''}`}
        style={cleanSx(sx)}
        {...props}
      >
        {items.map((item, idx) => (
          <React.Fragment key={`${item.type}-${item.page}-${idx}`}>
            {renderItem ? renderItem(item) : <PaginationItem {...item} />}
          </React.Fragment>
        ))}
      </div>
    );
  }
);
Pagination.displayName = 'Pagination';

export const PaginationItem = React.forwardRef(
  (
    {
      type,
      page,
      selected,
      disabled,
      onClick,
      slots,
      sx,
      className,
      ...props
    }: any,
    ref
  ) => {
    const content =
      type === 'previous'
        ? slots?.previous
        : type === 'next'
          ? slots?.next
          : page;

    const renderedContent =
      typeof content === 'number'
        ? <span>{content}</span>
        : React.isValidElement(content)
          ? content
          : isRenderableComponentType(content)
            ? React.createElement(content as any)
            : null;

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={className || ''}
        style={cleanSx(sx)}
        {...props}
      >
        {renderedContent}
      </button>
    );
  }
);
PaginationItem.displayName = 'PaginationItem';
export const PhotoCamera = ({ children, ...props }: any) => React.createElement('div', props, children);
export const PictureInPictureAlt = ({ children, ...props }: any) => React.createElement('div', props, children);
export const PlaylistAdd = ({ children, ...props }: any) => React.createElement('div', props, children);
export const PlaylistAddCheck = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Popover = React.forwardRef(({ open, anchorEl, onClose, children, sx, className, ...props }: any, ref) => {
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (open && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
  }, [open, anchorEl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={ref}
        className={`absolute bg-[#141211] border border-[#23211F] rounded-2xl shadow-xl p-4 animate-fade-in ${className || ''}`}
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          ...cleanSx(sx),
        }}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
Popover.displayName = 'Popover';
export const Preview = ({ children, ...props }: any) => React.createElement('div', props, children);
export const PushPin = ({ children, ...props }: any) => React.createElement('div', props, children);
export const PushPinOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const RadioButtonChecked = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Reply = ({ children, ...props }: any) => React.createElement('div', props, children);
export const RotateLeft = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Save = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ShieldOutlined = ({ children, ...props }: any) => React.createElement('div', props, children);
export const SpeedDial = React.forwardRef(
  (
    {
      ariaLabel,
      open,
      onOpen,
      onClose,
      icon,
      children,
      direction,
      sx,
      className,
      ...props
    }: any,
    ref
  ) => {
    const handleToggle = () => {
      if (open) onClose?.();
      else onOpen?.();
    };

    const renderedIcon =
      React.isValidElement(icon) ? React.cloneElement(icon as any, { open }) : icon;

    const { root: rootSx, nested } = splitSx(sx);
    const fabSx = cleanSx(nested['& .MuiFab-primary']);

    return (
      <div
        ref={ref}
        className={className || ''}
        style={rootSx}
        {...props}
      >
        <button
          type="button"
          className="MuiFab-primary"
          onClick={handleToggle}
          aria-label={ariaLabel}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 20,
            border: `1px solid ${OPENBRICKS_TOKENS.borderSoft}`,
            background: OPENBRICKS_TOKENS.shell,
            color: OPENBRICKS_TOKENS.text,
            cursor: 'pointer',
            ...fabSx,
          }}
        >
          {renderedIcon}
        </button>

        {open ? (
          <div
            className="MuiSpeedDial-actions"
            style={{
              display: 'flex',
              flexDirection: direction === 'up' ? 'column-reverse' : 'column',
              gap: 10,
              alignItems: 'flex-end',
              marginTop: 10,
            }}
          >
            {React.Children.map(children, (child) => {
              if (!React.isValidElement(child)) return child;
              return React.cloneElement(child as any, { open, __muiSx: sx });
            })}
          </div>
        ) : null}
      </div>
    );
  }
);
SpeedDial.displayName = 'SpeedDial';

export const SpeedDialIcon = React.forwardRef(({ icon, openIcon, open }: any, ref) => {
  return (
    <span ref={ref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {open ? openIcon : icon}
    </span>
  );
});
SpeedDialIcon.displayName = 'SpeedDialIcon';

export const SpeedDialAction = React.forwardRef(
  (
    {
      icon,
      tooltipTitle,
      tooltipOpen,
      onClick,
      open,
      disabled,
      className,
      sx,
      __muiSx,
      ...props
    }: any,
    ref
  ) => {
    const { root: rootSx, nested } = splitSx(__muiSx || sx);
    const actionFabSx = cleanSx(nested['& .MuiSpeedDialAction-fab']);
    const tooltipLabelSx = cleanSx(nested['& .MuiSpeedDialAction-staticTooltipLabel']);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {tooltipOpen && open && tooltipTitle ? (
          <span
            className="MuiSpeedDialAction-staticTooltipLabel"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 24,
              padding: '6px 12px',
              borderRadius: 10,
              background: 'rgba(0,0,0,0.92)',
              border: `1px solid ${OPENBRICKS_TOKENS.borderSoft}`,
              color: OPENBRICKS_TOKENS.text,
              fontWeight: 900,
              fontSize: '0.72rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              ...tooltipLabelSx,
            }}
          >
            {tooltipTitle}
          </span>
        ) : null}
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={`MuiSpeedDialAction-fab ${className || ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 16,
            border: `1px solid ${OPENBRICKS_TOKENS.borderSoft}`,
            background: OPENBRICKS_TOKENS.shell,
            color: OPENBRICKS_TOKENS.textMuted,
            cursor: disabled ? 'not-allowed' : 'pointer',
            ...rootSx,
            ...actionFabSx,
          }}
          aria-label={tooltipTitle || 'Speed dial action'}
          {...props}
        >
          {icon}
        </button>
      </div>
    );
  }
);
SpeedDialAction.displayName = 'SpeedDialAction';
export const Spellcheck = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Stop = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Summarize = ({ children, ...props }: any) => React.createElement('div', props, children);
export const SwapVert = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Sync = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Table = ({ children, ...props }: any) => React.createElement('div', props, children);
export const TableBody = ({ children, ...props }: any) => React.createElement('div', props, children);
export const TableCell = ({ children, ...props }: any) => React.createElement('div', props, children);
export const TableContainer = ({ children, ...props }: any) => React.createElement('div', props, children);
export const TableHead = ({ children, ...props }: any) => React.createElement('div', props, children);
export const TablePagination = ({ children, ...props }: any) => React.createElement('div', props, children);
export const TableRow = ({ children, ...props }: any) => React.createElement('div', props, children);
export const TableRows = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Tag = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Today = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ToggleButton = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ToggleButtonGroup = ({ children, ...props }: any) => React.createElement('div', props, children);
export const ToggleOn = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Undo = ({ children, ...props }: any) => React.createElement('div', props, children);
export const UploadFile = ({ children, ...props }: any) => React.createElement('div', props, children);
export const VerifiedUser = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Zoom = ({ children, ...props }: any) => React.createElement('div', props, children);
export const keyframes = (...args: any[]) => String(args[0] ?? '');
export default {};
