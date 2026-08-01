'use client';

import React, { useEffect, useState } from 'react';
import {
  DEFAULT_REMEMBER_UNLOCK_PREFS,
  REMEMBER_UNLOCK_DURATION_OPTIONS,
  REMEMBER_UNLOCK_MAX_HOURS,
  readRememberUnlockPrefs,
  resolveRememberUnlockHours,
  writeRememberUnlockPrefs,
  type RememberUnlockDurationId,
  type RememberUnlockPrefs,
} from '@/lib/security/remember-unlock';

/** Preference-only — not wired to vault unlock yet. */
export function RememberUnlockSettings() {
  const [prefs, setPrefs] = useState<RememberUnlockPrefs>(DEFAULT_REMEMBER_UNLOCK_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(readRememberUnlockPrefs());
    setHydrated(true);
  }, []);

  const save = (patch: Partial<Omit<RememberUnlockPrefs, 'updatedAt'>>) => {
    setPrefs(writeRememberUnlockPrefs(patch));
  };

  const hours = resolveRememberUnlockHours(prefs);

  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
            Remember unlock
          </h3>
          <p className="text-[10px] text-amber-400/80 font-bold mt-0.5">Less safe</p>
        </div>
        <button
          type="button"
          disabled={!hydrated}
          onClick={() => save({ enabled: !prefs.enabled })}
          className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border-none ${
            prefs.enabled ? 'bg-amber-500 text-black' : 'bg-[#0A0908] text-white/70'
          }`}
        >
          {prefs.enabled ? 'On' : 'Off'}
        </button>
      </div>

      {prefs.enabled ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {REMEMBER_UNLOCK_DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => save({ durationId: opt.id as RememberUnlockDurationId })}
                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                  prefs.durationId === opt.id
                    ? 'bg-[#6366F1]/20 border-[#6366F1]/40 text-[#A5B4FC]'
                    : 'bg-[#0A0908] border-white/[0.06] text-white/55'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {prefs.durationId === 'custom' ? (
            <div className="flex items-center gap-2 rounded-[16px] bg-[#0A0908] border border-white/[0.04] px-3 py-2">
              <input
                type="number"
                min={1}
                max={REMEMBER_UNLOCK_MAX_HOURS}
                value={prefs.customHours}
                onChange={(e) =>
                  save({
                    customHours: Number(e.target.value) || 1,
                    durationId: 'custom',
                  })
                }
                className="w-20 rounded-lg bg-[#161412] border border-white/10 px-2 py-1.5 text-xs font-bold text-white outline-none"
              />
              <span className="text-[11px] text-white/40">hours · max {REMEMBER_UNLOCK_MAX_HOURS}</span>
            </div>
          ) : (
            <p className="text-[10px] text-white/35 px-0.5">{hours}h · not applied yet</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
