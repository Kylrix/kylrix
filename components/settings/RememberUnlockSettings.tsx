'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
import { 
  enableConvenienceModeAction, 
  disableConvenienceModeAction, 
  resolveConvenienceMekAction 
} from '@/lib/actions/secure-ops';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import toast from 'react-hot-toast';

export function RememberUnlockSettings() {
  const [prefs, setPrefs] = useState<RememberUnlockPrefs>(DEFAULT_REMEMBER_UNLOCK_PREFS);
  const [serverActive, setServerActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { requestSudo } = useSudo();

  const syncStatus = useCallback(async () => {
    try {
      const res = await resolveConvenienceMekAction();
      setServerActive(Boolean(res?.active));
      setExpiresAt(res?.expiresAt || null);
    } catch {}
  }, []);

  useEffect(() => {
    setPrefs(readRememberUnlockPrefs());
    void syncStatus();
  }, [syncStatus]);

  const handleToggle = async () => {
    if (serverActive || prefs.enabled) {
      // Disable convenience mode
      setLoading(true);
      try {
        await disableConvenienceModeAction();
        setServerActive(false);
        setExpiresAt(null);
        setPrefs(writeRememberUnlockPrefs({ enabled: false }));
        toast.success('Convenience unlock disabled');
      } catch (err: any) {
        toast.error(err?.message || 'Failed to disable convenience mode');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Enable convenience mode
    requestSudo({
      onSuccess: async () => {
        setLoading(true);
        try {
          const masterKey = ecosystemSecurity.getMasterKey();
          if (!masterKey) {
            toast.error('Unlock vault first to enable convenience mode');
            setLoading(false);
            return;
          }

          const rawMek = await window.crypto.subtle.exportKey('raw', masterKey);
          const rawMekBase64 = btoa(String.fromCharCode(...new Uint8Array(rawMek)));

          let durationSecs: number | null = null;
          if (prefs.durationId !== 'indefinite') {
            const h = resolveRememberUnlockHours(prefs);
            durationSecs = h * 3600;
          }

          const res = await enableConvenienceModeAction({
            rawUserMekBase64: rawMekBase64,
            durationSeconds: durationSecs
          });

          setServerActive(true);
          setExpiresAt(res.expiresAt || null);
          setPrefs(writeRememberUnlockPrefs({ enabled: true }));
          toast.success('Convenience unlock enabled (server-sealed for background agents)');
        } catch (err: any) {
          toast.error(err?.message || 'Failed to enable convenience mode');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDurationChange = async (durationId: RememberUnlockDurationId) => {
    const updated = writeRememberUnlockPrefs({ durationId });
    setPrefs(updated);

    if (serverActive) {
      const masterKey = ecosystemSecurity.getMasterKey();
      if (masterKey) {
        try {
          const rawMek = await window.crypto.subtle.exportKey('raw', masterKey);
          const rawMekBase64 = btoa(String.fromCharCode(...new Uint8Array(rawMek)));
          let durationSecs: number | null = null;
          if (durationId !== 'indefinite') {
            const h = resolveRememberUnlockHours(updated);
            durationSecs = h * 3600;
          }
          const res = await enableConvenienceModeAction({
            rawUserMekBase64: rawMekBase64,
            durationSeconds: durationSecs
          });
          setExpiresAt(res.expiresAt || null);
          toast.success('Unlock duration updated');
        } catch {}
      }
    }
  };

  const hours = resolveRememberUnlockHours(prefs);
  const isEnabled = serverActive || prefs.enabled;

  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
              Remember unlock (Convenience Mode)
            </h3>
            {serverActive && (
              <span className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md">
                Active
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/35 font-bold mt-1">
            Enables background AI agents to operate seamlessly without manual password prompts.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={handleToggle}
          className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold border-none transition-colors ${
            isEnabled
              ? 'bg-amber-500 text-black cursor-pointer'
              : 'bg-[#0A0908] text-white/70 hover:text-white cursor-pointer'
          }`}
        >
          {loading ? '…' : isEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {isEnabled && (
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {REMEMBER_UNLOCK_DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleDurationChange(opt.id as RememberUnlockDurationId)}
                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer border transition-colors ${
                  prefs.durationId === opt.id
                    ? 'bg-[#6366F1]/20 border-[#6366F1]/40 text-[#A5B4FC]'
                    : 'bg-[#0A0908] border-white/[0.06] text-white/55 hover:text-white'
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
                onChange={(e) => {
                  const h = Number(e.target.value) || 1;
                  setPrefs(writeRememberUnlockPrefs({ customHours: h, durationId: 'custom' }));
                }}
                className="w-20 rounded-lg bg-[#161412] border border-white/10 px-2 py-1.5 text-xs font-bold text-white outline-none"
              />
              <span className="text-[11px] text-white/40">hours · max {REMEMBER_UNLOCK_MAX_HOURS}</span>
            </div>
          ) : (
            <p className="text-[10px] text-white/35 px-0.5">
              {prefs.durationId === 'indefinite' ? 'Indefinite duration (stays active until turned off)' : `${hours} hours duration`}
              {expiresAt ? ` · Expires: ${new Date(expiresAt).toLocaleString()}` : ''}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
