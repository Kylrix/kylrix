'use client';

import React, { useCallback, useState } from 'react';
import { ObjectDetailShell } from '@/components/objects/ObjectDetailShell';
import { objectKindLabel, type ObjectKind, type UnifiedObjectDetailModel } from '@/lib/objects/types';

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
 * Single create drawer for all object kinds. Callers supply `kind` from route
 * (goals → goal, ideas → note) and handle persistence via pushLive* + sync engine.
 */
export function ObjectCreateDrawer({ open, kind, onClose, onSubmit, submitLabel }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setTitle('');
    setBody('');
    setSaving(false);
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

  const preview: UnifiedObjectDetailModel = {
    kind,
    id: 'draft',
    title: title.trim() || `New ${objectKindLabel(kind).toLowerCase()}`,
    subtitle: body};

  return (
    <ObjectDetailShell
      open={open}
      item={preview}
      onClose={handleClose}
      chrome="full"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[#9B9691] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-[#A855F7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9333EA] disabled:opacity-50"
          >
            {saving ? 'Saving…' : submitLabel || 'Create'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#9B9691]">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${objectKindLabel(kind)} title`}
            className="w-full rounded-xl border border-[#2C2A28] bg-[#141210] px-3 py-2.5 text-white outline-none focus:border-[#A855F7]"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#9B9691]">Details</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Optional details"
            className="w-full rounded-xl border border-[#2C2A28] bg-[#141210] px-3 py-2.5 text-white outline-none focus:border-[#A855F7] resize-y"
          />
        </label>
      </div>
    </ObjectDetailShell>
  );
}
