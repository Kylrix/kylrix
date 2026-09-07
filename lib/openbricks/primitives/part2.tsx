import React from 'react';
import { alpha, useTheme, useMediaQuery } from './core';
import { cleanSx, splitSx, normalizeStyleValue, pickResponsiveValue, resolvePaletteToken, isRenderableComponentType } from './core';

export const Dialog = React.forwardRef(({
  open,
  onClose,
  children,
  maxWidth = 'sm',
  fullWidth,
  sx,
  className,
  scroll,
  TransitionComponent,
  transitionDuration,
  TransitionProps,
  keepMounted,
  ...props
}: any, ref) => {
  if (!open) return null;
  
  let maxWClass = "max-w-md";
  if (maxWidth === 'xs') maxWClass = "max-w-xs";
  if (maxWidth === 'sm') maxWClass = "max-w-sm";
  if (maxWidth === 'md') maxWClass = "max-w-md";
  if (maxWidth === 'lg') maxWClass = "max-w-lg";
  if (maxWidth === 'xl') maxWClass = "max-w-xl";
  
  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
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
  const isLeft = anchor === 'left';
  const borderClass = isLeft ? 'border-r border-[#23211F]' : isBottom ? 'border-t border-[#23211F]' : 'border-l border-[#23211F]';
  const panelPositionClass = isLeft
    ? 'left-0 top-0 bottom-0 h-full w-80 max-w-[90vw]'
    : isBottom
      ? 'left-0 right-0 bottom-0 w-full max-h-[86vh] rounded-t-[24px]'
      : 'right-0 top-0 bottom-0 h-full w-80 max-w-[90vw]';

  const drawerRootSx = sx || {};
  const nestedPaperSx = drawerRootSx?.['& .ob-drawer-panel'] || {};
  const paperSx = { ...(PaperProps?.sx || {}), ...nestedPaperSx };
  const paperStyle = cleanSx(paperSx);
  const backdropStyle = cleanSx(
    slotProps?.backdrop?.sx ||
    ModalProps?.slotProps?.backdrop?.sx || {}
  );

  const drawerTree = (
    <div
      className="ob-drawer-root fixed inset-0 z-[1600] pointer-events-none"
      style={cleanSx(drawerRootSx)}
      data-keep-mounted={keepMounted ? 'true' : 'false'}
    >
      <div
        className="ob-backdrop fixed inset-0 z-0 bg-black/70 pointer-events-auto"
        style={backdropStyle}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className={`ob-drawer-panel fixed z-20 pointer-events-auto bg-[#161412] ${borderClass} shadow-2xl overflow-y-auto ${panelPositionClass}`}
        style={paperStyle}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );

  if (disablePortal || typeof document === 'undefined') {
    return drawerTree;
  }

  return createPortal(drawerTree, document.body);
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
export const Avatar = ({ src, alt, children, className, sx, variant, ...props }: any) => {
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
    className={`ob-switch-track w-11 h-6 rounded-full transition-all relative ${checked ? 'ob-checked bg-[#6366F1]' : 'bg-[#23211F]'} ${disabled ? 'ob-disabled opacity-50 cursor-not-allowed' : ''}`}
    {...props}
  >
    <span className={`ob-switch-thumb absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'ob-checked translate-x-5' : ''}`} />
  </button>
);

// 17. Checkbox Component
export const Checkbox = ({ checked, onChange, disabled, ...props }: any) => (
  <button
    onClick={() => !disabled && onChange?.({ target: { checked: !checked } })}
    disabled={disabled}
    className={`w-5 h-5 rounded-md border border-[#23211F] bg-[#0A0908] flex items-center justify-center transition-all ${checked ? 'ob-checked bg-[#6366F1] border-indigo-500' : ''} ${disabled ? 'ob-disabled opacity-50 cursor-not-allowed' : ''}`}
    {...props}
  >
    {checked && <span className="w-2.5 h-2.5 bg-white rounded-sm" />}
  </button>
);

// 18. Tooltip Component — never leave visible thread text when not hovered
export const Tooltip = ({ title, children, ..._props }: any) => (
  <div className="group/tip relative inline-flex shrink-0">
    {children}
    {title ? (
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-[200] mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#141211] border border-[#23211F] px-2 py-1 text-xs text-stone-200 opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-opacity"
      >
        {title}
      </span>
    ) : null}
  </div>
);

// 19. Chip Component
export const Chip = ({
  label,
  className,
  color,
  variant,
  onDelete,
  deleteIcon,
  icon,
  avatar,
  clickable,
  size,
  disabled,
  sx,
  ...props
}: any) => {
  let variantClass = "bg-[#1E1B19] text-stone-300";
  if (color === 'primary') {
    variantClass = "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
  } else if (color === 'secondary') {
    variantClass = "bg-pink-500/20 text-pink-300 border border-pink-500/30";
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && !disabled) {
      onDelete(e);
    }
  };

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium font-mono ${variantClass} ${clickable ? 'cursor-pointer hover:brightness-110' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className || ''}`} 
      style={cleanSx(sx)}
      {...props}
    >
      {avatar && <span className="flex-shrink-0">{avatar}</span>}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {label}
      {onDelete && (
        <span 
          onClick={handleDelete}
          className="flex items-center justify-center cursor-pointer hover:bg-white/20 rounded-full p-1 -mr-1 transition-colors group/chip-delete"
        >
          {deleteIcon || <CloseIcon sx={{ fontSize: 16, opacity: 0.6, '&:hover': { opacity: 1 } }} />}
        </span>
      )}
    </span>
  );
};

// 20. Badge Component
export const Badge = ({
  children,
  badgeContent,
  color,
  variant,
  invisible,
  overlap,
  max,
  showZero,
  ..._props
}: any) => (
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
export const Alert = ({
  children,
  severity = 'info',
  className,
  variant,
  action,
  color,
  icon,
  onClose,
  ...props
}: any) => {
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
export const Menu = React.forwardRef(({
  open,
  anchorEl,
  anchorReference,
  anchorPosition,
  anchorOrigin,
  transformOrigin,
  onClose,
  children,
  sx,
  className,
  slotProps,
  PaperProps,
  disablePortal,
  keepMounted,
  ...props
}: any, ref) => {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [baseCoords, setBaseCoords] = React.useState({ top: 0, left: 0 });
  const [panelSize, setPanelSize] = React.useState({ width: 0, height: 0 });

  // 1. Capture base coordinates from anchor
  React.useLayoutEffect(() => {
    if (!open) return;

    if (anchorReference === 'anchorPosition' && anchorPosition) {
      setBaseCoords({ top: anchorPosition.top, left: anchorPosition.left });
    } else if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const vertical = anchorOrigin?.vertical === 'top' ? 'top' : 'bottom';
      const horizontal = anchorOrigin?.horizontal === 'right' ? 'right' : 'left';
      setBaseCoords({
        top: vertical === 'top' ? rect.top - 4 : rect.bottom + 4,
        left: horizontal === 'right' ? rect.right : rect.left});
    }
  }, [open, anchorEl, anchorReference, anchorPosition?.top, anchorPosition?.left, anchorOrigin?.vertical, anchorOrigin?.horizontal]);

  // 2. Measure panel size to handle transformOrigin and clamping
  React.useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPanelSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, [open]);

  // 3. Compute final display coordinates
  const finalCoords = React.useMemo(() => {
    let { top, left } = baseCoords;
    const { width, height } = panelSize;
    if (width === 0) return { top, left, opacity: 0 }; // Hide while measuring

    const hOrigin = transformOrigin?.horizontal || anchorOrigin?.horizontal;
    const vOrigin = transformOrigin?.vertical || anchorOrigin?.vertical;

    if (hOrigin === 'right') left -= width;
    else if (hOrigin === 'center') left -= width / 2;

    if (vOrigin === 'bottom') top -= height;
    else if (vOrigin === 'center') top -= height / 2;

    const margin = 8;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
    if (top + height > window.innerHeight - margin) top = window.innerHeight - height - margin;
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    return { top, left, opacity: 1 };
  }, [baseCoords, panelSize, transformOrigin, anchorOrigin]);

  if (!open && !keepMounted) return null;

  const paperSx = cleanSx(slotProps?.paper?.sx || PaperProps?.sx || sx || {});

  const setRefs = (node: HTMLDivElement | null) => {
    panelRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div
      className="fixed inset-0 z-[1400]"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      role="presentation"
    >
      <div
        ref={setRefs}
        role="menu"
        data-kylrix-context-menu="true"
        className={`fixed z-[1401] overflow-hidden animate-fade-in ${className || ''}`}
        style={{
          top: finalCoords.top,
          left: finalCoords.left,
          opacity: finalCoords.opacity,
          minWidth: 220,
          ...paperSx}}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
Menu.displayName = 'Menu';

export const MenuItem = React.forwardRef(({ children, onClick, className, sx, ...props }: any, ref) => {
  const [hovered, setHovered] = React.useState(false);
  const { root, nested } = splitSx(sx);
  const rootSx = cleanSx(root);
  const hoverSx = cleanSx(nested['&:hover'] || {});

  return (
    <div
      ref={ref}
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex w-full items-center rounded-xl cursor-pointer transition-colors duration-200 ${className || ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        ...rootSx,
        ...(hovered ? hoverSx : {})}}
      {...props}
    >
      {children}
    </div>
  );
});
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

const Radio = React.forwardRef(({ checked, onChange, disabled, className, sx, ...props }: any, ref) => (
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

const RadioGroup = React.forwardRef(({ children, value, onChange, className, sx, ...props }: any, ref) => (
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

const Snackbar = React.forwardRef(({ open, message, autoHideDuration, onClose, className, sx, ...props }: any, ref) => {
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

export const Accordion = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AccordionDetails = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AccordionSummary = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AlertTitle = ({ children, ...props }: any) => React.createElement('div', props, children);
export const AvatarGroup = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Backdrop = ({ open = false, onClick, children, className, sx, ...props }: any) => {
  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={onClick}
      className={className || ''}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        animation: 'kylrixBackdropIn 0.28s ease',
        ...cleanSx(sx)}}
      {...props}
    >
      {children}
    </div>
  );
};
export const BottomNavigation = React.forwardRef(({ children, value, onChange, actionColor, className, sx, showLabels, ...props }: any, ref) => {
  return (
    <div
      ref={ref}
      className={`flex w-full items-center justify-between ${className || ''}`}
      style={{
        background: 'transparent',
        height: 72,
        ...cleanSx(sx)}}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        const childValue = (child.props as any).value ?? (child.props as any).id;
        const selected = childValue === value;
        return React.cloneElement(child, {
          selected,
          selectedColor: actionColor,
          showLabels,
          onClick: (e: any) => {
            if (onChange) onChange(e, childValue);
            if ((child.props as any).onClick) (child.props as any).onClick(e);
          }} as any);
      })}
    </div>
  );
});
BottomNavigation.displayName = 'BottomNavigation';

export const BottomNavigationAction = React.forwardRef(({ label, icon, selected, selectedColor, showLabels = false, className, sx, ...props }: any, ref) => {
  const [pressing, setPressing] = React.useState(false);
  const accent = selectedColor || OPENBRICKS_TOKENS.connectAccent;

  return (
    <button
      ref={ref}
      type="button"
      className={`flex flex-col items-center justify-center flex-1 border-0 bg-transparent ${className || ''}`}
      style={{
        minWidth: 'auto',
        padding: 0,
        height: 56,
        cursor: 'pointer',
        color: selected ? accent : 'rgba(255, 255, 255, 0.4)',
        backgroundColor: 'transparent',
        ...cleanSx(sx)}}
      onPointerDown={() => setPressing(true)}
      onPointerUp={() => setPressing(false)}
      onPointerLeave={() => setPressing(false)}
      onPointerCancel={() => setPressing(false)}
      {...props}
    >
      {icon && (
        <span
          className="lucide-wrap"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: pressing
              ? 'scale(0.88)'
              : selected
                ? 'scale(1.2) translateY(-2px)'
                : 'scale(1)',
            filter: selected ? `drop-shadow(0 0 8px ${alpha(accent, 0.5)})` : 'none',
            transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.22s ease'}}
        >
          {icon}
        </span>
      )}
      {label && showLabels ? <span style={{ marginTop: 4, fontSize: '0.7rem', lineHeight: 1.2 }}>{label}</span> : null}
    </button>
  );
});
BottomNavigationAction.displayName = 'BottomNavigationAction';
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
const CardMedia = React.forwardRef(({ component, image, src, alt, className, sx, children, ...props }: any, ref) => {
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
export const Fab = React.forwardRef(({ children, className, sx, color, ...props }: any, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center rounded-full p-3 shadow-xl transition-all active:scale-95 ${className || ''}`}
    style={{
      background: color === 'primary' ? OPENBRICKS_TOKENS.connectAccent : OPENBRICKS_TOKENS.surfaceAlt,
      color: color === 'primary' ? '#111' : OPENBRICKS_TOKENS.text,
      border: `1px solid ${OPENBRICKS_TOKENS.border}`,
      ...cleanSx(sx)}}
    {...props}
  >
    {children}
  </button>
));
Fab.displayName = 'Fab';
