'use client';

import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

const CONFIRM_ZAP_KEY = 'kylrix_confirm_before_zap_v1';

export function isConfirmBeforeZapEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(CONFIRM_ZAP_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setConfirmBeforeZapEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIRM_ZAP_KEY, String(enabled));
  } catch {}
}

export function ZapSecuritySettings() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isConfirmBeforeZapEnabled());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setConfirmBeforeZapEnabled(next);
  };

  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
              Confirm before zap
            </h3>
          </div>
          <p className="text-[10px] text-white/35 font-bold mt-1 font-satoshi">
            Prompt drawer confirmation before dispatching ecosystem token micro-zaps
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold border-none cursor-pointer font-mono transition-colors ${
            enabled ? 'bg-[#F59E0B] text-black' : 'bg-[#0A0908] text-white/40'
          }`}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-[16px] bg-[#0A0908] border border-white/[0.04] px-3.5 py-3.5">
        <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#F59E0B] shrink-0">
          <Zap className="w-4 h-4 fill-current" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">Global Ecosystem Zap Safeguard</p>
          <p className="mt-1 text-[11px] text-white/40 font-satoshi">
            {enabled
              ? 'Active — prompts amount confirmation before rix transfer'
              : 'Direct mode — 1-click instant zaps without confirmation'}
          </p>
        </div>
      </div>
    </section>
  );
}
