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

/** Preference UI only — vault wiring not connected. Disabled as coming soon. */
export function RememberUnlockSettings() {
  const [prefs, setPrefs] = useState<RememberUnlockPrefs>(DEFAULT_REMEMBER_UNLOCK_PREFS);

  useEffect(() => {
    setPrefs(readRememberUnlockPrefs());
  }, []);

  const save = (patch: Partial<Omit<RememberUnlockPrefs, 'updatedAt'>>) => {
    setPrefs(writeRememberUnlockPrefs(patch));
  };

  const hours = resolveRememberUnlockHours(prefs);
  const comingSoon = true;

  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
              Remember unlock
            </h3>
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-amber-400/90 bg-[#0A0908] border border-amber-500/25 px-1.5 py-0.5 rounded-md">
              Coming soon
            </span>
          </div>
          <p className="text-[10px] text-white/35 font-bold mt-1">Less safe when enabled</p>
        </div>
        <button
          type="button"
          disabled={comingSoon}
          onClick={() => save({ enabled: !prefs.enabled })}
          className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold border-none ${
            comingSoon
              ? 'bg-[#0A0908] text-white/30 cursor-not-allowed'
              : prefs.enabled
                ? 'bg-amber-500 text-black cursor-pointer'
                : 'bg-[#0A0908] text-white/70 cursor-pointer'
          }`}
        >
          {prefs.enabled && !comingSoon ? 'On' : 'Off'}
        </button>
      </div>

      {!comingSoon && prefs.enabled ? (
        <div className="space-y-2.5">
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
            <div className="flex items-center gap-2 rounded-[16px] bg-[#0A0908] border border-white/[0.04] px-3 py-2.5">
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
            <p className="text-[10px] text-white/35 px-0.5">{hours}h</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
