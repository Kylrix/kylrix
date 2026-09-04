'use client';

import React, { useCallback, useRef } from 'react';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import { triggerLocalSoftRefresh } from '@/lib/sync/local-soft-refresh';
import { useSelection } from '@/context/SelectionContext';
import { CheckSquare } from 'lucide-react';
import {
  objectKindAccent,
  type ObjectKind,
  type UnifiedObjectCardModel,
} from '@/lib/objects/types';

function pendingResourceId(kind: ObjectKind, id: string): string {
  if (kind === 'goal') return goalPendingKey(id);
  return id;
}

type Props = {
  item: UnifiedObjectCardModel;
  onOpen?: (item: UnifiedObjectCardModel) => void;
  onContextMenu?: (event: React.MouseEvent | React.TouchEvent) => void;
  /** Left of title — e.g. goal complete checkbox. */
  leading?: React.ReactNode;
  /** Optional custom title node (e.g. icon + badge) overriding default string title. */
  titleNode?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /**
   * fluid — height follows content (notes).
   * uniform — equal card height by screen band (goals/events grids).
   */
  density?: 'fluid' | 'uniform';
  /**
   * idea — soft content card.
   * task — checklist-style goal: priority rail, denser chrome, checkbox-led.
   */
  variant?: 'idea' | 'task';
  /** Task variant: left edge color (priority). */
  railColor?: string | null;
};

const LONG_PRESS_MS = 480;

/**
 * Unified object card.
 * Long-press (mobile) mirrors right-click context menu.
 * Pinned state is shown only via the trailing pin control — no duplicate badge.
 */
export function ObjectCard({
  item,
  onOpen,
  onContextMenu,
  leading,
  titleNode,
  trailing,
  children,
  footer,
  className,
  style,
  density = 'fluid',
  variant = 'idea',
  railColor,
}: Props) {
  const { isSelectMode, isSelected: checkIsSelected, toggleSelect } = useSelection();
  const isSelected = checkIsSelected(item.id, item.kind);
  const accent = item.accent || objectKindAccent(item.kind);
  const done = item.status === 'done';
  const uniform = density === 'uniform';
  const isTask = variant === 'task';
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isSelectMode) return;
      if (!onContextMenu) return;
      longPressFired.current = false;
      clearLongPress();
      const touch = e.touches[0];
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        onContextMenu({
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: touch?.clientX ?? 0,
          clientY: touch?.clientY ?? 0,
        } as unknown as React.MouseEvent);
      }, LONG_PRESS_MS);
    },
    [clearLongPress, onContextMenu, isSelectMode],
  );

  const handleClick = useCallback(() => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (isSelectMode) {
      toggleSelect(item.id, item.kind);
      return;
    }
    triggerLocalSoftRefresh(item.kind, item.id);
    onOpen?.(item);
  }, [item, onOpen, isSelectMode, toggleSelect]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isSelectMode) {
            toggleSelect(item.id, item.kind);
            return;
          }
          triggerLocalSoftRefresh(item.kind, item.id);
          onOpen?.(item);
        }
      }}
      onContextMenu={isSelectMode ? (e) => e.preventDefault() : onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
      className={[
        'w-full text-left overflow-hidden cursor-pointer select-none relative min-w-[260px] sm:min-w-[280px]',
        isSelected
          ? 'ring-2 ring-[#10B981] border-[#10B981]/50 bg-[#1A1816]'
          : isTask
          ? [
              'rounded-2xl bg-[#12110F] border border-[#2A2826]',
              'hover:border-[#3C3A38] hover:bg-[#161412]',
              'transition-colors duration-150',
              uniform
                ? 'h-full min-h-[112px] sm:min-h-[120px] lg:min-h-[128px] flex flex-col'
                : '',
            ].join(' ')
          : [
              'rounded-[26px] bg-[#161412] border border-[#34322F]',
              'transition-all duration-200 hover:border-[#3C3A38] hover:bg-[#1C1A18] hover:-translate-y-px',
              uniform
                ? 'h-full min-h-[152px] sm:min-h-[164px] lg:min-h-[176px] xl:min-h-[188px] flex flex-col'
                : '',
            ].join(' '),
        className || '',
      ].join(' ')}
      style={style}
    >
      {isTask ? (
        <div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
          style={{ backgroundColor: railColor || accent }}
          aria-hidden
        />
      ) : null}

      <div
        className={[
          isTask ? 'pl-4 pr-3.5 py-3.5 flex flex-col gap-2' : 'p-5 flex flex-col gap-3',
          uniform ? 'flex-1 min-h-0 h-full' : '',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2.5 flex-shrink-0">
          <div className="min-w-0 flex-1 flex items-start gap-2.5">
            {isSelectMode ? (
              <div
                className="flex-shrink-0 pt-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(item.id, item.kind);
                }}
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-[#10B981] border-[#10B981] text-[#0A0908]' : 'border-[#9B9691] bg-transparent'
                  }`}
                >
                  {isSelected && <CheckSquare className="w-4 h-4" />}
                </div>
              </div>
            ) : leading ? (
              <div
                className="flex-shrink-0 pt-0.5"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {leading}
              </div>
            ) : null}
            <div className="min-w-0 flex-1 flex items-center gap-2">
              {titleNode ?? (
                <span
                  className={[
                    'min-w-0 flex-1 leading-snug line-clamp-2',
                    isTask
                      ? 'text-[0.9375rem] font-semibold font-satoshi tracking-[-0.01em] text-[#F5F2ED]'
                      : 'text-white font-black text-[0.95rem] sm:text-[1rem] leading-[1.25]',
                    done ? 'line-through text-white/40' : '',
                  ].join(' ')}
                >
                  {item.title || 'Untitled'}
                </span>
              )}
              <SyncStatusDot resourceId={pendingResourceId(item.kind, item.id)} kind={item.kind} />
            </div>
          </div>

          {trailing ? (
            <div
              className="flex items-center gap-0.5 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {trailing}
            </div>
          ) : null}
        </div>

        {/* Preview */}
        <div
          className={[
            leading ? 'pl-9' : '',
            uniform && !isTask ? 'flex-1 min-h-[2.75rem] sm:min-h-[3.25rem]' : '',
            isTask && uniform ? 'flex-1 min-h-[1.5rem]' : '',
          ].join(' ')}
        >
          {children ?? (
            <p
              className={[
                'font-satoshi break-words m-0',
                isTask
                  ? 'text-white/60 text-[0.8125rem] leading-snug line-clamp-2 font-medium'
                  : 'text-white/50 text-[0.8125rem] sm:text-sm font-medium leading-relaxed line-clamp-3',
                !isTask && uniform ? 'line-clamp-2' : '',
              ].join(' ')}
            >
              {item.subtitle?.trim() || (uniform ? '\u00A0' : '')}
            </p>
          )}
        </div>

        {footer ? (
          <div
            className={[
              'flex-shrink-0 mt-auto',
              isTask ? 'pl-9 border-t border-white/[0.04] pt-2' : 'border-t border-white/[0.04]',
              leading ? '' : '',
            ].join(' ')}
            onClick={(e) => e.stopPropagation()}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
