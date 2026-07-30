'use client';

import React from 'react';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import {
  objectKindLabel,
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
  trailing?: React.ReactNode;
  className?: string;
};

/**
 * Single card shell for all object kinds. Type-specific chrome goes in `trailing`
 * or via kind-aware title/subtitle already shaped by the caller.
 */
export function ObjectCard({ item, onOpen, trailing, className }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className={[
        'w-full text-left rounded-2xl border border-[#2C2A28] bg-[#141210] px-4 py-3',
        'hover:border-[#3C3A38] transition-colors',
        className || '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#9B9691]">
              {objectKindLabel(item.kind)}
            </span>
            <SyncStatusDot resourceId={pendingResourceId(item.kind, item.id)} />
            {item.isPinned ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">Pinned</span>
            ) : null}
          </div>
          <div className={[
            'text-base font-semibold text-[#F5F3EF] break-words leading-snug',
            item.status === 'done' ? 'line-through text-[#9B9691]' : '',
          ].join(' ')}>
            {item.title || 'Untitled'}
          </div>
          {item.subtitle ? (
            <div className="mt-1 text-sm text-[#9B9691] line-clamp-2 break-words">{item.subtitle}</div>
          ) : null}
        </div>
        {trailing ? <div className="flex-shrink-0">{trailing}</div> : null}
      </div>
    </button>
  );
}
