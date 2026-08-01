'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useUnlockOnDemand } from '@/hooks/useUnlockOnDemand';

/**
 * Security setting: suppress auto MasterPass prompts (default ON).
 */
export function UnlockOnDemandSettings() {
  const { unlockOnDemand, loading, setUnlockOnDemand } = useUnlockOnDemand();
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    if (saving || loading) return;
    setSaving(true);
    try {
      await setUnlockOnDemand(!unlockOnDemand);
      toast.success(
        !unlockOnDemand
          ? 'Unlock prompts only when you open a locked item'
          : 'Unlock may prompt when you open secure areas'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Could not update setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
            Ask only on open
          </h3>
          <p className="text-[10px] text-white/40 font-bold mt-1 leading-relaxed">
            Don&apos;t ask for unlock until you open a locked item or do something that needs it.
            Visiting Vault or a secure tab alone won&apos;t prompt.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void toggle()}
          className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold border-none shrink-0 disabled:opacity-40 ${
            unlockOnDemand
              ? 'bg-[#6366F1] text-white cursor-pointer'
              : 'bg-[#0A0908] text-white/70 cursor-pointer'
          }`}
          aria-pressed={unlockOnDemand}
        >
          {unlockOnDemand ? 'On' : 'Off'}
        </button>
      </div>
    </section>
  );
}
