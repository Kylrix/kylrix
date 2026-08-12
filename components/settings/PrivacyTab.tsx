'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, Circle, ShieldCheck } from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/context/auth/AuthContext';
import toast from 'react-hot-toast';

type PrivacyPrefs = {
  typingEnabled?: boolean;
  onlineEnabled?: boolean;
};

function getPrefs(profile: any): PrivacyPrefs {
  try {
    const raw = typeof profile?.preferences === 'string' ? JSON.parse(profile.preferences) : profile?.preferences || {};
    return { typingEnabled: raw.typingEnabled ?? true, onlineEnabled: raw.onlineEnabled ?? true };
  } catch { return { typingEnabled: true, onlineEnabled: true }; }
}

export function PrivacyTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PrivacyPrefs>({ typingEnabled: true, onlineEnabled: true });

  const load = useCallback(async () => {
    if (!user?.$id) return;
    setLoading(true);
    try {
      const profile: any = await UsersService.getProfileById(user.$id);
      setPrefs(getPrefs(profile));
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (key: keyof PrivacyPrefs, val: boolean) => {
    if (!user?.$id) return;
    setSaving(key);
    const next = { ...prefs, [key]: val };
    // optimistic
    setPrefs(next);
    try {
      const profile: any = await UsersService.getProfileById(user.$id).catch(() => null);
      let raw: any = {};
      try { raw = typeof profile?.preferences === 'string' ? JSON.parse(profile.preferences) : profile?.preferences || {}; } catch {}
      const merged = { ...raw, [key]: val };
      await UsersService.updateProfile(user.$id, { preferences: JSON.stringify(merged) } as any);
      toast.success(key === 'typingEnabled' ? (val ? 'Typing indicators enabled' : 'Typing indicators disabled') : (val ? 'Online presence enabled' : 'Online presence disabled'));
    } catch (_e: any) {
      toast.error('Failed to save preference');
      setPrefs(prefs);
    }
    setSaving(null);
  };

  if (loading) return <div className="p-8 text-white/40 text-sm">Loading privacy settings…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black font-clash text-white tracking-tight">Privacy</h2>
        <p className="text-xs text-white/40 font-semibold mt-1">Control who sees your activity in direct chats. Changes are mutual — both participants must have a feature enabled to see it. Groups never show typing/online.</p>
      </div>

      <div className="bg-[#161412] border border-white/5 rounded-[28px] p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center"><ShieldCheck size={18} /></div>
          <div>
            <h3 className="text-white font-black text-sm">Connect — Direct Chats</h3>
            <p className="text-white/40 text-xs">Applies only to 1:1 hangouts. Enabled by default; turned off locally hides you and hides partner from you.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60"><Keyboard size={16} /></div>
              <div className="min-w-0">
                <div className="text-white font-bold text-sm">Typing indicators</div>
                <div className="text-white/40 text-xs leading-relaxed">Show when you are typing and see when partner is typing</div>
              </div>
            </div>
            <button
              type="button"
              disabled={!!saving}
              onClick={() => toggle('typingEnabled', !prefs.typingEnabled)}
              className={`relative w-[48px] h-[28px] rounded-full transition-all shrink-0 ${prefs.typingEnabled ? 'bg-[#6366F1]' : 'bg-white/10'}`}
              aria-pressed={!!prefs.typingEnabled}
            >
              <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${prefs.typingEnabled ? 'left-[23px]' : 'left-[3px]'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60"><Circle size={16} /></div>
              <div className="min-w-0">
                <div className="text-white font-bold text-sm">Online presence</div>
                <div className="text-white/40 text-xs leading-relaxed">Show when you are online and see partner online (Appwrite presence)</div>
              </div>
            </div>
            <button
              type="button"
              disabled={!!saving}
              onClick={() => toggle('onlineEnabled', !prefs.onlineEnabled)}
              className={`relative w-[48px] h-[28px] rounded-full transition-all shrink-0 ${prefs.onlineEnabled ? 'bg-[#6366F1]' : 'bg-white/10'}`}
              aria-pressed={!!prefs.onlineEnabled}
            >
              <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${prefs.onlineEnabled ? 'left-[23px]' : 'left-[3px]'}`} />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-white/30 leading-relaxed">Stored in your profile `preferences` JSON (`typingEnabled` / `onlineEnabled`, default `true`) so anyone fetching your profile can check mutual status before rendering indicators. Groups always suppress.</p>
      </div>
    </div>
  );
}
