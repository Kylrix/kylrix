'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, Copy, MessageSquare, PhoneCall, X } from 'lucide-react';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { UsersService } from '@/lib/services/users';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityById } from '@/lib/identity-cache';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

/**
 * Native right-sidebar profile peek — same data as ProfilePeekDrawer
 * but rendered as embedded sidebar content (opaque openbricks, stackable).
 * Mobile callers can still use ProfilePeekDrawer via openOverlay.
 */
export function ProfileSidebar({
  userId,
  username,
  conversationId,
  conversation,
  seed,
  isExpanded,
  onToggleExpand,
  onClose,
}: {
  userId?: string | null;
  username?: string | null;
  conversationId?: string | null;
  conversation?: any;
  seed?: { displayName?: string; username?: string; bio?: string; avatar?: string } | null;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(seed || null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    seed?.avatar?.startsWith?.('http') ? seed.avatar : null,
  );
  const [groupTab, setGroupTab] = useState<'overview' | 'members' | 'media'>('overview');

  const isGroup = Boolean(conversation?.type === 'group' || conversation?.type === 'channel');

  useEffect(() => {
    if (isGroup) return;
    setProfile(seed || null);
    setAvatarUrl(seed?.avatar?.startsWith?.('http') ? seed.avatar : null);
  }, [seed?.displayName, seed?.username, seed?.bio, seed?.avatar, username, userId, isGroup]);

  useEffect(() => {
    if (isGroup) return;
    let cancelled = false;
    const cached = userId ? getCachedIdentityById(userId) : null;
    if (cached && !cancelled) setProfile((prev: any) => prev || cached);
    void (async () => {
      try {
        let row: any = null;
        if (username) row = await UsersService.getProfile(username);
        else if (userId) row = await UsersService.getProfileById(userId);
        if (cancelled || !row) return;
        setProfile(row);
        const avatar = row.avatar;
        if (avatar?.startsWith?.('http')) setAvatarUrl(avatar);
        else if (avatar) {
          try {
            const url = await fetchProfilePreview(avatar, 96, 96);
            if (!cancelled) setAvatarUrl(url as unknown as string);
          } catch {}
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, username, isGroup]);

  const name = isGroup
    ? conversation?.name || 'Group Hangout'
    : profile?.displayName || seed?.displayName || profile?.username || username || 'User';
  const handle = isGroup ? null : profile?.username || username || '';
  const bio = isGroup ? (conversation?.description || 'Group hangout channel').trim() : (profile?.bio || seed?.bio || '').trim();
  const shortBio = bio.length > 140 ? `${bio.slice(0, 139).trim()}…` : bio;
  const uid = profile?.userId || profile?.$id || userId;
  const isOwn = Boolean(!isGroup && user?.$id && uid && user.$id === uid);
  const displayName = name.replace(/\s*\(You\)\s*/gi, '').trim() || name;

  const handleExpandToggle = useCallback(() => {
    if (onToggleExpand) {
      onToggleExpand();
    } else if (onClose && !isGroup && handle) {
      onClose();
      router.push(`/u/${handle}`);
    }
  }, [handle, isGroup, onClose, onToggleExpand, router]);

  const goMessage = () => {
    if (onClose) onClose();
    if (isGroup) return;
    if (!uid) return;
    if (isOwn) {
      router.push('/connect/chats');
      return;
    }
    if (conversationId) return;
    router.push(`/connect/chats?userId=${encodeURIComponent(uid)}`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0F0E0D] text-white font-satoshi overflow-hidden">
      {/* Top Header Navigation — Arrow toggles full height expand */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151311] border-b border-white/8 shrink-0 z-20">
        <button
          type="button"
          onClick={handleExpandToggle}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-1.5 text-xs font-bold font-clash"
          title={isExpanded ? 'Collapse' : 'Expand full screen'}
        >
          <ChevronUp size={16} className={`text-[#6366F1] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-6">
        {/* Banner Gradient Header matching ProfileRedesign */}
        <div className="relative h-24 md:h-28 w-full shrink-0 bg-gradient-to-r from-[#6366F1]/40 via-[#FBBF24]/20 to-[#6366F1]/30">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        </div>

        {/* Profile Details Container */}
        <div className="relative z-10 bg-[#151311] border-t border-b border-white/8 p-5 -mt-10 space-y-4">
          <div className="flex items-end gap-3 -mt-12">
            <div className="border-3 border-[#0F0E0D] rounded-[24px] overflow-hidden shadow-2xl bg-[#0F0E0D] shrink-0">
              <IdentityAvatar
                userId={isGroup ? undefined : uid || undefined}
                src={isGroup ? (conversation?.avatarUrl?.startsWith?.('http') ? conversation.avatarUrl : null) : (avatarUrl?.startsWith?.('http') ? avatarUrl : null)}
                fileId={isGroup ? (conversation?.avatar || conversation?.avatarUrl || null) : (avatarUrl?.startsWith?.('http') ? null : avatarUrl || profile?.avatar || null)}
                alt={displayName}
                fallback={displayName.replace(/^@/, '').charAt(0).toUpperCase() || '?'}
                size={64}
                borderRadius="20px"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h2 className="text-white text-lg font-black tracking-tight leading-none truncate font-clash">
                {displayName}
                {isOwn ? <span className="text-[#6366F1] font-bold text-xs ml-1.5">(You)</span> : null}
              </h2>
              {handle ? (
                <div className="flex items-center gap-1.5">
                  <p className="text-[#6366F1] font-mono text-xs tracking-wide truncate">@{handle}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const profileUrl = `${window.location.origin}/u/${handle}`;
                      navigator.clipboard.writeText(profileUrl);
                      toast.success('Profile URL copied!');
                    }}
                    className="p-1 rounded bg-white/2 hover:bg-white/5 text-white/40 hover:text-white transition-all"
                    title="Copy Profile URL"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              ) : isGroup ? (
                <p className="text-xs font-mono text-white/45 truncate">
                  {conversation?.participants?.length || 0} members
                </p>
              ) : null}
            </div>
          </div>

          {/* Bio text */}
          {shortBio ? (
            <p className="text-xs text-white/70 font-satoshi leading-relaxed break-words [overflow-wrap:anywhere] m-0">
              {shortBio}
            </p>
          ) : (
            <p className="text-xs text-white/35 font-satoshi italic m-0">
              {isGroup ? 'Group hangout' : 'No bio yet'}
            </p>
          )}

          {/* Group Tabs vs User Stats */}
          {isGroup ? (
            <div className="space-y-3">
              <div className="flex border-b border-white/8 gap-4">
                <button
                  type="button"
                  onClick={() => setGroupTab('overview')}
                  className={`pb-2 text-xs font-bold font-clash border-b-2 transition-all ${groupTab === 'overview' ? 'border-[#6366F1] text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setGroupTab('members')}
                  className={`pb-2 text-xs font-bold font-clash border-b-2 transition-all ${groupTab === 'members' ? 'border-[#6366F1] text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
                >
                  Members ({conversation?.participants?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setGroupTab('media')}
                  className={`pb-2 text-xs font-bold font-clash border-b-2 transition-all ${groupTab === 'media' ? 'border-[#6366F1] text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
                >
                  Media
                </button>
              </div>

              {groupTab === 'overview' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[#0F0E0D] border border-white/6 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0">Members</p>
                    <p className="text-xs font-extrabold text-white m-0 mt-0.5 tabular-nums">
                      {conversation?.participants?.length || 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#0F0E0D] border border-white/6 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0">Security</p>
                    <p className="text-xs font-extrabold text-emerald-400 m-0 mt-0.5">
                      {conversation?.isEncrypted ? 'E2EE' : 'Private'}
                    </p>
                  </div>
                </div>
              )}

              {groupTab === 'members' && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {(conversation?.participants || []).map((memberId: string) => (
                    <div key={memberId} className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0F0E0D] border border-white/6">
                      <IdentityAvatar userId={memberId} size={28} borderRadius="8px" />
                      <span className="text-xs font-bold text-white truncate">
                        {memberId === user?.$id ? 'You' : `@${memberId.slice(0, 8)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {groupTab === 'media' && (
                <div className="p-4 text-center rounded-xl bg-[#0F0E0D] border border-white/6 text-xs text-white/40 font-mono">
                  Shared attachments and media appear here
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#0F0E0D] border border-white/6 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0">Following</p>
                <p className="text-xs font-extrabold text-white m-0 mt-0.5 tabular-nums">
                  {profile?.followingCount ?? profile?.stats?.following ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-[#0F0E0D] border border-white/6 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0">Followers</p>
                <p className="text-xs font-extrabold text-white m-0 mt-0.5 tabular-nums">
                  {profile?.followerCount ?? profile?.stats?.followers ?? '—'}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isGroup ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={goMessage}
                className="w-full h-9 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <MessageSquare size={13} strokeWidth={2.5} />
                <span>{isOwn ? 'Notes to self' : 'Message'}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
