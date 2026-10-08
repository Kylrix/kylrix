'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { UserPlus, Check, Trash2, Loader2, ArrowRightLeft, Shield } from 'lucide-react';

interface DeviceSession {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt?: string | Date;
  };
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AccountSwitcher({
  onSwitched,
  compact = false,
}: {
  onSwitched?: () => void;
  compact?: boolean;
}) {
  const { user, listDeviceSessions, switchAccount, revokeDeviceSession } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();

  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [_loading, setLoading] = useState(true);
  const [switchingToken, setSwitchingToken] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listDeviceSessions();
      setDeviceSessions(Array.isArray(list) ? list : []);
    } catch {
      setDeviceSessions([]);
    } finally {
      setLoading(false);
    }
  }, [listDeviceSessions]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions, user?.$id]);

  const handleSwitch = async (sessionToken: string) => {
    if (switchingToken) return;
    setSwitchingToken(sessionToken);
    try {
      const ok = await switchAccount(sessionToken);
      if (ok) {
        await fetchSessions();
        onSwitched?.();
      }
    } finally {
      setSwitchingToken(null);
    }
  };

  const handleRevoke = async (sessionToken: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (revokingToken) return;
    setRevokingToken(sessionToken);
    try {
      const ok = await revokeDeviceSession(sessionToken);
      if (ok) {
        await fetchSessions();
      }
    } finally {
      setRevokingToken(null);
    }
  };

  const handleAddAccount = () => {
    openUnified('login');
  };

  const currentEmail = user?.email?.toLowerCase();
  const currentId = user?.$id;

  // Filter out duplicate sessions for the same user if any
  const otherSessions = deviceSessions.filter((ds) => {
    const isCurrent = (currentId && ds.user.id === currentId) || (currentEmail && ds.user.email?.toLowerCase() === currentEmail);
    return !isCurrent;
  });

  return (
    <div className="w-full flex flex-col gap-2.5 select-none">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Shield size={13} className="text-[#EC4899]" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white/70">
              Multi-Account Sessions
            </span>
          </div>
          {deviceSessions.length > 1 && (
            <span className="text-[10px] font-mono font-bold text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded-md">
              {deviceSessions.length} active
            </span>
          )}
        </div>
      )}

      {/* Active Account Banner */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.12] rounded-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EC4899]/20 border border-[#EC4899]/40 text-[#EC4899] font-black text-xs flex items-center justify-center shrink-0">
            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white truncate leading-tight">
              {user?.name || user?.email?.split('@')[0] || 'Current User'}
            </span>
            <span className="text-[11px] text-white/50 truncate font-mono">
              {user?.email || 'Signed in'}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <Check size={10} strokeWidth={3} />
          Active
        </span>
      </div>

      {/* Other Accounts on Device */}
      {otherSessions.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[10px] font-mono uppercase font-bold text-white/40 px-1">
            Switch To Account
          </span>
          {otherSessions.map((ds) => {
            const isSwitching = switchingToken === ds.session.token;
            const isRevoking = revokingToken === ds.session.token;
            const displayName = ds.user.name || ds.user.email?.split('@')[0] || 'Kylrix Account';

            return (
              <div
                key={ds.session.id || ds.session.token}
                onClick={() => !isSwitching && handleSwitch(ds.session.token)}
                className="group flex items-center justify-between gap-2.5 p-2.5 bg-black/40 hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/20 rounded-xl transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-white/10 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white/90 truncate leading-tight group-hover:text-white">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-white/40 truncate font-mono">
                      {ds.user.email || 'Ready'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isSwitching}
                    onClick={() => handleSwitch(ds.session.token)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/10 hover:bg-[#EC4899] hover:text-white text-white/80 transition-colors"
                  >
                    {isSwitching ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <ArrowRightLeft size={11} />
                    )}
                    <span>Switch</span>
                  </button>

                  <button
                    type="button"
                    title="Remove account session from this device"
                    disabled={isRevoking}
                    onClick={(e) => handleRevoke(ds.session.token, e)}
                    className="p-1.5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    {isRevoking ? (
                      <Loader2 size={12} className="animate-spin text-rose-400" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Account Button */}
      <button
        type="button"
        onClick={handleAddAccount}
        className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-white/[0.02] hover:bg-white/[0.05] text-white/70 hover:text-white text-xs font-bold transition-all"
      >
        <UserPlus size={13} />
        <span>Add another account</span>
      </button>
    </div>
  );
}
