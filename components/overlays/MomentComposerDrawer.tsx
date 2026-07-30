'use client';

import React, { useState, useEffect } from 'react';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { SocialService } from '@/lib/services/social';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { Lock, Sparkles, Send, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

interface MomentComposerDrawerProps {
  onClose: () => void;
}

export function MomentComposerDrawer({ onClose }: MomentComposerDrawerProps) {
  const { user } = useAuth();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { publishPost } = useNostrFeed();
  const [content, setContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [syncToNostr, setSyncToNostr] = useState(false);

  // Hydrate user preference for Sync to Nostr from LocalEngine (0ms)
  useEffect(() => {
    void (async () => {
      const pref = await LocalEngine.cacheGet<boolean>('f_sync_to_nostr_pref');
      if (pref !== null && pref !== undefined) {
        setSyncToNostr(Boolean(pref));
      }
    })();
  }, []);

  const handleToggleSyncToNostr = (checked: boolean) => {
    setSyncToNostr(checked);
    void LocalEngine.cacheSet('f_sync_to_nostr_pref', checked);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user?.$id) return;

    setPublishing(true);
    try {
      // 1. Always create moment in Kylrix Ecosystem local copy & database
      const createdMoment = await SocialService.createMoment(
        user.$id,
        content.trim(),
        'post',
        [],
        'public'
      );

      // Save to local moments cache for instant 0ms feed update
      if (createdMoment) {
        const cachedMoments = (await LocalEngine.cacheGet<any[]>('f_moments_list')) || [];
        await LocalEngine.cacheSet('f_moments_list', [createdMoment, ...cachedMoments]);
      }

      // 2. Optionally sync to Nostr if enabled AND vault is unlocked
      let nostrSynced = false;
      if (syncToNostr && !isVaultLocked && identity) {
        nostrSynced = await publishPost(content.trim());
      }

      toast.success(
        nostrSynced
          ? 'Published to Kylrix ecosystem & Nostr relays!'
          : 'Published to Kylrix moments feed!'
      );

      setContent('');
      onClose();
    } catch (err) {
      console.error('Failed to create moment:', err);
      toast.error('Failed to publish moment');
    } finally {
      setPublishing(false);
    }
  };

  const isNostrActive = syncToNostr && !isVaultLocked;

  return (
    <div className="w-full bg-[#0B0A09] text-white p-6 font-satoshi flex flex-col gap-5 rounded-t-3xl border-t border-white/10 max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-[#F59E0B] flex items-center gap-1.5 font-clash">
          <Sparkles size={16} />
          Create Moment
        </h3>
        <button onClick={onClose} className="text-xs text-white/40 hover:text-white transition-all font-bold">
          Cancel
        </button>
      </div>

      <form onSubmit={handlePublish} className="flex flex-col gap-4">
        {/* Post Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening in your engineering workflow?"
          rows={4}
          className="w-full bg-[#161412] border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-[#F59E0B] transition-all resize-none placeholder:text-white/30"
          autoFocus
        />

        {/* Sync to Nostr Toggle & Vault Safety Gate */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#161412] border border-white/5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${isNostrActive ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]' : 'bg-white/5 border-white/5 text-white/40'}`}>
              <Globe size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white/90">Sync to Nostr Relays</span>
              <span className="text-[11px] text-white/40">Broadcast post to global decentralized Nostr network.</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isVaultLocked && syncToNostr && (
              <button
                type="button"
                onClick={unlockAndLoad}
                className="px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-[10px] font-bold flex items-center gap-1 hover:bg-[#F59E0B]/20 transition-all"
                title="Unlock vault to sign Nostr post"
              >
                <Lock size={12} /> Unlock Vault
              </button>
            )}

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={syncToNostr && !isVaultLocked}
                disabled={isVaultLocked}
                onChange={(e) => handleToggleSyncToNostr(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F59E0B] peer-disabled:opacity-50" />
            </label>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={publishing || !content.trim()}
            className="px-6 py-2.5 bg-[#F59E0B] hover:bg-amber-600 disabled:opacity-50 text-black font-extrabold text-sm rounded-xl transition-all shadow-lg flex items-center gap-2"
          >
            {publishing ? (
              <span className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
            ) : (
              <Send size={16} />
            )}
            Publish Moment
          </button>
        </div>
      </form>
    </div>
  );
}
