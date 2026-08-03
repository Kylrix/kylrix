'use client';

import React from 'react';
import { Layers, ShieldAlert, BadgeCheck, Check, X, Download } from 'lucide-react';
import type { DiscoverFlow } from '@/lib/flows/types';

export function isFlowConfirmPromptEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const pref = localStorage.getItem('kylrix_flow_confirm_prompt');
    return pref !== 'false';
  } catch {
    return true;
  }
}

export function setFlowConfirmPromptEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('kylrix_flow_confirm_prompt', enabled ? 'true' : 'false');
  } catch {}
}

export function analyzeFlowCapabilities(steps: { actionId: string }[]): {
  level: 'safe' | 'moderate' | 'elevated';
  capabilities: string[];
} {
  const caps = new Set<string>();
  let hasWrite = false;
  let hasExec = false;

  steps.forEach((s) => {
    const act = s.actionId.toLowerCase();
    if (act.includes('write') || act.includes('create') || act.includes('update') || act.includes('delete')) {
      hasWrite = true;
      caps.add('Can modify your saved notes or objects');
    }
    if (act.includes('read') || act.includes('resolve')) {
      caps.add('Reads object content and workspace metadata');
    }
    if (act.includes('run') || act.includes('exec') || act.includes('harness')) {
      hasExec = true;
      caps.add('Runs autonomous agent step chains');
    }
    if (act.includes('math') || act.includes('chart') || act.includes('transform')) {
      caps.add('Transforms content and renders Markdown extensions');
    }
    if (act.includes('summarize') || act.includes('plan')) {
      caps.add('Uses AI models to analyze and compose responses');
    }
  });

  if (caps.size === 0) {
    caps.add('Standard workspace workflow permissions');
  }

  let level: 'safe' | 'moderate' | 'elevated' = 'safe';
  if (hasExec) level = 'elevated';
  else if (hasWrite) level = 'moderate';

  return { level, capabilities: Array.from(caps) };
}

export interface FlowInstallConfirmDrawerProps {
  flow: DiscoverFlow;
  onConfirm: () => void;
  onClose: () => void;
}

/** Self-contained bottom-sheet confirm drawer. Renders its own backdrop and shell. */
export function FlowInstallConfirmDrawer({ flow, onConfirm, onClose }: FlowInstallConfirmDrawerProps) {
  const { level, capabilities } = analyzeFlowCapabilities(flow.steps || []);
  const [installed, setInstalled] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  // Live status check on mount
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { isFlowInstalled, pullAndSyncUserFlowInstalls } = await import('@/lib/flows/installed');
        if (isFlowInstalled(flow.id)) {
          if (active) { setInstalled(true); setChecking(false); }
          return;
        }
        const synced = await pullAndSyncUserFlowInstalls();
        if (active) {
          setInstalled(synced.includes(flow.id));
          setChecking(false);
        }
      } catch {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, [flow.id]);

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center pointer-events-auto">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-[720px] pointer-events-auto flex flex-col bg-[#161412] border border-[#34322F] border-b-0 rounded-t-[24px] overflow-hidden shadow-[0_-12px_36px_rgba(0,0,0,0.5)]"
        style={{ maxHeight: '60dvh' }}
      >
        {/* Drag pill */}
        <button
          type="button"
          className="flex justify-center py-1.5 w-full shrink-0 border-b border-[#34322F]"
          onClick={onClose}
          aria-label="Close drawer"
        >
          <span className="w-10 h-1 rounded-full bg-[#3D3A36]" />
        </button>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 pt-4 flex flex-col gap-4 scrollbar-thin">
          {/* Header */}
          <div className="flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20 text-[#A855F7]">
                <Download size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white tracking-tight">
                  {installed ? 'Flow Installed' : 'Install Flow'}
                </h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
                  Capability Review
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/40 hover:text-white transition rounded-lg hover:bg-white/5 border border-white/5 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Flow info card */}
          <div className="rounded-2xl bg-[#0A0908] border border-white/[0.06] p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">{flow.name}</span>
              {installed ? (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check size={11} /> Installed
                </span>
              ) : flow.publisher?.verified ? (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <BadgeCheck size={11} /> Verified
                </span>
              ) : null}
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              {flow.description || 'No description provided.'}
            </p>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/30 font-mono">
              <span>By {flow.publisher?.handle || '@user'}</span>
              <span>· {flow.steps.length} step(s)</span>
            </div>
          </div>

          {/* Capabilities */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-white/40 tracking-wider uppercase">
              Permissions &amp; Capabilities
            </span>
            <div className="space-y-1.5">
              {capabilities.map((cap, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-white/75 bg-[#0A0908] p-3 rounded-xl border border-white/[0.05]">
                  <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Elevated warning */}
          {level === 'elevated' && (
            <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-amber-300 text-xs">
              <ShieldAlert size={15} className="shrink-0 mt-0.5 text-amber-400" />
              <span>
                This flow contains elevated automated steps. Review step definitions if installing from untrusted creators.
              </span>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col gap-2 pt-1">
            {installed ? (
              <div className="w-full py-3 rounded-xl font-extrabold text-sm bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center gap-2">
                <Check size={15} />
                <span>Already Installed</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={checking}
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="w-full py-3 rounded-xl font-extrabold text-sm bg-[#A855F7] hover:bg-[#9333EA] disabled:opacity-50 text-white cursor-pointer transition flex items-center justify-center gap-2"
              >
                <Download size={15} />
                <span>{checking ? 'Checking...' : 'Confirm & Install'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-white/40 hover:text-white transition hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
