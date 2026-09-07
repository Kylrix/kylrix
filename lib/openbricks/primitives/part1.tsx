import React from 'react';
import { alpha, useTheme, useMediaQuery } from './core';
import { cleanSx, splitSx, normalizeStyleValue, pickResponsiveValue, resolvePaletteToken, isRenderableComponentType } from './core';

export const Box = React.forwardRef(({ children, sx, className, component: Component = 'div', display, alignItems, justifyContent, flexWrap, flexDirection, gap, ...props }: any, ref) => {
  const inlineStyle = {
    ...(display !== undefined ? { display } : {}),
    ...(alignItems !== undefined ? { alignItems } : {}),
    ...(justifyContent !== undefined ? { justifyContent } : {}),
    ...(flexWrap !== undefined ? { flexWrap } : {}),
    ...(flexDirection !== undefined ? { flexDirection } : {}),
    ...(gap !== undefined ? { gap: normalizeStyleValue('gap', gap) } : {}),
    ...cleanSx(sx)};
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
export const Button = React.forwardRef(({ children, className, sx, variant = 'text', color = 'primary', disabled, startIcon, endIcon, fullWidth, disableElevation, disableRipple, disableFocusRipple, disableTouchRipple, component, ...props }: any, ref) => {
  let baseClass = "inline-flex items-center justify-center font-bold font-clash rounded-xl px-5 py-2.5 transition-all duration-300 border border-[#23211F] text-sm active:scale-95";
  if (disabled) {
    baseClass += " ob-disabled opacity-50 cursor-not-allowed bg-stone-900 text-stone-500 border-stone-800";
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

// 3. IconButton Component — MUI default is thread/transparent (no border box)
export const IconButton = React.forwardRef(({ children, className, sx, disabled, size, color, edge, ...props }: any, ref) => {
  const [hovered, setHovered] = React.useState(false);
  const { root, nested } = splitSx(sx);
  const hoverBlock = nested['&:hover'] || {};
  const hoverResolved = hovered ? cleanSx(hoverBlock) : {};
  const rootResolved = cleanSx(root);

  const hasExplicitChrome = Boolean(
    rootResolved?.border ||
    rootResolved?.borderColor ||
    rootResolved?.backgroundColor ||
    rootResolved?.bgcolor
  );

  const sizeMap: Record<string, number> = { small: 34, medium: 40, large: 48 };
  const pixelSize = typeof size === 'string' ? (sizeMap[size] || 40) : 40;

  const baseClass = hasExplicitChrome
    ? 'inline-flex items-center justify-center rounded-xl border border-[#23211F] bg-[#0A0908] text-stone-400 hover:text-stone-200 hover:bg-[#141211] active:scale-95 transition-all'
    : 'inline-flex items-center justify-center rounded-lg border-0 bg-transparent text-inherit active:scale-95 transition-colors duration-200';

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`${baseClass} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className || ''}`}
      style={{
        width: rootResolved?.width ?? pixelSize,
        height: rootResolved?.height ?? pixelSize,
        minWidth: rootResolved?.minWidth ?? pixelSize,
        minHeight: rootResolved?.minHeight ?? pixelSize,
        padding: rootResolved?.padding ?? rootResolved?.p ?? 4,
        ...rootResolved,
        ...hoverResolved}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {children}
    </button>
  );
});
IconButton.displayName = 'IconButton';

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
        ...cleanSx(sx)}}
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

export const Tabs = React.forwardRef(({
  children,
  className,
  sx,
  value,
  onChange,
  variant,
  scrollButtons,
  allowScrollButtonsMobile,
  indicatorColor,
  textColor,
  orientation,
  visibleScrollbar,
  centered,
  ...props
}: any, ref) => {
  const { root, nested } = splitSx(sx);
  const tabRootSx = cleanSx(nested['& .ob-tab'] || nested['& .ob-tab'] || {});
  const tabSelectedSx = cleanSx((nested['& .ob-tab'] || nested['& .ob-tab'] || {})['&.ob-selected'] || (nested['& .ob-tab'] || nested['& .ob-tab'] || {})['&.ob-selected'] || {});
  const tabHoverSx = cleanSx((nested['& .ob-tab'] || nested['& .ob-tab'] || {})['&:hover:not(.ob-selected)'] || (nested['& .ob-tab'] || nested['& .ob-tab'] || {})['&:hover:not(.ob-selected)'] || {});
  
  const isScrollable = variant === 'scrollable';
  const scrollableClass = isScrollable ? 'overflow-x-auto flex-nowrap' : 'flex-wrap';
  
  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 ${scrollableClass} ${className || ''}`}
      style={{
        ...root,
        width: '100%',
        ...(isScrollable ? {
          maxWidth: '100%',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'} : {})}}
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
          }});
      })}
    </div>
  );
});
Tabs.displayName = 'Tabs';

export const Tab = React.forwardRef(({
  label,
  children,
  className,
  sx,
  icon,
  iconPosition = 'start',
  selected,
  fullWidth,
  __tabRootSx,
  __tabSelectedSx,
  __tabHoverSx,
  value,
  textColor,
  ...props
}: any, ref) => (
  <button
    ref={ref}
    className={`ob-tab rounded-xl px-4 py-2 text-sm font-medium flex-shrink-0 whitespace-nowrap ${selected ? 'ob-selected text-white bg-[#1E1B19]' : 'text-stone-300 hover:bg-[#1E1B19]'} ${fullWidth ? 'flex-1 min-w-0' : ''} ${className || ''}`}
    style={{
      ...__tabRootSx,
      ...(selected ? __tabSelectedSx : __tabHoverSx),
      ...cleanSx(sx)}}
    {...props}
  >
    {icon ? (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          flexDirection: iconPosition === 'end' ? 'row-reverse' : 'row'}}
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

export const FormControlLabel = ({ control, label, labelPlacement = 'end', className, sx, ...props }: any) => {
  const isStart = labelPlacement === 'start';
  return (
    <label className={`inline-flex items-center gap-2 ${className || ''}`} style={cleanSx(sx)} {...props}>
      {isStart ? (
        <>
          <span>{label}</span>
          {control}
        </>
      ) : (
        <>
          {control}
          <span>{label}</span>
        </>
      )}
    </label>
  );
};

export const InputAdornment = ({ children, className, ...props }: any) => (
  <span className={`inline-flex items-center text-stone-500 ${className || ''}`} {...props}>{children}</span>
);

export const List = ({ children, className, ...props }: any) => (
  <div className={`flex flex-col ${className || ''}`} {...props}>{children}</div>
);

export const ListItem = ({
  children,
  className,
  alignItems,
  dense,
  disableGutters,
  disablePadding,
  divider,
  secondaryAction,
  ...props
}: any) => (
  <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${className || ''}`} {...props}>{children}</div>
);

export const ListItemAvatar = ({ children, className, ...props }: any) => (
  <div className={`shrink-0 ${className || ''}`} {...props}>{children}</div>
);

export const ListItemButton = ({
  children,
  className,
  selected,
  dense,
  disableGutters,
  divider,
  alignItems,
  autoFocus,
  ...props
}: any) => (
  <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#1E1B19] ${className || ''}`} {...props}>{children}</button>
);

export const ListItemText = ({
  primary,
  secondary,
  children,
  className,
  slotProps,
  sx,
  disableTypography,
  inset,
  ...props
}: any) => {
  const primarySx = cleanSx(slotProps?.primary?.sx || sx || {});
  return (
    <div className={`flex min-w-0 flex-1 flex-col ${className || ''}`} {...props}>
      {children ?? (
        <>
          <span className="truncate" style={{ color: 'inherit', ...primarySx }}>{primary}</span>
          {secondary ? <span className="truncate text-xs text-stone-500">{secondary}</span> : null}
        </>
      )}
    </div>
  );
};

// 6. Paper Component
export const Paper = React.forwardRef(({ children, className, sx, component: Component = 'div', ...props }: any, ref) => {
  const hasPaddingInSx = sx && typeof sx === 'object' && (
    'p' in sx || 'padding' in sx || 'px' in sx || 'py' in sx || 'pt' in sx || 'pb' in sx || 'pl' in sx || 'pr' in sx
  );
  const childrenArray = React.Children.toArray(children);
  const hasLayoutComponents = childrenArray.some((child: any) =>
    child && child.type && (
      child.type.displayName === 'Table' ||
      child.type.displayName === 'TableContainer' ||
      child.type.displayName === 'List' ||
      child.type.name === 'Table' ||
      child.type.name === 'TableContainer' ||
      child.type.name === 'List'
    )
  );
  return (
    <Component
      ref={ref}
      className={`rounded-2xl bg-[#0A0908] border border-[#23211F] ${(hasPaddingInSx || hasLayoutComponents) ? '' : 'p-4'} ${className || ''}`}
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
        ...cleanSx(sx)}}
      {...props}
    >
      {children}
    </Component>
  );
});
Typography.displayName = 'Typography';

