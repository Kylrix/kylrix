'use client';

import React from 'react';
import { Paperclip } from 'lucide-react';
import type { Priority } from '@/types';

export const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#6366F1',
  low: '#22C55E',
};

const TAG_PALETTE = [
  '#EC4899',
  '#A855F7',
  '#6366F1',
  '#22C55E',
  '#F59E0B',
  '#14B8A6',
  '#F43F5E',
  '#3B82F6',
  '#EAB308',
  '#8B5CF6',
];

/** Stable colorful tint when a tag has no stored color. */
export function colorForTag(name: string, known?: string | null): string {
  if (known && /^#|rgb/i.test(known)) return known;
  let hash = 0;
  const key = String(name || '').toLowerCase();
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

export function MetaChip({
  label,
  color,
  icon,
}: {
  label: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 max-w-[7.5rem] truncate text-[9px] font-black font-mono uppercase tracking-wider px-2 py-0.5 rounded-lg border flex-shrink-0"
      style={{
        color,
        backgroundColor: `${color}1a`,
        borderColor: `${color}33`,
      }}
      title={label}
    >
      {icon}
      {label}
    </span>
  );
}

type Props = {
  tags?: string[];
  /** Optional name → color map (goal labels / note tags). Missing names get palette colors. */
  tagColors?: Record<string, string>;
  priority?: Priority | null;
  dueLabel?: string | null;
  attachmentCount?: number;
  maxTags?: number;
};

/**
 * Shared card footer meta — priority + colorful tags (+ due / attachments).
 * Used by idea and goal ObjectCard footers.
 */
export function ObjectCardMeta({
  tags = [],
  tagColors,
  priority,
  dueLabel,
  attachmentCount = 0,
  maxTags = 3,
}: Props) {
  const shown = tags.filter(Boolean).slice(0, maxTags);
  const hasMeta = Boolean(priority) || shown.length > 0 || Boolean(dueLabel) || attachmentCount > 0;
  if (!hasMeta) return null;

  return (
    <div className="flex w-full items-center gap-1.5 overflow-hidden pt-2">
      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
        {priority ? (
          <MetaChip label={priority} color={PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium} />
        ) : null}
        {shown.map((tag) => (
          <MetaChip
            key={tag}
            label={tag}
            color={colorForTag(tag, tagColors?.[tag])}
          />
        ))}
        {attachmentCount > 0 ? (
          <MetaChip
            label={String(attachmentCount)}
            color="#818CF8"
            icon={<Paperclip size={10} />}
          />
        ) : null}
      </div>
      {dueLabel ? (
        <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-white/40 flex-shrink-0">
          {dueLabel}
        </span>
      ) : null}
    </div>
  );
}
