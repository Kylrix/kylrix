import React from 'react';
import { alpha, useTheme, useMediaQuery } from './core';
import { cleanSx, splitSx, normalizeStyleValue, pickResponsiveValue, resolvePaletteToken, isRenderableComponentType } from './core';

export const Fade = ({ children, in: inProp, timeout, sx, ...props }: any) => (
  <div 
    style={{ 
        display: inProp === false ? 'none' : 'contents',
        ...cleanSx(sx)
    }} 
    {...props}
  >
    {children}
  </div>
);
export const InputBase = React.forwardRef(({ className, sx, inputRef, endAdornment, startAdornment, fullWidth, ...props }: any, ref) => {
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
          ...(placeholderStyle.opacity !== undefined ? { ['--kylrix-placeholder-opacity' as any]: placeholderStyle.opacity } : {})}}
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
export const Link = React.forwardRef(({ children, href, className, sx, target, rel, ...props }: any, ref) => (
  <a
    ref={ref}
    href={href}
    target={target}
    rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)}
    className={`text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </a>
));
Link.displayName = 'Link';
export const ListItemIcon = React.forwardRef(({ children, className, sx, ...props }: any, ref) => {
  const resolved = cleanSx(sx);
  const compact = resolved?.minWidth === 'auto' || resolved?.minWidth === 0;
  return (
    <div
      ref={ref}
      className={`inline-flex shrink-0 items-center justify-center ${compact ? '' : 'h-8 w-8 rounded-lg'} text-inherit ${className || ''}`}
      style={resolved}
      {...props}
    >
      {children}
    </div>
  );
});
ListItemIcon.displayName = 'ListItemIcon';
const Pagination = React.forwardRef(
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
        disabled: safePage <= 1})
    );
    for (let i = 1; i <= safeCount; i++) {
      items.push(makeItem({ type: 'page', page: i, selected: i === safePage, disabled: false }));
    }
    items.push(
      makeItem({
        type: 'next',
        page: Math.min(safeCount, safePage + 1),
        selected: false,
        disabled: safePage >= safeCount})
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

const PaginationItem = React.forwardRef(
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
export const Popover = React.forwardRef(({ open, anchorEl, onClose, children, sx, className, ...props }: any, ref) => {
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (open && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX});
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
          ...cleanSx(sx)}}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
Popover.displayName = 'Popover';
const SpeedDial = React.forwardRef(
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
    const fabSx = cleanSx(nested['& .ob-fab-primary'] || nested['& .ob-fab-primary']);

    return (
      <div
        ref={ref}
        className={className || ''}
        style={rootSx}
        {...props}
      >
        <button
          type="button"
          className="ob-fab-primary"
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
            ...fabSx}}
        >
          {renderedIcon}
        </button>

        {open ? (
          <div
            className="ob-speed-dial-actions"
            style={{
              display: 'flex',
              flexDirection: direction === 'up' ? 'column-reverse' : 'column',
              gap: 10,
              alignItems: 'flex-end',
              marginTop: 10}}
          >
            {React.Children.map(children, (child) => {
              if (!React.isValidElement(child)) return child;
              return React.cloneElement(child as any, { open, __obSx: sx });
            })}
          </div>
        ) : null}
      </div>
    );
  }
);
SpeedDial.displayName = 'SpeedDial';

const SpeedDialIcon = React.forwardRef<HTMLSpanElement, any>(({ icon, openIcon, open }: any, ref) => {
  return (
    <span ref={ref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {open ? openIcon : icon}
    </span>
  );
});
SpeedDialIcon.displayName = 'SpeedDialIcon';

const SpeedDialAction = React.forwardRef(
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
      __obSx,
      ...props
    }: any,
    ref
  ) => {
    const { root: rootSx, nested } = splitSx(__obSx || sx);
    const actionFabSx = cleanSx(nested['& .ob-speed-dial-action'] || nested['& .ob-speed-dial-action']);
    const tooltipLabelSx = cleanSx(nested['& .ob-speed-dial-tooltip'] || nested['& .ob-speed-dial-tooltip']);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {tooltipOpen && open && tooltipTitle ? (
          <span
            className="ob-speed-dial-tooltip"
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
              ...tooltipLabelSx}}
          >
            {tooltipTitle}
          </span>
        ) : null}
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={`ob-speed-dial-action ${className || ''}`}
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
            ...actionFabSx}}
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
export const TableContainer = React.forwardRef(({ children, className, sx, component: Component = 'div', ...props }: any, ref) => {
  return (
    <Component
      ref={ref}
      className={`overflow-x-auto w-full ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </Component>
  );
});
TableContainer.displayName = 'TableContainer';

export const Table = React.forwardRef(({ children, className, sx, ...props }: any, ref) => (
  <table
    ref={ref}
    className={`w-full border-collapse text-left ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </table>
));
Table.displayName = 'Table';

export const TableHead = React.forwardRef(({ children, className, sx, ...props }: any, ref) => (
  <thead
    ref={ref}
    className={`${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </thead>
));
TableHead.displayName = 'TableHead';

export const TableBody = React.forwardRef(({ children, className, sx, ...props }: any, ref) => (
  <tbody
    ref={ref}
    className={`${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </tbody>
));
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef(({ children, className, sx, ...props }: any, ref) => (
  <tr
    ref={ref}
    className={`border-b border-[#23211F] hover:bg-[#1E1B19]/30 transition-colors ${className || ''}`}
    style={cleanSx(sx)}
    {...props}
  >
    {children}
  </tr>
));
TableRow.displayName = 'TableRow';

export const TableCell = React.forwardRef(({ children, className, sx, align, ...props }: any, ref) => {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td
      ref={ref}
      className={`px-6 py-4 text-sm align-middle ${alignClass} ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      {children}
    </td>
  );
});
TableCell.displayName = 'TableCell';

export const TablePagination = React.forwardRef(({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 25],
  component: Component = 'div',
  sx,
  className,
  ...props
}: any, ref) => {
  const from = count === 0 ? 0 : page * rowsPerPage + 1;
  const to = Math.min(count, (page + 1) * rowsPerPage);

  const handleBack = (e: any) => {
    if (page > 0) onPageChange?.(e, page - 1);
  };

  const handleNext = (e: any) => {
    if ((page + 1) * rowsPerPage < count) onPageChange?.(e, page + 1);
  };

  return (
    <Component
      ref={ref}
      className={`flex items-center justify-end gap-6 px-6 py-3 text-xs font-satoshi text-stone-400 select-none ${className || ''}`}
      style={cleanSx(sx)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange?.(e)}
          className="bg-transparent border-0 text-stone-200 outline-none cursor-pointer font-bold"
        >
          {rowsPerPageOptions.map((opt: any) => (
            <option key={opt} value={opt} className="bg-[#141211] text-stone-200">
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div>
        {from}-{to} of {count}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleBack}
          disabled={page === 0}
          className="p-1 rounded hover:bg-[#1E1B19] text-stone-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
          type="button"
        >
          ‹
        </button>
        <button
          onClick={handleNext}
          disabled={(page + 1) * rowsPerPage >= count}
          className="p-1 rounded hover:bg-[#1E1B19] text-stone-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
          type="button"
        >
          ›
        </button>
      </div>
    </Component>
  );
});
TablePagination.displayName = 'TablePagination';

export const Zoom = ({ children, timeout, in: inProp, sx, ...props }: any) => React.createElement('div', { 
    ...props, 
    style: {
        ...cleanSx(sx)
    } 
}, children);
