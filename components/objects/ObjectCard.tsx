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
  objectKindAccent,
  type ObjectKind,
  type UnifiedObjectCardModel,
} from '@/lib/objects/types';

function pendingResourceId(kind: ObjectKind, id: string): string {
  if (kind === 'goal') return goalPendingKey(id);
  return id;
}

function KindIcon({ kind, accent }: { kind: ObjectKind; accent: string }) {
  const props = { size: 16, strokeWidth: 2.25, color: accent };
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
  onContextMenu?: (event: React.MouseEvent) => void;
  /** Top-right actions (pin, share, complete, …) — profile-drawer trailing slot */
  trailing?: React.ReactNode;
  /** Optional inset body; defaults to subtitle preview */
  children?: React.ReactNode;
  /** Optional row under the inset (tags, attachments) */
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Gold-standard object chrome — same ordering as ConnectTopbar profile drawer:
 * accent Paper shell → header (icon chip + stacked title/meta + trailing) → inset body → footer.
 * Kind is the icon only. Never print redundant type labels ("Idea", "Goal").
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
}: Props) {
  const accent = item.accent || objectKindAccent(item.kind);
  const done = item.status === 'done';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(item);
        }
      }}
      onContextMenu={onContextMenu}
      className={[
        'w-full text-left rounded-[26px] bg-[#161412] overflow-hidden cursor-pointer select-none',
        'transition-colors duration-200 hover:bg-[#1C1A18]',
        className || '',
      ].join(' ')}
      style={{
        border: `1px solid ${accent}38`,
        ...style,
      }}
    >
      <div className="p-3 flex flex-col gap-3">
        {/* Header — profile drawer: icon chip | stacked copy | trailing */}
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-[34px] h-[34px] rounded-xl grid place-items-center flex-shrink-0"
              style={{
                color: accent,
                backgroundColor: `${accent}0F`,
                border: `1px solid ${accent}2E`,
              }}
              aria-hidden
            >
              <KindIcon kind={item.kind} accent={accent} />
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
              <span
                className={[
                  'block text-white font-black text-[0.95rem] leading-[1.15] truncate',
                  done ? 'line-through text-white/45' : '',
                ].join(' ')}
              >
                {item.title || 'Untitled'}
              </span>
              <span className="flex items-center gap-1.5 min-h-[14px]">
                <SyncStatusDot resourceId={pendingResourceId(item.kind, item.id)} />
                {item.isPinned ? (
                  <Pin
                    size={11}
                    className="rotate-45 flex-shrink-0"
                    style={{ color: accent, fill: accent }}
                    aria-label="Pinned"
                  />
                ) : null}
              </span>
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

        {/* Inset body — profile drawer userid block rhythm */}
        <div className="rounded-[20px] border border-white/[0.04] bg-white/[0.01] p-4">
          {children ?? (
            <p className="text-white/70 font-satoshi text-sm font-semibold leading-normal line-clamp-3 break-words m-0">
              {item.subtitle?.trim() || 'No preview'}
            </p>
          )}
        </div>

        {footer ? (
          <div
            className="flex items-center justify-between gap-2 px-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
