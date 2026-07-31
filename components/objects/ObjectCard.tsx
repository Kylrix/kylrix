'use client';

import React, { useCallback, useRef } from 'react';
import { Pin } from 'lucide-react';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { goalPendingKey } from '@/lib/sync/goal-keys';
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
};

const LONG_PRESS_MS = 480;

/**
 * Unified object card — single ash surface.
 * Uniform density locks height so grid tiles stay even across preview lengths.
 * Long-press (mobile) mirrors right-click context menu.
 */
export function ObjectCard({
  item,
  onOpen,
  onContextMenu,
  trailing,
  children,
  footer,
  className,
  style,
  density = 'fluid',
}: Props) {
  const accent = item.accent || objectKindAccent(item.kind);
  const done = item.status === 'done';
  const uniform = density === 'uniform';
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
    [clearLongPress, onContextMenu],
  );

  const handleClick = useCallback(() => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onOpen?.(item);
  }, [item, onOpen]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(item);
        }
      }}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
      className={[
        'w-full text-left rounded-[26px] bg-[#161412] border border-[#34322F] overflow-hidden cursor-pointer select-none',
        'transition-all duration-200 hover:border-[#3C3A38] hover:bg-[#1C1A18] hover:-translate-y-px',
        uniform
          ? 'h-full min-h-[152px] sm:min-h-[164px] lg:min-h-[176px] xl:min-h-[188px] flex flex-col'
          : '',
        className || '',
      ].join(' ')}
      style={style}
    >
      <div
        className={[
          'p-5 flex flex-col gap-3',
          uniform ? 'flex-1 min-h-0 h-full' : '',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <span
              className={[
                'min-w-0 flex-1 text-white font-black text-[0.95rem] sm:text-[1rem] leading-[1.25] line-clamp-2',
                done ? 'line-through text-white/45' : '',
              ].join(' ')}
            >
              {item.title || 'Untitled'}
            </span>
            <SyncStatusDot resourceId={pendingResourceId(item.kind, item.id)} />
            {item.isPinned ? (
              <Pin
                size={12}
                className="rotate-45 flex-shrink-0"
                style={{ color: accent, fill: accent }}
                aria-label="Pinned"
              />
            ) : null}
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

        {/* Preview — fixed clamp band when uniform so tiles match */}
        <div
          className={[
            uniform ? 'flex-1 min-h-[2.75rem] sm:min-h-[3.25rem]' : '',
          ].join(' ')}
        >
          {children ?? (
            <p
              className={[
                'text-white/50 font-satoshi text-[0.8125rem] sm:text-sm font-medium leading-relaxed break-words m-0',
                uniform ? 'line-clamp-2' : 'line-clamp-3',
              ].join(' ')}
            >
              {item.subtitle?.trim() || (uniform ? '\u00A0' : '')}
            </p>
          )}
        </div>

        {footer ? (
          <div
            className="flex-shrink-0 mt-auto border-t border-white/[0.04]"
            onClick={(e) => e.stopPropagation()}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
