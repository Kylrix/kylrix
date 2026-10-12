'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

const HARD_VERIFICATION_KEY = 'kylrix_hard_verification_enabled';

export function isHardVerificationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(HARD_VERIFICATION_KEY);
  return stored === null ? true : stored === '1';
}

export function setHardVerificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HARD_VERIFICATION_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new Event('kylrix:security-settings-changed'));
}

export function HardVerificationSettings() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isHardVerificationEnabled());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setHardVerificationEnabled(next);
    toast.success(
      next
        ? 'Hard verification enabled (always confirms sensitive agentic actions)'
        : 'Smart verification enabled (only prompts when vault is locked)'
    );
  };

  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
              Agentic Hard Verification
            </h3>
          </div>
          <p className="text-[10px] text-white/35 font-bold mt-1 leading-relaxed">
            When enabled, Kylie asks for explicit confirmation even if your vault is already unlocked. Turn off to only prompt when locked.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold border-none cursor-pointer ${
            enabled ? 'bg-[#6366F1] text-white' : 'bg-[#0A0908] text-white/40'
          }`}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-[16px] bg-[#0A0908] border border-white/[0.04] px-3.5 py-3.5">
        <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1] shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">Action Safeguard Mode</p>
          <p className="mt-1 text-[11px] text-white/40 font-satoshi">
            {enabled
              ? 'Rigorous — verifies every on-chain transfer and balance read in agentic flows'
              : 'Relaxed — uses session unlock state directly without redundant confirmations'}
          </p>
        </div>
      </div>
    </section>
  );
}
