'use client';

import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import {
  isFlowConfirmPromptEnabled,
  setFlowConfirmPromptEnabled,
} from '@/components/flows/FlowInstallConfirmDrawer';

export function FlowInstallSecuritySettings() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isFlowConfirmPromptEnabled());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setFlowConfirmPromptEnabled(next);
  };

  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
              Flow Installation Safeguard
            </h3>
          </div>
          <p className="text-[10px] text-white/35 font-bold mt-1">
            Prompt capability & permission review drawer before installing new flows
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold border-none cursor-pointer ${
            enabled ? 'bg-[#A855F7] text-white' : 'bg-[#0A0908] text-white/40'
          }`}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-[16px] bg-[#0A0908] border border-white/[0.04] px-3.5 py-3.5">
        <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#A855F7] shrink-0">
          <Layers className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">Flow Capability Prompts</p>
          <p className="mt-1 text-[11px] text-white/40 font-satoshi">
            {enabled
              ? 'Active — bottom drawer peruses permissions before installing'
              : 'Disabled — flows install directly without confirmation'}
          </p>
        </div>
      </div>
    </section>
  );
}