const COL_SPANS: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12'};

const SM_COL_SPANS: Record<number, string> = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  5: 'sm:col-span-5',
  6: 'sm:col-span-6',
  7: 'sm:col-span-7',
  8: 'sm:col-span-8',
  9: 'sm:col-span-9',
  10: 'sm:col-span-10',
  11: 'sm:col-span-11',
  12: 'sm:col-span-12'};

const MD_COL_SPANS: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12'};

const LG_COL_SPANS: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12'};

const XL_COL_SPANS: Record<number, string> = {
  1: 'xl:col-span-1',
  2: 'xl:col-span-2',
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  11: 'xl:col-span-11',
  12: 'xl:col-span-12'};

// 8. Grid Component
export const Grid = React.forwardRef(({ children, container, item, size, xs, sm, md, lg, xl, spacing, className, sx, component: Component = 'div', ...props }: any, ref) => {
  let classes = className || '';
  const style: any = { ...cleanSx(sx) };
  if (container) {
    classes += ' grid grid-cols-12';
    style.gap = normalizeStyleValue('gap', spacing ?? 2);
  }
  
  const computedSize = typeof size === 'object' ? size : undefined;
  if (item || computedSize || xs || sm || md || lg || xl) {
    const xsVal = computedSize?.xs ?? xs;
    const smVal = computedSize?.sm ?? sm;
    const mdVal = computedSize?.md ?? md;
    const lgVal = computedSize?.lg ?? lg;
    const xlVal = computedSize?.xl ?? xl;

    let colClasses = [];
    
    // Default fallback if no size is specified
    if (xsVal === undefined && smVal === undefined && mdVal === undefined && lgVal === undefined && xlVal === undefined) {
      colClasses.push('col-span-12');
    }

    if (xsVal !== undefined) {
      if (xsVal === true) colClasses.push('col-span-12');
      else if (xsVal === 'auto') colClasses.push('col-auto');
      else {
        const rounded = Math.round(Number(xsVal));
        if (COL_SPANS[rounded]) colClasses.push(COL_SPANS[rounded]);
      }
    }
    
    if (smVal !== undefined) {
      if (smVal === true) colClasses.push('sm:col-span-12');
      else if (smVal === 'auto') colClasses.push('sm:col-auto');
      else {
        const rounded = Math.round(Number(smVal));
        if (SM_COL_SPANS[rounded]) colClasses.push(SM_COL_SPANS[rounded]);
      }
    }

    if (mdVal !== undefined) {
      if (mdVal === true) colClasses.push('md:col-span-12');
      else if (mdVal === 'auto') colClasses.push('md:col-auto');
      else {
        const rounded = Math.round(Number(mdVal));
        if (MD_COL_SPANS[rounded]) colClasses.push(MD_COL_SPANS[rounded]);
      }
    }

    if (lgVal !== undefined) {
      if (lgVal === true) colClasses.push('lg:col-span-12');
      else if (lgVal === 'auto') colClasses.push('lg:col-auto');
      else {
        const rounded = Math.round(Number(lgVal));
        if (LG_COL_SPANS[rounded]) colClasses.push(LG_COL_SPANS[rounded]);
      }
    }

    if (xlVal !== undefined) {
      if (xlVal === true) colClasses.push('xl:col-span-12');
      else if (xlVal === 'auto') colClasses.push('xl:col-auto');
      else {
        const rounded = Math.round(Number(xlVal));
        if (XL_COL_SPANS[rounded]) colClasses.push(XL_COL_SPANS[rounded]);
      }
    }

    classes += ' ' + colClasses.filter(Boolean).join(' ');
  }
  
  return (
    <Component ref={ref} className={classes} style={style} {...props}>
      {children}
    </Component>
  );
});
Grid.displayName = 'Grid';

