'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AgenticPreviewPartition } from '@/lib/agentic/preview-partition';
import { FormsService } from '@/lib/services/forms';

interface AgenticPreviewDrawerProps {
  previewId: string;
  kind?: string;
  title?: string;
  onClose: () => void;
  onCommitted?: () => void;
}

export function AgenticPreviewDrawer({
  previewId,
  kind,
  title = 'Preview',
  onClose,
  onCommitted,
}: AgenticPreviewDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [formTitle, setFormTitle] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const env = await AgenticPreviewPartition.get<Record<string, unknown>>(previewId);
        if (!active) return;
        const data = (env?.payload as Record<string, unknown>) || null;
        setPayload(data);

        if (kind === 'form_submit' || env?.kind === 'form_submit') {
          const formId = String(data?.formId || '');
          if (formId) {
            const form = await FormsService.getForm(formId);
            setFormTitle(form.title || 'Form');
          }
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load preview');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [previewId, kind]);

  const handleCommit = async () => {
    if (!payload) return;
    setCommitting(true);
    setError(null);
    try {
      if (kind === 'form_submit' || payload.formId) {
        const formId = String(payload.formId || '');
        const answers = payload.payload || payload.responses || payload;
        await FormsService.submitForm(formId, JSON.stringify(answers));
      }
      await AgenticPreviewPartition.clear(previewId);
      onCommitted?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="p-5 md:p-6 font-satoshi text-white">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#6366F1] font-mono">
            Agent preview
          </p>
          <h2 className="text-lg font-extrabold font-clash">{title}</h2>
          {formTitle && <p className="text-xs text-[#9B9691] mt-1">Form: {formTitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl border border-white/10 text-white/60 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#9B9691]">Loading preview…</p>
      ) : (
        <pre className="text-xs bg-[#0B0A09] border border-white/8 rounded-xl p-4 overflow-auto max-h-[40vh] text-[#9B9691]">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}

      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={() => void handleCommit()}
          disabled={loading || committing || !payload}
          className="flex-1 h-11 rounded-xl bg-[#6366F1] text-black font-extrabold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Check size={16} />
          {committing ? 'Submitting…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-4 rounded-xl border border-white/10 text-white/70 font-bold text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
