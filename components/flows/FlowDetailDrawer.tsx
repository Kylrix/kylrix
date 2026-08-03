'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Circle,
  Copy,
  Globe,
  Layers,
  Share2,
  X,
} from 'lucide-react';
import type { WorkflowChain } from '@/lib/workflow-engine';
import type { FlowPublisher, FlowVerifyKind } from '@/lib/flows/types';
import { detectFlowPii } from '@/lib/flows/pii';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import {
  publishFlowAction,
  unpublishFlowAction,
  saveWorkflowAction,
} from '@/lib/actions/workflows';
import toast from 'react-hot-toast';

export function VerifiedMark({ kind }: { kind: FlowVerifyKind }) {
  if (!kind) return null;
  const color = kind === 'kylrix' ? '#EAB308' : '#6366F1';
  return (
    <BadgeCheck
      size={14}
      className="shrink-0"
      style={{ color }}
      fill={`${color}22`}
      aria-label={kind === 'kylrix' ? 'Kylrix verified' : 'Verified publisher'}
    />
  );
}

import { Download, Check, Trash2 } from 'lucide-react';

type Props = {
  flow: WorkflowChain;
  publisher?: FlowPublisher;
  isOwner?: boolean;
  isInstalled?: boolean;
  onClose: () => void;
  onChanged?: (flow: WorkflowChain) => void;
  onInstall?: () => void;
  onUninstall?: () => void;
};

