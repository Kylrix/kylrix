'use client';

import React from 'react';
import {
  FileText,
  CheckSquare,
  Calendar,
  FormInput,
  KeyRound,
  Shield,
  FolderKanban,
  MessageSquare,
  Pin,
} from 'lucide-react';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import {
  type ObjectKind,
  type UnifiedObjectCardModel,
} from '@/lib/objects/types';

function pendingResourceId(kind: ObjectKind, id: string): string {
  if (kind === 'goal') return goalPendingKey(id);
  return id;
}

function KindIcon({ kind }: { kind: ObjectKind }) {
  const props = { size: 14, strokeWidth: 2.25, className: 'text-[#9B9691]' as const };
  switch (kind) {
    case 'note':
      return <FileText {...props} />;
    case 'goal':
      return <CheckSquare {...props} />;
    case 'event':
      return <Calendar {...props} />;
    case 'form':
      return <FormInput {...props} />;
    case 'credential':
      return <KeyRound {...props} />;
    case 'totp':
      return <Shield {...props} />;
    case 'project':
      return <FolderKanban {...props} />;
    case 'agent_session':
      return <MessageSquare {...props} />;
    default:
      return <FileText {...props} />;
  }
}

type Props = {
  item: UnifiedObjectCardModel;
  onOpen?: (item: UnifiedObjectCardModel) => void;
  trailing?: React.ReactNode;
  className?: string;
};

/**
 * Single card shell for non-note object kinds (goals, events, …).
 * Kind is signaled by icon only — never redundant type labels like "Idea".
 * Notes use `NoteCard` (canonical grid chrome).
 */
export function ObjectCard({ item, onOpen, trailing, className }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className={[
        'w-full text-left rounded-[28px] border border-[#34322F] bg-[#161412] px-5 py-4',
        'hover:border-[#3C3A38] hover:bg-[#1C1A18] transition-colors',
        className || '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl border border-white/8 bg-white/[0.03] grid place-items-center flex-shrink-0"
          aria-hidden
        >
          <KindIcon kind={item.kind} />
        </div>
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={[
                'text-base font-semibold text-[#F5F3EF] break-words leading-snug min-w-0 flex-1',
                item.status === 'done' ? 'line-through text-[#9B9691]' : '',
              ].join(' ')}
            >
              {item.title || 'Untitled'}
            </div>
            <SyncStatusDot resourceId={pendingResourceId(item.kind, item.id)} />
            {item.isPinned ? (
              <Pin
                size={12}
                className="text-[#F59E0B] fill-[#F59E0B] rotate-45 flex-shrink-0"
                aria-label="Pinned"
              />
            ) : null}
          </div>
          {item.subtitle ? (
            <div className="text-sm text-[#9B9691] line-clamp-2 break-words leading-relaxed">
              {item.subtitle}
            </div>
          ) : null}
        </div>
        {trailing ? <div className="flex-shrink-0">{trailing}</div> : null}
      </div>
    </button>
  );
}
