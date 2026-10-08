'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { UserPlus, Check, Trash2, Loader2, ArrowRightLeft, Shield, Sparkles } from 'lucide-react';

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

interface AccountGroup {
  userId: string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  sessions: DeviceSession['session'][];
  isCurrent: boolean;
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
    openUnified('login', { mode: 'add-account', isAddAccount: true });
  };

  const currentEmail = user?.email?.toLowerCase();
  const currentId = user?.$id;

  // Group device sessions by distinct user accounts
  const accountGroupsMap = new Map<string, AccountGroup>();

  // Ensure current logged-in account is always represented first
  if (currentId || user?.email) {
    const primaryKey = currentId || currentEmail || 'current';
    accountGroupsMap.set(primaryKey, {
      userId: currentId || 'current',
      user: {
        id: currentId || 'current',
        name: user?.name,
        email: user?.email,
        image: user?.image,
      },
      sessions: [],
      isCurrent: true,
    });
  }

  // Populate sessions into account groups
  deviceSessions.forEach((ds) => {
    const isCurrent =
      (currentId && ds.user.id === currentId) ||
      (currentEmail && ds.user.email?.toLowerCase() === currentEmail);
    const key = ds.user.id || ds.user.email?.toLowerCase() || ds.session.token;

    if (!accountGroupsMap.has(key)) {
      accountGroupsMap.set(key, {
        userId: ds.user.id,
        user: ds.user,
        sessions: [ds.session],
        isCurrent,
      });
    } else {
      const existing = accountGroupsMap.get(key)!;
      existing.sessions.push(ds.session);
      if (isCurrent) existing.isCurrent = true;
    }
  });

  const accountGroups = Array.from(accountGroupsMap.values());

  return (
    <div className="w-full flex flex-col gap-2.5 select-none font-satoshi">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Shield size={13} className="text-[#EC4899]" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white/70">
              Active Accounts on Device
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-md">
            {accountGroups.length} {accountGroups.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>
      )}

      {/* Account Containers */}
      <div className="flex flex-col gap-2">
        {accountGroups.map((acc) => {
          const isCurrent = acc.isCurrent;
          const displayName = acc.user.name || acc.user.email?.split('@')[0] || 'Kylrix User';
          const displayEmail = acc.user.email || 'No email';
          const primaryToken = acc.sessions[0]?.token;
          const isSwitching = primaryToken ? switchingToken === primaryToken : false;
          const isRevoking = primaryToken ? revokingToken === primaryToken : false;

          return (
            <div
              key={acc.userId || acc.user.email}
              className={`flex flex-col p-3 rounded-2xl border transition-all ${
                isCurrent
                  ? 'bg-white/[0.04] border-[#EC4899]/30 shadow-sm shadow-[#EC4899]/5'
                  : 'bg-black/40 hover:bg-white/[0.03] border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2.5">
                {/* User Identity Details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                      isCurrent
                        ? 'bg-[#EC4899]/20 border-[#EC4899]/40 text-[#EC4899]'
                        : 'bg-white/[0.08] border-white/10 text-white/80'
                    }`}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white truncate leading-tight">
                      {displayName}
                    </span>
                    <span className="text-[11px] text-white/45 truncate font-mono mt-0.5">
                      {displayEmail}
                    </span>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isCurrent ? (
                    <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Check size={10} strokeWidth={3} />
                      Active
                    </span>
                  ) : primaryToken ? (
                    <>
                      <button
                        type="button"
                        disabled={isSwitching}
                        onClick={() => handleSwitch(primaryToken)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-xl bg-white/10 hover:bg-[#EC4899] hover:text-white text-white/90 border border-white/10 hover:border-transparent transition-all cursor-pointer"
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
                        title="Remove session from this device"
                        disabled={isRevoking}
                        onClick={(e) => handleRevoke(primaryToken, e)}
                        className="p-1.5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                      >
                        {isRevoking ? (
                          <Loader2 size={12} className="animate-spin text-rose-400" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Session Meta Info */}
              {acc.sessions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono text-white/35 px-0.5">
                  <span>{acc.sessions.length} device {acc.sessions.length === 1 ? 'session' : 'sessions'}</span>
                  <span>{isCurrent ? 'Current active session' : 'Ready to activate'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Account Button */}
      <button
        type="button"
        onClick={handleAddAccount}
        className="w-full mt-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl border border-dashed border-white/20 hover:border-[#EC4899]/50 bg-white/[0.02] hover:bg-[#EC4899]/5 text-white/70 hover:text-white text-xs font-bold transition-all cursor-pointer"
      >
        <UserPlus size={13} className="text-[#EC4899]" />
        <span>Add another account</span>
      </button>
    </div>
  );
}

