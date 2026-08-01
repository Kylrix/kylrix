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
import { probeAppMek } from '@/lib/security/app-mek';

/**
 * Security tab control for Remember Unlock.
 * Saves preference only — does not keep the vault unlocked yet.
 */
export function RememberUnlockSettings() {
  const [prefs, setPrefs] = useState<RememberUnlockPrefs>(DEFAULT_REMEMBER_UNLOCK_PREFS);
  const [hydrated, setHydrated] = useState(false);
  const mek = probeAppMek();

  useEffect(() => {
    setPrefs(readRememberUnlockPrefs());
    setHydrated(true);
  }, []);

  const save = (patch: Partial<Omit<RememberUnlockPrefs, 'updatedAt'>>) => {
    setPrefs(writeRememberUnlockPrefs(patch));
  };

  const hours = resolveRememberUnlockHours(prefs);

  return (
    <div id="remember-unlock" className="space-y-4">
      <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
        Remember Unlock
      </h2>
      <div className="bg-[#161412] border border-amber-500/20 rounded-[32px] p-6 md:p-8 space-y-5">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <p className="text-amber-200 text-xs font-bold leading-relaxed">
            Warning: this is less safe. If someone has your device, they may open private
            data without your master password until the timer ends. Leave this off unless
            you accept that risk.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 className="text-base font-extrabold text-white mb-1">Remember Unlock</h4>
            <p className="text-xs text-[#9B9691] leading-relaxed max-w-[540px]">
              After you unlock once, skip master-password prompts for a while.
              Preference only for now — vault crypto is not changed yet.
            </p>
          </div>
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => save({ enabled: !prefs.enabled })}
            className={`py-3 px-5 rounded-xl font-black text-xs transition-all cursor-pointer flex-shrink-0 border-none ${
              prefs.enabled
                ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
            }`}
          >
            {prefs.enabled ? 'On' : 'Off'}
          </button>
        </div>

        {prefs.enabled && (
          <div className="space-y-3 pt-1 border-t border-white/5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/45">
              How long
            </label>
            <div className="flex flex-wrap gap-2">
              {REMEMBER_UNLOCK_DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => save({ durationId: opt.id as RememberUnlockDurationId })}
                  className={`py-2 px-3.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                    prefs.durationId === opt.id
                      ? 'bg-[#6366F1]/20 border-[#6366F1]/40 text-[#A5B4FC]'
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {prefs.durationId === 'custom' && (
              <div className="flex items-center gap-3">
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
                  className="w-24 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-[#6366F1]/50"
                />
                <span className="text-xs text-[#9B9691] font-semibold">
                  hours (max {REMEMBER_UNLOCK_MAX_HOURS})
                </span>
              </div>
            )}

            <p className="text-[11px] text-white/35 font-semibold">
              Selected window: {hours} hour{hours === 1 ? '' : 's'}. Not applied to unlock
              prompts until this feature is connected.
            </p>
          </div>
        )}

        <p className="text-[10px] text-white/25 font-mono leading-relaxed">
          App wrap key probe: {mek.runtime} · public=
          {mek.publicKeyPresent ? 'yes' : 'no'} · usable=
          {mek.usableInThisRuntime ? 'yes' : 'no'} (foundation only)
        </p>
      </div>
    </div>
  );
}
