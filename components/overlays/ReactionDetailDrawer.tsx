'use client';

import React from 'react';
import { Heart, Zap, Repeat2, User, Globe, Shield, ArrowRight, X } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useRouter } from 'next/navigation';

export interface ReactionDetailData {
  actor?: {
    name?: string;
    username?: string;
    avatar?: string;
    isNostr?: boolean;
    npub?: string;
    pubkey?: string;
    userId?: string;
  };
  title?: string;
  message?: string;
  time?: string;
  category?: 'likes' | 'replies' | 'follows' | 'system';
  actionHref?: string;
  emoji?: string;
}

export function ReactionDetailDrawer({
  data,
  onClose,
}: {
  data?: ReactionDetailData;
  onClose: () => void;
}) {
  const router = useRouter();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();

  const actor = data?.actor;
  const name = actor?.name || 'Someone';
  const username = actor?.username || (actor?.npub ? `npub…${actor.npub.slice(-8)}` : undefined);
  const avatar = actor?.avatar;
  const isNostr = Boolean(actor?.isNostr || actor?.npub || actor?.pubkey);
  const emoji = data?.emoji || '❤️';

  const isZap = data?.title?.toLowerCase().includes('zap') || data?.message?.toLowerCase().includes('zap');
  const isRepost = data?.title?.toLowerCase().includes('boost') || data?.title?.toLowerCase().includes('repost');

  const handleViewProfile = () => {
    openUnifiedDrawer('profile-preview', {
      userId: actor?.userId,
      username: actor?.username || actor?.name,
      name: actor?.name,
      avatar: actor?.avatar,
      npub: actor?.npub,
      pubkey: actor?.pubkey,
      source: isNostr ? 'nostr' : 'ecosystem',
    });
  };

  const handleOpenPost = () => {
    onClose();
    if (data?.actionHref) {
      router.push(data.actionHref);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161412] text-white p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          {isZap ? (
            <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <Zap size={16} className="fill-amber-400" />
            </span>
          ) : isRepost ? (
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Repeat2 size={16} />
            </span>
          ) : (
            <span className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400">
              <Heart size={16} className="fill-rose-400" />
            </span>
          )}
          <span className="text-sm font-extrabold font-clash">
            {isZap ? 'Lightning Zap' : isRepost ? 'Post Repost' : 'Reaction Details'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Actor Identity Card */}
      <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-[#1C1A18] border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-black text-amber-400">
              {name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-sm font-extrabold text-white font-satoshi truncate m-0">
              {name}
            </h4>
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] font-bold uppercase text-white/40 font-mono">
              {isNostr ? <Globe size={10} className="text-amber-400" /> : <Shield size={10} className="text-emerald-400" />}
              {isNostr ? 'Nostr' : 'Kylrix'}
            </span>
          </div>
          {username && (
            <p className="text-xs text-white/40 font-mono truncate m-0 mt-0.5">
              {username.startsWith('@') || username.startsWith('npub') ? username : `@${username}`}
            </p>
          )}
        </div>

        <div className="shrink-0 text-2xl">
          {isZap ? '⚡' : isRepost ? '🔁' : emoji}
        </div>
      </div>

      {/* Context note */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-white/60 space-y-1">
        <p className="m-0 font-medium leading-relaxed">
          {data?.message || `${name} interacted with your post.`}
        </p>
        {data?.time && (
          <p className="m-0 text-[10px] text-white/30 font-mono">
            {data.time}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-2">
        <button
          type="button"
          onClick={handleViewProfile}
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-bold text-white transition-colors"
        >
          <User size={14} /> View Profile
        </button>
        <button
          type="button"
          onClick={handleOpenPost}
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-amber-400 text-black text-xs font-black hover:bg-amber-300 transition-colors"
        >
          View Post <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
