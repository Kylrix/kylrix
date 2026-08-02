'use client';

import React, { useEffect, useState } from 'react';
import { Globe, Lock } from 'lucide-react';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';

const PREF_KEY = 'f_sync_to_nostr_pref';

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-[#F59E0B]' : 'bg-white/10'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/** Sync-to-Nostr preference — LocalEngine only (0ms UI), vault-gated. */
export function SyncToNostrSettings() {
  const { isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void LocalEngine.cacheGet<boolean>(PREF_KEY).then((pref) => {
      if (pref !== null && pref !== undefined) setEnabled(Boolean(pref));
      setHydrated(true);
    });
  }, []);

  const persist = (next: boolean) => {
    setEnabled(next);
    void LocalEngine.cacheSet(PREF_KEY, next);
  };

  const locked = isVaultLocked;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
        Moments & relays
      </h3>
      <div
        className={`flex items-center justify-between gap-4 p-5 border rounded-2xl transition-all ${
          locked
            ? 'bg-white/[0.02] border-white/5 opacity-90'
            : 'bg-white/[0.02] border-white/5 hover:bg-[#1F1D1B] hover:border-white/10'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              enabled && !locked
                ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                : 'bg-white/5 border-white/5 text-white/40'
            }`}
          >
            <Globe size={18} />
          </div>
          <div className="space-y-1 min-w-0">
            <h4 className="text-sm font-extrabold text-white">Sync moments to Nostr</h4>
            <p className="text-xs text-[#9B9691]">
              When you publish a moment, also broadcast it to public relays.
            </p>
            {locked ? (
              <p className="text-[11px] font-bold text-[#F59E0B]/90 pt-1 flex items-center gap-1.5">
                <Lock size={12} />
                Unlock vault to sync to Nostr
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {locked ? (
            <button
              type="button"
              onClick={() => void unlockAndLoad()}
              className="px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-[10px] font-bold hover:bg-[#F59E0B]/20 transition-all"
            >
              Unlock
            </button>
          ) : null}
          <Switch
            checked={enabled}
            disabled={!hydrated || locked}
            onChange={persist}
          />
        </div>
      </div>
    </div>
  );
}
