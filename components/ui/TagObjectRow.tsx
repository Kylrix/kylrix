'use client';

import React from 'react';
import { Tag as TagIcon, Edit2 as EditIcon, Trash2 as TrashIcon, Clock as ClockIcon } from 'lucide-react';
import type { Tags } from '@/types/appwrite';
import { ObjectCard } from '@/components/objects/ObjectCard';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { formatDateWithFallback } from '@/lib/date-utils';

type TagObjectRowProps = {
  tag: Tags;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function TagObjectRow({ tag, onClick, onContextMenu, onEdit, onDelete }: TagObjectRowProps) {
  const accentColor = tag.color || '#6366F1';

  return (
    <ObjectCard
      item={{
        id: tag.$id,
        title: tag.name,
        subtitle: tag.description || '',
        kind: 'tag',
        accent: accentColor,
      }}
      onOpen={onClick}
      onContextMenu={onContextMenu}
      leading={
        <div
          style={{
            backgroundColor: `${accentColor}1a`,
            color: accentColor,
            borderColor: `${accentColor}33`,
          }}
          className="w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
        >
          <TagIcon size={20} />
        </div>
      }
      trailing={
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-black uppercase tracking-wider text-white/30 font-mono">
            {(tag as any).usageCount || 0} items
          </span>
          <SyncStatusDot resourceId={tag.$id} />
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 w-full shrink-0 min-w-0 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-white/20 text-[10px] font-bold font-mono uppercase truncate">
            <ClockIcon size={12} className="shrink-0" />
            <span className="truncate">
              Created {formatDateWithFallback(tag.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full shrink-0 min-w-0 overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex-1 min-w-0 py-2 px-2.5 rounded-xl border border-white/5 bg-[#1C1A18] hover:bg-[#252220] hover:border-white/10 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all truncate shrink-0 cursor-pointer"
            >
              <EditIcon size={14} className="shrink-0" />
              <span className="truncate">Edit</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex-1 min-w-0 py-2 px-2.5 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/20 text-red-500 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all truncate shrink-0 cursor-pointer"
            >
              <TrashIcon size={14} className="shrink-0" />
              <span className="truncate">Delete</span>
            </button>
          </div>
        </div>
      }
    />
  );
}