// 9. Stack Component
export const Stack = React.forwardRef(({ children, direction = 'column', spacing = 2, className, sx, alignItems, justifyContent, flexWrap, useFlexGap, divider, component: Component = 'div', textAlign, ...props }: any, ref) => {
  const flexDirection = direction === 'row' ? 'row' : 'column';
  return (
    <Component
      ref={ref}
      className={`flex ${className || ''}`}
      style={{
        flexDirection,
        gap: normalizeStyleValue('gap', spacing),
        ...(alignItems !== undefined ? { alignItems } : {}),
        ...(justifyContent !== undefined ? { justifyContent } : {}),
        ...(flexWrap !== undefined ? { flexWrap } : {}),
        ...(textAlign !== undefined ? { textAlign } : {}),
        ...cleanSx(sx)}}
      {...props}
    >
      {children}
    </Component>
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
  const readOnly = InputProps?.readOnly ?? props.readOnly;
  const startAdornment = InputProps?.startAdornment;
  const endAdornment = InputProps?.endAdornment;
  
  const inputStyle = cleanSx(InputProps?.sx);
  const inputClass = `w-full bg-transparent text-stone-200 text-sm font-space-grotesk outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${readOnly ? 'cursor-default' : ''}`;
  
  const containerClass = `flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''} ${className || ''}`;
  const wrapperClass = `flex items-center gap-2 bg-[#0A0908] border ${error ? 'border-red-500' : 'border-[#23211F]'} rounded-xl px-4 py-2.5 transition-all focus-within:border-indigo-500`;

  const inputProps = { ...props };
  delete inputProps.readOnly;

  return (
    <div className={containerClass} style={cleanSx(sx)}>
      {label && (
        <label className="text-xs font-bold text-stone-400 tracking-wide uppercase font-clash">
          {label}
        </label>
      )}
      <div className={wrapperClass}>
        {startAdornment}
        {multiline ? (
          <textarea
            ref={inputRef || ref}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            disabled={disabled}
            placeholder={placeholder}
            rows={rows ?? minRows ?? 3}
            className={inputClass}
            style={inputStyle}
            {...inputProps}
          />
        ) : (
          <input
            ref={inputRef || ref}
            type={type}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            disabled={disabled}
            placeholder={placeholder}
            className={inputClass}
            style={inputStyle}
            autoComplete="off"
            {...inputProps}
          />
        )}
        {endAdornment}
      </div>
      {helperText && (
        <span className={`text-xs ${error ? 'text-red-500' : 'text-stone-500'} font-mono`}>
          {helperText}
        </span>
      )}
    </div>
  );
});
TextField.displayName = 'TextField';

type _TextFieldProps = {
  label?: React.ReactNode;
  placeholder?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  type?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: React.ReactNode;
  className?: string;
  sx?: Record<string, unknown>;
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
  InputProps?: Record<string, unknown>;
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  variant?: string;
  readOnly?: boolean;
  [key: string]: unknown;
};

type _InputLabelProps = {
  children?: React.ReactNode;
  className?: string;
  sx?: Record<string, unknown>;
  htmlFor?: string;
  [key: string]: unknown;
};

// 11. Dialog Component
