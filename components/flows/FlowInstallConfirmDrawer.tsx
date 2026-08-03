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

export function FlowInstallConfirmDrawer({ flow, onConfirm, onClose }: FlowInstallConfirmDrawerProps) {
  const { level, capabilities } = analyzeFlowCapabilities(flow.steps || []);

  return (
    <div className="p-6 md:p-8 text-white font-satoshi flex flex-col gap-6 relative select-none max-h-[70vh] overflow-y-auto scrollbar-thin">
      <div className="flex justify-between items-center relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20 text-[#A855F7]">
            <Download size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-white font-clash tracking-tight">
              Install Flow
            </h3>
            <p className="text-[10px] text-white/45 font-bold uppercase tracking-wider font-clash mt-0.5">
              Capability Review
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-white/50 hover:text-white transition rounded-lg hover:bg-white/5 border border-white/5"
        >
          <X size={18} />
        </button>
      </div>

      <div className="rounded-2xl bg-[#0A0908] border border-white/[0.06] p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-clash font-extrabold text-base text-white">{flow.name}</span>
          {flow.publisher?.verified && (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <BadgeCheck size={12} /> Verified
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 leading-relaxed font-satoshi">
          {flow.description || 'No description provided.'}
        </p>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-white/35 font-mono">
          <span>By {flow.publisher?.handle || '@user'}</span>
          <span>· {flow.steps.length} step(s)</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-black text-white/40 tracking-wider uppercase font-clash">
          Permissions & Capabilities
        </span>
        <div className="space-y-2">
          {capabilities.map((cap, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-white/80 bg-[#161412] p-3 rounded-xl border border-white/[0.05]">
              <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{cap}</span>
            </div>
          ))}
        </div>
      </div>

      {level === 'elevated' && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-amber-300 text-xs">
          <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <span>
            This flow contains elevated automated steps. Review step definitions if installing from untrusted creators.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-2">
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm bg-[#A855F7] hover:bg-[#9333EA] text-white cursor-pointer transition shadow-[0_4px_14px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2"
        >
          <Download size={16} />
          <span>Confirm & Install</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-xs text-white/45 hover:text-white transition hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