export function FlowDetailDrawer({
  flow,
  publisher,
  isOwner = true,
  isInstalled: initialInstalled = false,
  onClose,
  onChanged,
  onInstall,
  onUninstall,
}: Props) {
  const [local, setLocal] = useState(flow);
  const [installed, setInstalled] = useState(!!initialInstalled);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [aware, setAware] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { isFlowInstalled, pullAndSyncUserFlowInstalls } = await import('@/lib/flows/installed');
        if (isFlowInstalled(flow.id)) {
          if (active) setInstalled(true);
          return;
        }
        const synced = await pullAndSyncUserFlowInstalls();
        if (active) setInstalled(synced.includes(flow.id));
      } catch {}
    })();
    return () => { active = false; };
  }, [flow.id]);

  useEffect(() => {
    setLocal(flow);
  }, [flow]);

  const pii = useMemo(() => detectFlowPii(local), [local]);
  const shareUrl = buildPublicResourceUrl('flow', local.id);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch {
      toast.success(shareUrl);
    }
  };

  const handlePublishToggle = () => {
    if (local.isPublic) {
      void doUnpublish();
      return;
    }
    setAware(false);
    setConfirmOpen(true);
  };

  const doPublish = async () => {
    if (!aware) return;
    setBusy(true);
    const res = await publishFlowAction(local.id, { confirmAware: true });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error || 'Could not publish');
      return;
    }
    const next = { ...local, isPublic: !!res.isPublic };
    setLocal(next);
    onChanged?.(next);
    if (res.isPublic) void saveWorkflowAction(next);
    setConfirmOpen(false);
    if (res.needsAgent) {
      toast.success('Sent for review — not public yet');
    } else {
      toast.success('Published — now in Discover');
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        /* ignore */
      }
    }
  };

  const doUnpublish = async () => {
    setBusy(true);
    const res = await unpublishFlowAction(local.id);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error || 'Could not unpublish');
      return;
    }
    const next = { ...local, isPublic: false };
    setLocal(next);
    onChanged?.(next);
    void saveWorkflowAction(next);
    toast.success('Removed from Discover');
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#161412] text-white font-satoshi">
      <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40 mb-1">
            Flow
          </p>
          <h2 className="font-clash text-lg font-semibold truncate">{local.name}</h2>
          {publisher && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/50">
              <span className="font-bold">{publisher.handle}</span>
              <VerifiedMark kind={publisher.verified} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-white/45 hover:text-white cursor-pointer shrink-0"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
        {local.description ? (
          <p className="text-sm text-white/50">{local.description}</p>
        ) : null}

        <section className="rounded-[18px] bg-[#0A0908] border border-white/[0.05] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Flow Status</h3>
              <p className="text-[11px] text-white/40">
                {installed ? 'Installed on this device' : 'Available for installation'}
              </p>
            </div>
            {installed ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Check size={12} /> Installed
                </span>
                {onUninstall && (
                  <button
                    type="button"
                    onClick={onUninstall}
                    className="p-1.5 rounded-lg bg-[#161412] border border-red-500/20 text-red-400 hover:bg-red-500/10 cursor-pointer"
                    title="Remove Flow"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onInstall}
                className="py-2 px-4 rounded-xl font-extrabold text-xs bg-[#A855F7] hover:bg-[#9333EA] text-white cursor-pointer transition shadow-[0_2px_10px_rgba(168,85,247,0.3)] flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>Install Flow</span>
              </button>
            )}
          </div>
        </section>

        <section className="rounded-[18px] bg-[#0A0908] border border-white/[0.05] p-4 space-y-3">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">
            Sharing
          </h3>

          <button
            type="button"
            onClick={() => void handleShare()}
            className="w-full flex items-center gap-3 rounded-xl bg-[#161412] border border-white/[0.06] px-3.5 py-3 text-left cursor-pointer hover:border-white/10"
          >
            <div className="p-2 rounded-lg bg-[#0A0908] border border-white/[0.06] text-[#A855F7]">
              <Share2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Share</p>
              <p className="text-[11px] text-white/40 truncate">{shareUrl}</p>
            </div>
            <Copy size={14} className="text-white/30 shrink-0" />
          </button>

          {isOwner && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#161412] border border-white/[0.06] px-3.5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-[#0A0908] border border-white/[0.06] text-[#6366F1]">
                  <Globe size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Publish</p>
                  <p className="text-[11px] text-white/40">
                    {local.isPublic ? 'In Discover' : 'Add to Discover'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handlePublishToggle}
                className={`relative h-7 w-12 rounded-full border transition-colors cursor-pointer shrink-0 ${
                  local.isPublic
                    ? 'bg-[#6366F1] border-[#6366F1]'
                    : 'bg-[#0A0908] border-white/15'
                }`}
                aria-pressed={local.isPublic}
                aria-label="Publish"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    local.isPublic ? 'left-6' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          )}
        </section>

        <section className="rounded-[18px] bg-[#0A0908] border border-white/[0.05] p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">
              Steps
            </h3>
            <span className="text-[10px] font-extrabold text-white/30">{local.steps.length}</span>
          </div>
          {local.steps.length === 0 ? (
            <p className="text-xs text-white/35">No steps yet</p>
          ) : (
            local.steps.map((step, idx) => (
              <div
                key={`${step.actionId}-${idx}`}
                className="flex items-center gap-2.5 rounded-xl bg-[#161412] border border-white/[0.05] px-3 py-2"
              >
                <Circle
                  size={8}
                  className={
                    step.importance === 'high'
                      ? 'text-[#A855F7] fill-[#A855F7] shrink-0'
                      : 'text-white/20 fill-white/20 shrink-0'
                  }
                />
                <span className="text-[11px] font-mono text-white/55 truncate">{step.actionId}</span>
              </div>
            ))
          )}
        </section>
      </div>

      {confirmOpen && (
        <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[22px] bg-[#161412] border border-white/[0.08] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-[#A855F7]">
                <Layers size={18} />
              </div>
              <div>
                <h3 className="font-clash text-base font-semibold">Publish to Discover?</h3>
                <p className="text-xs text-white/45 mt-1">
                  Everyone can find and install this flow.
                </p>
              </div>
            </div>

            {pii.hasPii && (
              <div className="rounded-xl bg-[#0A0908] border border-amber-500/25 p-3 space-y-1.5">
                <p className="text-xs font-extrabold text-amber-400">Personal data may be in this flow</p>
                <ul className="space-y-1">
                  {pii.hits.slice(0, 5).map((h) => (
                    <li key={`${h.field}-${h.hint}`} className="text-[11px] text-white/50">
                      {h.field}: {h.hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aware}
                onChange={(e) => setAware(e.target.checked)}
                className="mt-0.5 accent-[#6366F1]"
              />
              <span className="text-xs text-white/60 leading-relaxed">
                I understand this flow becomes public and discoverable to all users.
              </span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-[#0A0908] border border-white/[0.08] text-white/70 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!aware || busy}
                onClick={() => void doPublish()}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white disabled:opacity-40 cursor-pointer"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
