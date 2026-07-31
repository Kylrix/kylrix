'use client';

import React, { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { objectKindLabel, type ObjectKind } from '@/lib/objects/types';

type Draft = {
  kind: ObjectKind;
  title: string;
  body: string;
};

type Props = {
  open: boolean;
  kind: ObjectKind;
  onClose: () => void;
  onSubmit: (draft: Draft) => void | Promise<void>;
  submitLabel?: string;
};

/**
 * Create drawer for all object kinds. Bottom sheet, max 60dvh (OpenBricks rule).
 * Expand only when content overflows via the top handle.
 */
export function ObjectCreateDrawer({ open, kind, onClose, onSubmit, submitLabel }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const reset = useCallback(() => {
    setTitle('');
    setBody('');
    setSaving(false);
    setExpanded(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() && !body.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ kind, title: title.trim(), body: body.trim() });
      handleClose();
    } finally {
      setSaving(false);
    }
  }, [body, handleClose, kind, onSubmit, title]);

  if (!open) return null;

  const accent = kind === 'note' ? '#EC4899' : kind === 'goal' ? '#A855F7' : '#6366F1';

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center pointer-events-none">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/55 pointer-events-auto"
        onClick={handleClose}
      />
      <div
        className="w-full max-w-xl pointer-events-auto flex flex-col bg-[#161412] border border-[#34322F] border-b-0 rounded-t-[26px] overflow-hidden fixed bottom-0 left-1/2 -translate-x-1/2"
        style={{ maxHeight: expanded ? '92dvh' : '60dvh' }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex justify-center pt-3 pb-1 w-full"
          aria-label={expanded ? 'Collapse drawer' : 'Expand drawer'}
        >
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </button>

        <header className="flex items-center justify-between gap-3 px-5 pb-3">
          <h2 className="text-white font-black text-[0.95rem] leading-tight truncate">
            New {objectKindLabel(kind).toLowerCase()}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 rounded-full border border-white/[0.06] bg-white/[0.05] flex items-center justify-center text-white/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-3 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/40">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              autoFocus
              className="w-full rounded-xl border border-[#34322F] bg-[#161412] px-3 py-2.5 text-white outline-none focus:border-white/20"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/40">Details</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={expanded ? 12 : 5}
              placeholder="Optional details"
              className="w-full rounded-xl border border-[#34322F] bg-[#161412] px-3 py-2.5 text-white outline-none focus:border-white/20 resize-none"
            />
          </label>
        </div>

        <footer className="flex justify-end gap-2 px-5 py-3 border-t border-white/[0.05]">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white/50 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {saving ? 'Saving…' : submitLabel || 'Create'}
          </button>
        </footer>
      </div>
    </div>
  );
}
