'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Timer } from 'lucide-react';
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

/**
 * Security tab control for Remember Unlock.
 * Saves preference only — does not keep the vault unlocked yet.
 */
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
    <section id="remember-unlock" className="flex flex-col gap-2">
      <span className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase">
        Remember unlock
      </span>
      <div className="p-4 rounded-[20px] bg-[#0A0908] border border-amber-500/20 shadow-[0_8px_24px_rgba(0,0,0,0.45)] flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <p className="text-amber-100/90 text-xs font-semibold font-satoshi leading-relaxed">
            Less safe. Anyone with this device could open private data until the timer
            ends. Keep this off unless you accept that risk.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 shrink-0">
            <Timer className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white leading-tight">Skip unlock prompts</h3>
            <p className="text-xs text-[#8E8A86] mt-1 font-satoshi leading-relaxed">
              After you unlock once, stay unlocked for a while. Preference saved now —
              vault behavior is not changed yet.
            </p>
          </div>
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => save({ enabled: !prefs.enabled })}
            className={`py-2.5 px-4 rounded-[12px] font-bold text-xs font-satoshi transition-all cursor-pointer flex-shrink-0 border-none ${
              prefs.enabled
                ? 'bg-amber-500 hover:bg-amber-600 text-black'
                : 'bg-[#1C1A18] hover:bg-[#242220] border border-[#34322F] text-white'
            }`}
          >
            {prefs.enabled ? 'On' : 'Off'}
          </button>
        </div>

        {prefs.enabled && (
          <div className="space-y-3 pt-1 border-t border-white/[0.04]">
            <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase">
              How long
            </span>
            <div className="flex flex-wrap gap-2">
              {REMEMBER_UNLOCK_DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => save({ durationId: opt.id as RememberUnlockDurationId })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold font-satoshi transition-all border cursor-pointer ${
                    prefs.durationId === opt.id
                      ? 'bg-[#6366F1]/20 border-[#6366F1]/40 text-[#A5B4FC]'
                      : 'bg-[#161412] border-white/[0.06] text-white/65 hover:bg-[#1C1A18]'
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
                  className="w-24 rounded-xl bg-[#161412] border border-[#34322F] px-3 py-2 text-sm font-bold text-white outline-none focus:border-[#6366F1]/50"
                />
                <span className="text-xs text-[#8E8A86] font-semibold font-satoshi">
                  hours (max {REMEMBER_UNLOCK_MAX_HOURS})
                </span>
              </div>
            )}

            <p className="text-[11px] text-[#8E8A86] font-satoshi">
              Selected: {hours} hour{hours === 1 ? '' : 's'} (not applied to prompts yet)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
